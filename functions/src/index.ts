import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();
const db = admin.firestore();

const CURRENCY_USD_RATES: Record<string, number> = {
  BDT: 0.0084,
  INR: 0.0119,
  USD: 1.0,
  GBP: 1.27,
  SAR: 0.2666,
};

/**
 * 1. Idempotent Order Settlement Trigger
 * Credits Seller Wallet, Rider Wallet, and Platform Revenue ledger
 * strictly once per order using deterministic transaction doc IDs.
 */
export const settleCompletedOrder = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const orderId = event.params.orderId;
  const transitionedToDelivered = before.orderStatus !== 'delivered' && after.orderStatus === 'delivered';
  if (!transitionedToDelivered || after.settlementApplied === true) {
    return;
  }

  if (after.paymentStatus !== 'verified') {
    throw new Error(`Order ${orderId} cannot settle without verified payment.`);
  }

  const orderRef = db.collection('orders').doc(orderId);
  const sellerTxRef = db.collection('transactions').doc(`tx_${orderId}_seller`);
  const riderTxRef = db.collection('transactions').doc(`tx_${orderId}_rider`);
  const platformTxRef = db.collection('transactions').doc(`tx_${orderId}_platform`);
  const sellerWalletRef = db.collection('sellerWallets').doc(after.sellerUid);
  const riderWalletRef = after.riderUid ? db.collection('riderWallets').doc(after.riderUid) : null;

  const usdRate = CURRENCY_USD_RATES[after.currencyCode] ?? 1.0;
  const platformCommission = Number(after.platformCommission ?? after.subtotal * 0.1);
  const sellerNet = Number(after.sellerNet ?? Math.max(0, after.subtotal - platformCommission));
  const riderPayout = Number(after.riderPayout ?? after.deliveryFee * 0.85);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const freshOrder = await tx.get(orderRef);
    if (!freshOrder.exists || freshOrder.data()?.settlementApplied === true) {
      return;
    }

    const existingSellerTx = await tx.get(sellerTxRef);
    if (existingSellerTx.exists) {
      return; // Idempotency guard
    }

    const sellerWalletSnap = await tx.get(sellerWalletRef);
    const prevSellerAvail = Number(sellerWalletSnap.data()?.availableBalance ?? 0);
    const prevSellerEarned = Number(sellerWalletSnap.data()?.totalEarned ?? 0);

    tx.set(
      sellerWalletRef,
      {
        sellerUid: after.sellerUid,
        countryCode: after.countryCode,
        currencyCode: after.currencyCode,
        availableBalance: Number((prevSellerAvail + sellerNet).toFixed(2)),
        pendingBalance: Number(sellerWalletSnap.data()?.pendingBalance ?? 0),
        totalEarned: Number((prevSellerEarned + sellerNet).toFixed(2)),
        totalWithdrawn: Number(sellerWalletSnap.data()?.totalWithdrawn ?? 0),
        lastOrderId: orderId,
        updatedAt: now,
      },
      { merge: true }
    );

    tx.create(sellerTxRef, {
      id: `tx_${orderId}_seller`,
      idempotencyKey: `settle_${orderId}_seller`,
      orderId,
      targetUid: after.sellerUid,
      ledgerType: 'seller_wallet',
      direction: 'credit',
      countryCode: after.countryCode,
      currencyCode: after.currencyCode,
      amount: sellerNet,
      amountUsd: Number((sellerNet * usdRate).toFixed(2)),
      gateway: after.paymentGateway,
      status: 'settled',
      createdAt: now,
    });

    if (riderWalletRef && after.riderUid) {
      const riderWalletSnap = await tx.get(riderWalletRef);
      const prevRiderAvail = Number(riderWalletSnap.data()?.availableBalance ?? 0);
      const prevRiderEarned = Number(riderWalletSnap.data()?.totalEarned ?? 0);

      tx.set(
        riderWalletRef,
        {
          riderUid: after.riderUid,
          countryCode: after.countryCode,
          currencyCode: after.currencyCode,
          availableBalance: Number((prevRiderAvail + riderPayout).toFixed(2)),
          pendingBalance: Number(riderWalletSnap.data()?.pendingBalance ?? 0),
          totalEarned: Number((prevRiderEarned + riderPayout).toFixed(2)),
          totalWithdrawn: Number(riderWalletSnap.data()?.totalWithdrawn ?? 0),
          lastOrderId: orderId,
          updatedAt: now,
        },
        { merge: true }
      );

      tx.create(riderTxRef, {
        id: `tx_${orderId}_rider`,
        idempotencyKey: `settle_${orderId}_rider`,
        orderId,
        targetUid: after.riderUid,
        ledgerType: 'rider_wallet',
        direction: 'credit',
        countryCode: after.countryCode,
        currencyCode: after.currencyCode,
        amount: riderPayout,
        amountUsd: Number((riderPayout * usdRate).toFixed(2)),
        gateway: after.paymentGateway,
        status: 'settled',
        createdAt: now,
      });
    }

    tx.create(platformTxRef, {
      id: `tx_${orderId}_platform`,
      idempotencyKey: `settle_${orderId}_platform`,
      orderId,
      targetUid: 'platform_treasury',
      ledgerType: 'platform_revenue',
      direction: 'credit',
      countryCode: after.countryCode,
      currencyCode: after.currencyCode,
      amount: platformCommission,
      amountUsd: Number((platformCommission * usdRate).toFixed(2)),
      gateway: after.paymentGateway,
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
  });
});

