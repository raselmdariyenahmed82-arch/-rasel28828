import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  COUNTRY_META,
  PRODUCT_IMAGE_POOL,
  sanitizeId,
  truncateField,
} from './constants';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  AdminRole,
  AppSettingDoc,
  CountryCode,
  CurrencyCode,
  Delivery,
  Order,
  Product,
  Shop,
} from '../types/youthgo';

export async function ensureUserProfile(user: User, preferredCountry: CountryCode = 'BD'): Promise<void> {
  const uid = sanitizeId(user.uid);
  const userRef = doc(db, 'users', uid);
  const custRef = doc(db, 'customers', uid);

  try {
    const snap = await getDoc(userRef);
    const meta = COUNTRY_META[preferredCountry];
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: truncateField(user.displayName || user.email?.split('@')[0] || 'YouthGo User', 120),
        email: truncateField(user.email || 'user@youthgo.app', 180),
        role: 'customer',
        countryCode: preferredCountry,
        currencyCode: meta.currencyCode,
        isActive: true,
        ...(user.photoURL ? { photoUrl: truncateField(user.photoURL, 500) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const custSnap = await getDoc(custRef);
    if (!custSnap.exists()) {
      await setDoc(custRef, {
        uid,
        fullName: truncateField(user.displayName || user.email?.split('@')[0] || 'YouthGo Customer', 120),
        email: truncateField(user.email || 'user@youthgo.app', 180),
        countryCode: preferredCountry,
        defaultAddress: `${meta.defaultCity} Central District`,
        isActive: true,
        totalOrders: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function writeAuditLog(params: {
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetDocId: string;
  summary: string;
}): Promise<void> {
  const logId = sanitizeId(`log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      actorUid: sanitizeId(params.actorUid),
      actorEmail: truncateField(params.actorEmail, 180),
      actorRole: truncateField(params.actorRole, 64),
      action: truncateField(params.action, 120),
      targetCollection: truncateField(params.targetCollection, 64),
      targetDocId: sanitizeId(params.targetDocId),
      summary: truncateField(params.summary, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logId}`);
  }
}

export async function bootstrapMarketplaceData(actor: User): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    // 1. Countries & Currencies
    (Object.keys(COUNTRY_META) as CountryCode[]).forEach((code) => {
      const m = COUNTRY_META[code];
      batch.set(doc(db, 'countries', code), {
        code,
        name: m.name,
        currencyCode: m.currencyCode,
        paymentGateways: m.gateways.join(', '),
        baseDeliveryFee: m.baseDeliveryFee,
        perKmFee: m.perKmFee,
        defaultCommissionPct: 10,
        isEnabled: true,
        updatedAt: now,
      });

      batch.set(doc(db, 'currencies', m.currencyCode), {
        code: m.currencyCode,
        name:
          m.currencyCode === 'BDT'
            ? 'Bangladeshi Taka'
            : m.currencyCode === 'INR'
              ? 'Indian Rupee'
              : m.currencyCode === 'GBP'
                ? 'British Pound'
                : m.currencyCode === 'SAR'
                  ? 'Saudi Riyal'
                  : 'US Dollar',
        symbol: m.symbol,
        usdRate: m.usdRate,
        decimalPlaces: 2,
        isActive: true,
        updatedAt: now,
      });
    });

    // 2. Global App Settings
    batch.set(doc(db, 'appSettings', 'global'), {
      id: 'global',
      shortDistanceKmMax: 2.0,
      shortDistanceSlaMinutes: 60,
      longDistanceSlaMinMinutes: 90,
      longDistanceSlaMaxMinutes: 120,
      defaultPlatformCommissionPct: 10,
      minWithdrawalUsd: 10,
      requireDeliveryOtp: true,
      requireAppCheck: true,
      maintenanceMode: false,
      updatedAt: now,
    });

    // 3. Categories
    const categories = [
      { id: 'cat_audio', name: 'Audio & Tech', slug: 'audio-tech', commissionPct: 10 },
      { id: 'cat_watches', name: 'Watches & Carry', slug: 'watches-carry', commissionPct: 12 },
      { id: 'cat_living', name: 'Home & Travel', slug: 'home-travel', commissionPct: 8 },
    ];
    for (const cat of categories) {
      batch.set(doc(db, 'categories', cat.id), {
        ...cat,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Verified International Shops & Products across all 5 countries
    const sellerUid = sanitizeId(actor.uid);
    batch.set(doc(db, 'sellers', sellerUid), {
      uid: sellerUid,
      businessName: 'YouthGo Flagship Studios',
      ownerName: truncateField(actor.displayName || 'YouthGo Partner', 120),
      email: truncateField(actor.email || 'partner@youthgo.app', 180),
      countryCode: 'BD',
      currencyCode: 'BDT',
      verificationStatus: 'verified',
      kycDocumentRef: 'KYC-FLAGSHIP-VERIFIED',
      commissionRatePct: 10,
      createdAt: now,
      updatedAt: now,
    });

    const shopConfigs: Array<{ id: string; name: string; countryCode: CountryCode; city: string; lat: number; lng: number }> = [
      { id: 'shop_dhaka_1', name: 'Dhanmondi Craft & Audio', countryCode: 'BD', city: 'Dhaka', lat: 23.7461, lng: 90.3742 },
      { id: 'shop_blr_1', name: 'Indiranagar Studio Supply', countryCode: 'IN', city: 'Bengaluru', lat: 12.9784, lng: 77.6408 },
      { id: 'shop_aus_1', name: 'South Congress Provisions', countryCode: 'US', city: 'Austin', lat: 30.2515, lng: -97.7495 },
      { id: 'shop_ldn_1', name: 'Shoreditch Objects', countryCode: 'GB', city: 'London', lat: 51.5245, lng: -0.0786 },
      { id: 'shop_ruh_1', name: 'Olaya Minimalist Goods', countryCode: 'SA', city: 'Riyadh', lat: 24.6978, lng: 46.6852 },
    ];

    const productTemplates = [
      {
        suffix: 'headphones',
        title: 'Aether Reference Wireless Headphones',
        description: 'Active acoustic isolation, 38-hour battery, machined aluminum headband.',
        categoryId: 'cat_audio',
        usdPrice: 145,
        imageUrl: PRODUCT_IMAGE_POOL.headphones,
      },
      {
        suffix: 'watch',
        title: 'Meridian Titanium Chronograph',
        description: 'Grade-2 brushed titanium case, sapphire crystal, 100m water resistance.',
        categoryId: 'cat_watches',
        usdPrice: 210,
        imageUrl: PRODUCT_IMAGE_POOL.watch,
      },
      {
        suffix: 'backpack',
        title: 'Transit Waxed Canvas Pack',
        description: 'Weather-sealed 22L commuter pack with bridle leather straps and 16-inch sleeve.',
        categoryId: 'cat_watches',
        usdPrice: 95,
        imageUrl: PRODUCT_IMAGE_POOL.backpack,
      },
      {
        suffix: 'flask',
        title: 'Forge Insulated Flask & Vessel Set',
        description: 'Double-wall vacuum steel flask paired with stoneware tasting tumbler.',
        categoryId: 'cat_living',
        usdPrice: 48,
        imageUrl: PRODUCT_IMAGE_POOL.flask,
      },
    ];

    for (const s of shopConfigs) {
      const m = COUNTRY_META[s.countryCode];
      batch.set(doc(db, 'shops', s.id), {
        id: s.id,
        sellerUid,
        name: s.name,
        category: 'Curated Goods',
        countryCode: s.countryCode,
        currencyCode: m.currencyCode,
        city: s.city,
        lat: s.lat,
        lng: s.lng,
        approvalStatus: 'approved',
        isOpen: true,
        createdAt: now,
        updatedAt: now,
      });

      for (const p of productTemplates) {
        const prodId = `prod_${s.countryCode.toLowerCase()}_${p.suffix}`;
        const localPrice = Number((p.usdPrice / m.usdRate).toFixed(2));
        batch.set(doc(db, 'products', prodId), {
          id: prodId,
          shopId: s.id,
          sellerUid,
          categoryId: p.categoryId,
          title: p.title,
          description: p.description,
          countryCode: s.countryCode,
          currencyCode: m.currencyCode,
          price: localPrice,
          stock: 24,
          imageUrl: p.imageUrl,
          visibilityStatus: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await batch.commit();

    await writeAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: 'super_admin',
      action: 'BOOTSTRAP_MARKETPLACE',
      targetCollection: 'countries',
      targetDocId: 'BD_IN_US_GB_SA',
      summary: 'Initialized 5 international marketplaces, currencies, categories, shops, and catalog items.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'bootstrapMarketplaceData');
  }
}

export async function placeCustomerOrder(params: {
  customerUid: string;
  product: Product;
  quantity: number;
  distanceKm: number;
  deliveryAddress: string;
  paymentGateway: string;
}): Promise<{ orderId: string; otp: string }> {
  const orderId = sanitizeId(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const deliveryId = sanitizeId(`del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const idempotencyKey = sanitizeId(`idem_${orderId}_${params.customerUid.slice(0, 8)}`);
  const otp = String(Math.floor(1000 + Math.random() * 9000));

  const slaRes = await fetch('/api/delivery/calculate-sla', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryCode: params.product.countryCode,
      distanceKm: params.distanceKm,
    }),
  });
  if (!slaRes.ok) {
    throw new Error('Failed to compute authoritative delivery SLA.');
  }
  const slaData = (await slaRes.json()) as {
    estimatedMinutes: number;
    slaWindowLabel: string;
    deliveryFee: number;
    riderPayout: number;
  };

  const subtotal = Number((params.product.price * params.quantity).toFixed(2));
  const totalAmount = Number((subtotal + slaData.deliveryFee).toFixed(2));
  const platformCommission = Number((subtotal * 0.1).toFixed(2));
  const sellerNet = Number((subtotal - platformCommission).toFixed(2));

  const payRes = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      countryCode: params.product.countryCode,
      currencyCode: params.product.currencyCode,
      gateway: params.paymentGateway,
      amount: totalAmount,
      orderId,
      idempotencyKey,
    }),
  });
  if (!payRes.ok) {
    const msg = await payRes.text();
    throw new Error(`Payment gateway verification failed: ${msg}`);
  }
  const payData = (await payRes.json()) as {
    paymentReference: string;
    gatewaySignature: string;
    status: 'verified' | 'pending';
  };

  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, 'orders', orderId), {
      id: orderId,
      customerUid: sanitizeId(params.customerUid),
      shopId: sanitizeId(params.product.shopId),
      sellerUid: sanitizeId(params.product.sellerUid),
      riderUid: '',
      countryCode: params.product.countryCode,
      currencyCode: params.product.currencyCode,
      subtotal,
      deliveryFee: slaData.deliveryFee,
      platformCommission,
      riderPayout: slaData.riderPayout,
      sellerNet,
      totalAmount,
      distanceKm: Number(params.distanceKm),
      slaMinutes: slaData.estimatedMinutes,
      paymentGateway: truncateField(params.paymentGateway, 64),
      paymentStatus: payData.status,
      paymentReference: truncateField(payData.paymentReference, 160),
      idempotencyKey,
      settlementApplied: false,
      orderStatus: 'placed',
      deliveryOtp: otp,
      deliveryAddress: truncateField(params.deliveryAddress, 300),
      itemCount: params.quantity,
      itemSummary: truncateField(`${params.quantity}x ${params.product.title}`, 300),
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'deliveries', deliveryId), {
      id: deliveryId,
      orderId,
      customerUid: sanitizeId(params.customerUid),
      sellerUid: sanitizeId(params.product.sellerUid),
      riderUid: '',
      countryCode: params.product.countryCode,
      currencyCode: params.product.currencyCode,
      distanceKm: Number(params.distanceKm),
      slaWindowLabel: truncateField(slaData.slaWindowLabel, 48),
      estimatedMinutes: slaData.estimatedMinutes,
      deliveryFee: slaData.deliveryFee,
      riderPayout: slaData.riderPayout,
      status: 'awaiting_rider',
      pickupConfirmed: false,
      otpVerified: false,
      delayVerificationStatus: 'none',
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
    return { orderId, otp };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
  }
}

export async function settleOrderIdempotently(order: Order, actor: User): Promise<boolean> {
  if (order.settlementApplied || order.orderStatus !== 'delivered' || order.paymentStatus !== 'verified') {
    return false;
  }

  const orderRef = doc(db, 'orders', order.id);
  const sellerTxRef = doc(db, 'transactions', sanitizeId(`tx_${order.id}_seller`));
  const riderTxRef = doc(db, 'transactions', sanitizeId(`tx_${order.id}_rider`));
  const platformTxRef = doc(db, 'transactions', sanitizeId(`tx_${order.id}_platform`));
  const sellerWalletRef = doc(db, 'sellerWallets', sanitizeId(order.sellerUid));
  const riderWalletRef = order.riderUid ? doc(db, 'riderWallets', sanitizeId(order.riderUid)) : null;

  const meta = COUNTRY_META[order.countryCode];
  const platformCommission = Number((order.platformCommission ?? order.subtotal * 0.1).toFixed(2));
  const sellerNet = Number((order.sellerNet ?? Math.max(0, order.subtotal - platformCommission)).toFixed(2));
  const riderPayout = Number((order.riderPayout ?? order.deliveryFee * 0.85).toFixed(2));

  try {
    let settled = false;
    await runTransaction(db, async (tx) => {
      const freshOrder = await tx.get(orderRef);
      if (!freshOrder.exists() || freshOrder.data()?.settlementApplied === true) {
        return;
      }

      const sellerTxSnap = await tx.get(sellerTxRef);
      if (sellerTxSnap.exists()) {
        return; // Idempotent guard
      }

      const sellerWalletSnap = await tx.get(sellerWalletRef);
      const prevSellerAvail = Number(sellerWalletSnap.data()?.availableBalance ?? 0);
      const prevSellerEarned = Number(sellerWalletSnap.data()?.totalEarned ?? 0);

      let prevRiderAvail = 0;
      let prevRiderEarned = 0;
      let riderWalletSnap = null;
      if (riderWalletRef) {
        riderWalletSnap = await tx.get(riderWalletRef);
        prevRiderAvail = Number(riderWalletSnap.data()?.availableBalance ?? 0);
        prevRiderEarned = Number(riderWalletSnap.data()?.totalEarned ?? 0);
      }

      const now = serverTimestamp();

      tx.set(
        sellerWalletRef,
        {
          sellerUid: sanitizeId(order.sellerUid),
          countryCode: order.countryCode,
          currencyCode: order.currencyCode,
          availableBalance: Number((prevSellerAvail + sellerNet).toFixed(2)),
          pendingBalance: Number(sellerWalletSnap.data()?.pendingBalance ?? 0),
          totalEarned: Number((prevSellerEarned + sellerNet).toFixed(2)),
          totalWithdrawn: Number(sellerWalletSnap.data()?.totalWithdrawn ?? 0),
          lastOrderId: order.id,
          updatedAt: now,
        },
        { merge: true }
      );

      tx.set(sellerTxRef, {
        id: sanitizeId(`tx_${order.id}_seller`),
        idempotencyKey: sanitizeId(`settle_${order.id}_seller`),
        orderId: order.id,
        targetUid: sanitizeId(order.sellerUid),
        ledgerType: 'seller_wallet',
        direction: 'credit',
        countryCode: order.countryCode,
        currencyCode: order.currencyCode,
        amount: sellerNet,
        amountUsd: Number((sellerNet * meta.usdRate).toFixed(2)),
        gateway: order.paymentGateway,
        status: 'settled',
        createdAt: now,
      });

      if (riderWalletRef && order.riderUid) {
        tx.set(
          riderWalletRef,
          {
            riderUid: sanitizeId(order.riderUid),
            countryCode: order.countryCode,
            currencyCode: order.currencyCode,
            availableBalance: Number((prevRiderAvail + riderPayout).toFixed(2)),
            pendingBalance: Number(riderWalletSnap?.data()?.pendingBalance ?? 0),
            totalEarned: Number((prevRiderEarned + riderPayout).toFixed(2)),
            totalWithdrawn: Number(riderWalletSnap?.data()?.totalWithdrawn ?? 0),
            lastOrderId: order.id,
            updatedAt: now,
          },
          { merge: true }
        );

        tx.set(riderTxRef, {
          id: sanitizeId(`tx_${order.id}_rider`),
          idempotencyKey: sanitizeId(`settle_${order.id}_rider`),
          orderId: order.id,
          targetUid: sanitizeId(order.riderUid),
          ledgerType: 'rider_wallet',
          direction: 'credit',
          countryCode: order.countryCode,
          currencyCode: order.currencyCode,
          amount: riderPayout,
          amountUsd: Number((riderPayout * meta.usdRate).toFixed(2)),
          gateway: order.paymentGateway,
          status: 'settled',
          createdAt: now,
        });
      }

      tx.set(platformTxRef, {
        id: sanitizeId(`tx_${order.id}_platform`),
        idempotencyKey: sanitizeId(`settle_${order.id}_platform`),
        orderId: order.id,
        targetUid: 'platform_treasury',
        ledgerType: 'platform_revenue',
        direction: 'credit',
        countryCode: order.countryCode,
        currencyCode: order.currencyCode,
        amount: platformCommission,
        amountUsd: Number((platformCommission * meta.usdRate).toFixed(2)),
        gateway: order.paymentGateway,
        status: 'settled',
        createdAt: now,
      });

      tx.update(orderRef, {
        settlementApplied: true,
        platformCommission,
        sellerNet,
        riderPayout,
        updatedAt: now,
      });

      settled = true;
    });

    if (settled) {
      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: 'admin',
        action: 'IDEMPOTENT_ORDER_SETTLEMENT',
        targetCollection: 'orders',
        targetDocId: order.id,
        summary: `Settled ${order.currencyCode} ${order.totalAmount} (Seller: ${sellerNet}, Rider: ${riderPayout}, Platform: ${platformCommission})`,
      });
    }
    return settled;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `orders/${order.id}`);
  }
}

export async function updateOrderStatus(orderId: string, status: Order['orderStatus']): Promise<void> {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      orderStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
  }
}

export async function claimDeliveryAsRider(delivery: Delivery, riderUid: string, countryCode: CountryCode): Promise<void> {
  const m = COUNTRY_META[countryCode];
  const baseLat = countryCode === 'BD' ? 23.75 : countryCode === 'IN' ? 12.97 : countryCode === 'GB' ? 51.52 : countryCode === 'SA' ? 24.7 : 30.26;
  const baseLng = countryCode === 'BD' ? 90.38 : countryCode === 'IN' ? 77.64 : countryCode === 'GB' ? -0.08 : countryCode === 'SA' ? 46.68 : -97.74;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'deliveries', delivery.id), {
      riderUid: sanitizeId(riderUid),
      status: 'assigned',
      riderLat: Number((baseLat + Math.random() * 0.01).toFixed(5)),
      riderLng: Number((baseLng + Math.random() * 0.01).toFixed(5)),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', delivery.orderId), {
      riderUid: sanitizeId(riderUid),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    void m;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `deliveries/${delivery.id}`);
  }
}

export async function confirmRiderPickup(delivery: Delivery): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'deliveries', delivery.id), {
      pickupConfirmed: true,
      status: 'picked_up',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', delivery.orderId), {
      orderStatus: 'picked_up',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `deliveries/${delivery.id}`);
  }
}

export async function completeDeliveryWithOtp(
  delivery: Delivery,
  enteredOtp: string,
  expectedOtp: string
): Promise<boolean> {
  if (enteredOtp.trim() !== expectedOtp.trim()) {
    return false;
  }
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'deliveries', delivery.id), {
      otpVerified: true,
      status: 'delivered',
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', delivery.orderId), {
      orderStatus: 'delivered',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `deliveries/${delivery.id}`);
  }
}

export async function reportDeliveryDelay(deliveryId: string, reason: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'deliveries', deliveryId), {
      status: 'delayed',
      delayReason: truncateField(reason, 240),
      delayVerificationStatus: 'pending_review',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `deliveries/${deliveryId}`);
  }
}

export async function registerSellerAndShop(params: {
  user: User;
  businessName: string;
  city: string;
  countryCode: CountryCode;
  category: string;
}): Promise<string> {
  const sellerUid = sanitizeId(params.user.uid);
  const shopId = sanitizeId(`shop_${sellerUid.slice(0, 10)}_${Date.now().toString(36)}`);
  const meta = COUNTRY_META[params.countryCode];
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, 'sellers', sellerUid), {
      uid: sellerUid,
      businessName: truncateField(params.businessName, 140),
      ownerName: truncateField(params.user.displayName || 'Merchant', 120),
      email: truncateField(params.user.email || '', 180),
      countryCode: params.countryCode,
      currencyCode: meta.currencyCode,
      verificationStatus: 'pending',
      kycDocumentRef: `KYC-${shopId}`,
      commissionRatePct: 10,
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'shops', shopId), {
      id: shopId,
      sellerUid,
      name: truncateField(params.businessName, 140),
      category: truncateField(params.category, 80),
      countryCode: params.countryCode,
      currencyCode: meta.currencyCode,
      city: truncateField(params.city, 80),
      approvalStatus: 'pending',
      isOpen: true,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
    return shopId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `shops/${shopId}`);
  }
}

export async function createSellerProduct(params: {
  sellerUid: string;
  shop: Shop;
  title: string;
  description: string;
  categoryId: string;
  price: number;
  stock: number;
  imageUrl: string;
}): Promise<string> {
  const prodId = sanitizeId(`prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'products', prodId), {
      id: prodId,
      shopId: params.shop.id,
      sellerUid: sanitizeId(params.sellerUid),
      categoryId: sanitizeId(params.categoryId),
      title: truncateField(params.title, 160),
      description: truncateField(params.description, 1000),
      countryCode: params.shop.countryCode,
      currencyCode: params.shop.currencyCode,
      price: Number(params.price),
      stock: Math.max(0, Math.floor(params.stock)),
      imageUrl: truncateField(params.imageUrl, 500),
      visibilityStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return prodId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `products/${prodId}`);
  }
}

export async function registerDeliveryPartner(params: {
  user: User;
  phone: string;
  countryCode: CountryCode;
  vehicleType: 'bicycle' | 'motorbike' | 'ebike' | 'van';
}): Promise<void> {
  const uid = sanitizeId(params.user.uid);
  try {
    await setDoc(doc(db, 'deliveryPartners', uid), {
      uid,
      fullName: truncateField(params.user.displayName || 'YouthGo Rider', 120),
      phone: truncateField(params.phone, 32),
      countryCode: params.countryCode,
      vehicleType: params.vehicleType,
      verificationStatus: 'pending',
      isAvailable: true,
      completedDeliveries: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `deliveryPartners/${uid}`);
  }
}

export async function requestWalletWithdrawal(params: {
  uid: string;
  role: 'seller' | 'delivery_partner';
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  amount: number;
  payoutMethod: string;
  accountMask: string;
}): Promise<string> {
  const id = sanitizeId(`wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'withdrawals', id), {
      id,
      requesterUid: sanitizeId(params.uid),
      requesterRole: params.role,
      countryCode: params.countryCode,
      currencyCode: params.currencyCode,
      amount: Number(params.amount),
      payoutMethod: truncateField(params.payoutMethod, 80),
      accountMask: truncateField(params.accountMask, 80),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `withdrawals/${id}`);
  }
}

export async function submitRefundRequest(params: {
  order: Order;
  reason: string;
}): Promise<string> {
  const id = sanitizeId(`ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'refunds', id), {
      id,
      orderId: params.order.id,
      customerUid: params.order.customerUid,
      countryCode: params.order.countryCode,
      currencyCode: params.order.currencyCode,
      amount: params.order.totalAmount,
      reason: truncateField(params.reason, 400),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `refunds/${id}`);
  }
}

export async function submitComplaint(params: {
  reporterUid: string;
  reporterRole: 'customer' | 'seller' | 'delivery_partner';
  orderId?: string;
  subject: string;
  description: string;
}): Promise<string> {
  const id = sanitizeId(`cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'complaints', id), {
      id,
      reporterUid: sanitizeId(params.reporterUid),
      reporterRole: params.reporterRole,
      ...(params.orderId ? { orderId: sanitizeId(params.orderId) } : {}),
      subject: truncateField(params.subject, 160),
      description: truncateField(params.description, 1000),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `complaints/${id}`);
  }
}

export async function adminMutateDoc(params: {
  actor: User;
  collectionName: string;
  docId: string;
  updates: Record<string, unknown>;
  actionName: string;
  summary: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, params.collectionName, params.docId), {
      ...params.updates,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.actor.uid,
      actorEmail: params.actor.email || '',
      actorRole: 'admin',
      action: params.actionName,
      targetCollection: params.collectionName,
      targetDocId: params.docId,
      summary: params.summary,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${params.collectionName}/${params.docId}`);
  }
}

export async function adminApproveWithdrawal(params: {
  actor: User;
  withdrawalId: string;
  requesterUid: string;
  requesterRole: 'seller' | 'delivery_partner';
  amount: number;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  approve: boolean;
}): Promise<void> {
  try {
    const wdRef = doc(db, 'withdrawals', params.withdrawalId);
    if (!params.approve) {
      await updateDoc(wdRef, {
        status: 'rejected',
        reviewedByUid: params.actor.uid,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog({
        actorUid: params.actor.uid,
        actorEmail: params.actor.email || '',
        actorRole: 'admin',
        action: 'REJECT_WITHDRAWAL',
        targetCollection: 'withdrawals',
        targetDocId: params.withdrawalId,
        summary: `Rejected withdrawal ${params.withdrawalId}`,
      });
      return;
    }

    const walletCollection = params.requesterRole === 'seller' ? 'sellerWallets' : 'riderWallets';
    const walletRef = doc(db, walletCollection, params.requesterUid);
    const txId = sanitizeId(`tx_wd_${params.withdrawalId}`);
    const txRef = doc(db, 'transactions', txId);
    const meta = COUNTRY_META[params.countryCode];

    await runTransaction(db, async (tx) => {
      const wdSnap = await tx.get(wdRef);
      if (!wdSnap.exists() || wdSnap.data()?.status !== 'pending') return;

      const walletSnap = await tx.get(walletRef);
      const avail = Number(walletSnap.data()?.availableBalance ?? 0);
      const withdrawn = Number(walletSnap.data()?.totalWithdrawn ?? 0);
      const debit = Math.min(avail, params.amount);

      if (walletSnap.exists()) {
        tx.update(walletRef, {
          availableBalance: Number((avail - debit).toFixed(2)),
          totalWithdrawn: Number((withdrawn + debit).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
      }

      tx.update(wdRef, {
        status: 'settled',
        reviewedByUid: params.actor.uid,
        gatewayPayoutRef: `PAYOUT_${params.withdrawalId.toUpperCase()}`,
        updatedAt: serverTimestamp(),
      });

      tx.set(txRef, {
        id: txId,
        idempotencyKey: sanitizeId(`wd_settle_${params.withdrawalId}`),
        targetUid: params.requesterUid,
        ledgerType: 'withdrawal',
        direction: 'debit',
        countryCode: params.countryCode,
        currencyCode: params.currencyCode,
        amount: params.amount,
        amountUsd: Number((params.amount * meta.usdRate).toFixed(2)),
        gateway: 'YouthGo Payout Gateway',
        status: 'settled',
        createdAt: serverTimestamp(),
      });
    });

    await writeAuditLog({
      actorUid: params.actor.uid,
      actorEmail: params.actor.email || '',
      actorRole: 'admin',
      action: 'SETTLE_WITHDRAWAL',
      targetCollection: 'withdrawals',
      targetDocId: params.withdrawalId,
      summary: `Settled ${params.currencyCode} ${params.amount} withdrawal for ${params.requesterUid}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `withdrawals/${params.withdrawalId}`);
  }
}

export async function adminSendNotification(params: {
  actor: User;
  targetUid: string;
  title: string;
  body: string;
  channel: 'order' | 'delivery' | 'wallet' | 'system' | 'promotion';
}): Promise<void> {
  const id = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'notifications', id), {
      id,
      targetUid: truncateField(params.targetUid, 128),
      title: truncateField(params.title, 140),
      body: truncateField(params.body, 500),
      channel: params.channel,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.actor.uid,
      actorEmail: params.actor.email || '',
      actorRole: 'admin',
      action: 'SEND_NOTIFICATION',
      targetCollection: 'notifications',
      targetDocId: id,
      summary: `Broadcast [${params.channel}] to ${params.targetUid}: ${params.title}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
  }
}

export async function adminGrantAdminUser(params: {
  actor: User;
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: string;
}): Promise<void> {
  const cleanUid = sanitizeId(params.uid);
  try {
    await setDoc(doc(db, 'adminUsers', cleanUid), {
      uid: cleanUid,
      email: truncateField(params.email, 180),
      displayName: truncateField(params.displayName, 120),
      role: params.role,
      permissions: truncateField(params.permissions, 400),
      isActive: true,
      grantedByUid: params.actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: params.actor.uid,
      actorEmail: params.actor.email || '',
      actorRole: 'super_admin',
      action: 'GRANT_ADMIN_ACCESS',
      targetCollection: 'adminUsers',
      targetDocId: cleanUid,
      summary: `Granted ${params.role} to ${params.email}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `adminUsers/${cleanUid}`);
  }
}

export async function adminSaveAppSettings(actor: User, settings: AppSettingDoc): Promise<void> {
  try {
    await setDoc(doc(db, 'appSettings', 'global'), {
      ...settings,
      id: 'global',
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      actorRole: 'admin',
      action: 'UPDATE_APP_SETTINGS',
      targetCollection: 'appSettings',
      targetDocId: 'global',
      summary: `Updated SLA (${settings.shortDistanceSlaMinutes}m / ${settings.longDistanceSlaMinMinutes}-${settings.longDistanceSlaMaxMinutes}m), Commission ${settings.defaultPlatformCommissionPct}%`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'appSettings/global');
  }
}
