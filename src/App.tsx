import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AndroidArchitectureView } from './components/AndroidArchitectureView';
import { MarketplaceView } from './components/MarketplaceView';
import { RiderView } from './components/RiderView';
import { SellerView } from './components/SellerView';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { ensureUserProfile } from './lib/youthgoService';
import type {
  AdminUserDoc,
  AppSettingDoc,
  AuditLogDoc,
  Category,
  Complaint,
  CountryCode,
  CountryDoc,
  CurrencyDoc,
  CustomerProfile,
  Delivery,
  DeliveryPartnerProfile,
  LedgerTransaction,
  NotificationItem,
  Order,
  Product,
  Refund,
  SellerProfile,
  Shop,
  WalletAccount,
  Withdrawal,
} from './types/youthgo';

type WorkspaceTab = 'marketplace' | 'seller' | 'delivery' | 'admin' | 'android';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('marketplace');
  const [countryCode, setCountryCode] = useState<CountryCode>('BD');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Public Marketplace State
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<CountryDoc[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyDoc[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingDoc | null>(null);

  // Role & Operations State
  const [adminRecord, setAdminRecord] = useState<AdminUserDoc | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [riderProfile, setRiderProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [sellerWallet, setSellerWallet] = useState<WalletAccount | null>(null);
  const [riderWallet, setRiderWallet] = useState<WalletAccount | null>(null);

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [riders, setRiders] = useState<DeliveryPartnerProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserDoc[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogDoc[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 4500);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        await ensureUserProfile(nextUser, countryCode);
      }
    });
    return () => unsub();
  }, []);

  const isBootstrappedAdmin = Boolean(
    user?.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL
  );
  const isAdmin = isBootstrappedAdmin || Boolean(adminRecord?.isActive);
  const isSuperAdmin = isBootstrappedAdmin || Boolean(adminRecord?.isActive && adminRecord.role === 'super_admin');

  // Public Listeners
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    const shopsQuery = isBootstrappedAdmin
      ? collection(db, 'shops')
      : query(collection(db, 'shops'), where('approvalStatus', '==', 'approved'));

    unsubs.push(
      onSnapshot(
        shopsQuery,
        (snap) => setShops(snap.docs.map((d) => d.data() as Shop)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
      )
    );

    const productsQuery = isBootstrappedAdmin
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('visibilityStatus', '==', 'active'));

    unsubs.push(
      onSnapshot(
        productsQuery,
        (snap) => setProducts(snap.docs.map((d) => d.data() as Product)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'products')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'categories'),
        (snap) => setCategories(snap.docs.map((d) => d.data() as Category)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'countries'),
        (snap) => setCountries(snap.docs.map((d) => d.data() as CountryDoc)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'countries')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'currencies'),
        (snap) => setCurrencies(snap.docs.map((d) => d.data() as CurrencyDoc)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'currencies')
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'appSettings', 'global'),
        (snap) => setAppSettings(snap.exists() ? (snap.data() as AppSettingDoc) : null),
        (err) => handleFirestoreError(err, OperationType.GET, 'appSettings/global')
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [isBootstrappedAdmin]);

  // Authenticated Role-Scoped Listeners
  useEffect(() => {
    if (!authReady || !user) {
      setAdminRecord(null);
      setSellerProfile(null);
      setRiderProfile(null);
      setSellerWallet(null);
      setRiderWallet(null);
      setOrders([]);
      setDeliveries([]);
      setWithdrawals([]);
      return;
    }

    const uid = user.uid;
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'adminUsers', uid),
        (snap) => setAdminRecord(snap.exists() ? (snap.data() as AdminUserDoc) : null),
        (err) => handleFirestoreError(err, OperationType.GET, `adminUsers/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'sellers', uid),
        (snap) => setSellerProfile(snap.exists() ? (snap.data() as SellerProfile) : null),
        (err) => handleFirestoreError(err, OperationType.GET, `sellers/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'deliveryPartners', uid),
        (snap) => setRiderProfile(snap.exists() ? (snap.data() as DeliveryPartnerProfile) : null),
        (err) => handleFirestoreError(err, OperationType.GET, `deliveryPartners/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'sellerWallets', uid),
        (snap) => setSellerWallet(snap.exists() ? (snap.data() as WalletAccount) : null),
        (err) => handleFirestoreError(err, OperationType.GET, `sellerWallets/${uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'riderWallets', uid),
        (snap) => setRiderWallet(snap.exists() ? (snap.data() as WalletAccount) : null),
        (err) => handleFirestoreError(err, OperationType.GET, `riderWallets/${uid}`)
      )
    );

    if (isBootstrappedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'customers'),
          (snap) => setCustomers(snap.docs.map((d) => d.data() as CustomerProfile)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
        ),
        onSnapshot(
          collection(db, 'sellers'),
          (snap) => setSellers(snap.docs.map((d) => d.data() as SellerProfile)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'sellers')
        ),
        onSnapshot(
          collection(db, 'deliveryPartners'),
          (snap) => setRiders(snap.docs.map((d) => d.data() as DeliveryPartnerProfile)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'deliveryPartners')
        ),
        onSnapshot(
          collection(db, 'orders'),
          (snap) => setOrders(snap.docs.map((d) => d.data() as Order)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        ),
        onSnapshot(
          collection(db, 'deliveries'),
          (snap) => setDeliveries(snap.docs.map((d) => d.data() as Delivery)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'deliveries')
        ),
        onSnapshot(
          collection(db, 'transactions'),
          (snap) => setTransactions(snap.docs.map((d) => d.data() as LedgerTransaction)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        ),
        onSnapshot(
          collection(db, 'withdrawals'),
          (snap) => setWithdrawals(snap.docs.map((d) => d.data() as Withdrawal)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
        ),
        onSnapshot(
          collection(db, 'refunds'),
          (snap) => setRefunds(snap.docs.map((d) => d.data() as Refund)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'refunds')
        ),
        onSnapshot(
          collection(db, 'complaints'),
          (snap) => setComplaints(snap.docs.map((d) => d.data() as Complaint)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
        ),
        onSnapshot(
          collection(db, 'adminUsers'),
          (snap) => setAdminUsers(snap.docs.map((d) => d.data() as AdminUserDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'adminUsers')
        ),
        onSnapshot(
          query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc')),
          (snap) => setAuditLogs(snap.docs.map((d) => d.data() as AuditLogDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
        ),
        onSnapshot(
          collection(db, 'notifications'),
          (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    } else {
      const mergedOrders = new Map<string, Order>();
      const syncOrders = (list: Order[]) => {
        list.forEach((o) => mergedOrders.set(o.id, o));
        setOrders(Array.from(mergedOrders.values()));
      };

      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('customerUid', '==', uid)),
          (snap) => syncOrders(snap.docs.map((d) => d.data() as Order)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders:customer')
        ),
        onSnapshot(
          query(collection(db, 'orders'), where('sellerUid', '==', uid)),
          (snap) => syncOrders(snap.docs.map((d) => d.data() as Order)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders:seller')
        ),
        onSnapshot(
          query(collection(db, 'orders'), where('riderUid', '==', uid)),
          (snap) => syncOrders(snap.docs.map((d) => d.data() as Order)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders:rider')
        )
      );

      const mergedDeliveries = new Map<string, Delivery>();
      const syncDeliveries = (list: Delivery[]) => {
        list.forEach((d) => mergedDeliveries.set(d.id, d));
        setDeliveries(Array.from(mergedDeliveries.values()));
      };

      unsubs.push(
        onSnapshot(
          query(collection(db, 'deliveries'), where('status', '==', 'awaiting_rider')),
          (snap) => syncDeliveries(snap.docs.map((d) => d.data() as Delivery)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'deliveries:awaiting')
        ),
        onSnapshot(
          query(collection(db, 'deliveries'), where('riderUid', '==', uid)),
          (snap) => syncDeliveries(snap.docs.map((d) => d.data() as Delivery)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'deliveries:rider')
        ),
        onSnapshot(
          query(collection(db, 'deliveries'), where('customerUid', '==', uid)),
          (snap) => syncDeliveries(snap.docs.map((d) => d.data() as Delivery)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'deliveries:customer')
        ),
        onSnapshot(
          query(collection(db, 'withdrawals'), where('requesterUid', '==', uid)),
          (snap) => setWithdrawals(snap.docs.map((d) => d.data() as Withdrawal)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
        ),
        onSnapshot(
          query(collection(db, 'notifications'), where('targetUid', 'in', [uid, 'all'])),
          (snap) => setNotifications(snap.docs.map((d) => d.data() as NotificationItem)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, user, isBootstrappedAdmin]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Signed in successfully.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sign-in cancelled.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('Signed out.');
  };

  const ordersById = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const customerOrders = useMemo(
    () => (user ? orders.filter((o) => o.customerUid === user.uid) : []),
    [orders, user]
  );

  const sellerShops = useMemo(
    () => (user ? shops.filter((s) => s.sellerUid === user.uid) : []),
    [shops, user]
  );

  const sellerProducts = useMemo(
    () => (user ? products.filter((p) => p.sellerUid === user.uid) : []),
    [products, user]
  );

  const sellerOrders = useMemo(
    () => (user ? orders.filter((o) => o.sellerUid === user.uid) : []),
    [orders, user]
  );

  const sellerWithdrawals = useMemo(
    () => (user ? withdrawals.filter((w) => w.requesterUid === user.uid && w.requesterRole === 'seller') : []),
    [withdrawals, user]
  );

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className="text-xl font-extrabold tracking-tight text-stone-900 whitespace-nowrap shrink-0 font-display"
          >
            YouthGo
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            {(
              [
                { id: 'marketplace', label: 'Marketplace' },
                { id: 'seller', label: 'Seller' },
                { id: 'delivery', label: 'Delivery' },
                { id: 'admin', label: 'Admin' },
                { id: 'android', label: 'Android Studio' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                  activeTab === item.id
                    ? 'text-stone-900 border-b-2 border-emerald-700'
                    : 'hover:text-stone-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
              >
                Sign out ({user.displayName?.split(' ')[0] || 'Account'})
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="md:hidden px-4 pb-3 flex items-center gap-4 overflow-x-auto text-xs font-medium text-stone-600">
          {(
            [
              { id: 'marketplace', label: 'Marketplace' },
              { id: 'seller', label: 'Seller' },
              { id: 'delivery', label: 'Delivery' },
              { id: 'admin', label: 'Admin' },
              { id: 'android', label: 'Android Studio' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                activeTab === item.id ? 'text-emerald-800 font-semibold' : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-6 py-8">
        {notifications.some((n) => !n.isRead) && user && (
          <div className="mb-6 bg-white border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-700 flex items-center justify-between gap-4">
            <span>
              <strong className="text-stone-900">{notifications[0].title}</strong> · {notifications[0].body}
            </span>
            <span className="font-mono-tabular text-stone-400 shrink-0">{notifications.length} alerts</span>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <MarketplaceView
            user={user}
            countryCode={countryCode}
            onCountryChange={setCountryCode}
            products={products}
            shops={shops}
            categories={categories}
            orders={customerOrders}
            deliveries={deliveries}
            onRequireSignIn={handleSignIn}
            onToast={showToast}
          />
        )}

        {activeTab === 'seller' && (
          <SellerView
            user={user}
            sellerProfile={sellerProfile}
            sellerShops={sellerShops}
            sellerProducts={sellerProducts}
            sellerOrders={sellerOrders}
            sellerWallet={sellerWallet}
            sellerWithdrawals={sellerWithdrawals}
            categories={categories}
            onRequireSignIn={handleSignIn}
            onToast={showToast}
          />
        )}

        {activeTab === 'delivery' && (
          <RiderView
            user={user}
            isAdmin={isAdmin}
            riderProfile={riderProfile}
            deliveries={deliveries}
            ordersById={ordersById}
            riderWallet={riderWallet}
            onRequireSignIn={handleSignIn}
            onToast={showToast}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboardView
            user={user}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            customers={customers}
            sellers={sellers}
            riders={riders}
            shops={shops}
            products={products}
            categories={categories}
            orders={orders}
            deliveries={deliveries}
            transactions={transactions}
            withdrawals={withdrawals}
            refunds={refunds}
            complaints={complaints}
            countries={countries}
            currencies={currencies}
            appSettings={appSettings}
            adminUsers={adminUsers}
            auditLogs={auditLogs}
            onRequireSignIn={handleSignIn}
            onToast={showToast}
          />
        )}

        {activeTab === 'android' && <AndroidArchitectureView />}
      </main>

      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-[1320px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <span>YouthGo International Commerce & Express Delivery</span>
          <span>Markets: Bangladesh (BDT) · India (INR) · USA (USD) · UK (GBP) · Saudi Arabia (SAR)</span>
        </div>
      </footer>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900 text-white text-xs px-4 py-3 rounded-lg shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