/**
 * 2. Server-Side Payment Gateway Webhook Verification
 * Validates gateway HMAC signature before marking an order payment as verified.
 */
export const verifyPaymentGatewayWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET || '';
  if (!secret) {
    res.status(500).json({ error: 'Gateway webhook secret is not configured.' });
    return;
  }

  const signature = req.header('x-youthgo-signature') || '';
  const rawBody = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(401).json({ error: 'Invalid payment gateway signature' });
    return;
  }

  const { orderId, paymentReference, gateway } = req.body as {
    orderId: string;
    paymentReference: string;
    gateway: string;
  };

  if (!orderId || !paymentReference) {
    res.status(400).json({ error: 'Missing orderId or paymentReference' });
    return;
  }

  await db.collection('orders').doc(orderId).update({
    paymentStatus: 'verified',
    paymentReference,
    paymentGateway: gateway,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.status(200).json({ verified: true, orderId });
});

/**
 * 3. Server-Side RBAC Admin Assignment (No client self-escalation)
 */
export const grantAdminRole = onCall(async (request) => {
  if (!request.auth || !request.auth.token.email_verified) {
    throw new HttpsError('unauthenticated', 'Verified authentication required.');
  }

  const callerAdminDoc = await db.collection('adminUsers').doc(request.auth.uid).get();
  if (!callerAdminDoc.exists || callerAdminDoc.data()?.role !== 'super_admin' || !callerAdminDoc.data()?.isActive) {
    throw new HttpsError('permission-denied', 'Only an active super_admin may grant admin roles.');
  }

  const { targetUid, email, displayName, role, permissions } = request.data as {
    targetUid: string;
    email: string;
    displayName: string;
    role: 'super_admin' | 'ops_admin' | 'finance_admin' | 'support_admin';
    permissions: string;
  };

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('adminUsers').doc(targetUid).set({
    uid: targetUid,
    email,
    displayName,
    role,
    permissions,
    isActive: true,
    grantedByUid: request.auth.uid,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('auditLogs').add({
    id: `log_${Date.now()}`,
    actorUid: request.auth.uid,
    actorEmail: request.auth.token.email || '',
    actorRole: 'super_admin',
    action: 'GRANT_ADMIN_ROLE',
    targetCollection: 'adminUsers',
    targetDocId: targetUid,
    summary: `Granted ${role} to ${email}`,
    createdAt: now,
  });

  return { granted: true, targetUid, role };
});

/**
 * 4. FCM Push Notification Dispatcher
 */
export const dispatchPushNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const topic = data.targetUid === 'all' ? 'youthgo_global' : `user_${data.targetUid}`;
  await admin.messaging().send({
    topic,
    notification: {
      title: String(data.title),
      body: String(data.body),
    },
    data: {
      channel: String(data.channel || 'system'),
      notificationId: event.params.notificationId,
    },
  });
});
