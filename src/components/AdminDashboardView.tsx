import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { COUNTRY_META, formatMoney } from '../lib/constants';
import {
  adminApproveWithdrawal,
  adminGrantAdminUser,
  adminMutateDoc,
  adminSaveAppSettings,
  adminSendNotification,
  bootstrapMarketplaceData,
  settleOrderIdempotently,
} from '../lib/youthgoService';
import type {
  AdminRole,
  AdminUserDoc,
  AppSettingDoc,
  AuditLogDoc,
  Category,
  Complaint,
  CountryDoc,
  CurrencyDoc,
  CustomerProfile,
  Delivery,
  DeliveryPartnerProfile,
  LedgerTransaction,
  Order,
  Product,
  Refund,
  SellerProfile,
  Shop,
  Withdrawal,
} from '../types/youthgo';

type AdminTab =
  | 'overview'
  | 'customers'
  | 'sellers'
  | 'riders'
  | 'shops'
  | 'products'
  | 'orders'
  | 'payments'
  | 'commissions'
  | 'withdrawals'
  | 'refunds'
  | 'complaints'
  | 'countries'
  | 'currencies'
  | 'settings'
  | 'notifications'
  | 'rbac_audit';

interface Props {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  customers: CustomerProfile[];
  sellers: SellerProfile[];
  riders: DeliveryPartnerProfile[];
  shops: Shop[];
  products: Product[];
  categories: Category[];
  orders: Order[];
  deliveries: Delivery[];
  transactions: LedgerTransaction[];
  withdrawals: Withdrawal[];
  refunds: Refund[];
  complaints: Complaint[];
  countries: CountryDoc[];
  currencies: CurrencyDoc[];
  appSettings: AppSettingDoc | null;
  adminUsers: AdminUserDoc[];
  auditLogs: AuditLogDoc[];
  onRequireSignIn: () => void;
  onToast: (msg: string) => void;
}

export const AdminDashboardView: React.FC<Props> = ({
  user,
  isAdmin,
  isSuperAdmin,
  customers,
  sellers,
  riders,
  shops,
  products,
  categories,
  orders,
  deliveries,
  transactions,
  withdrawals,
  refunds,
  complaints,
  countries,
  currencies,
  appSettings,
  adminUsers,
  auditLogs,
  onRequireSignIn,
  onToast,
}) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [busy, setBusy] = useState(false);

  // Notification Composer State
  const [notifTarget, setNotifTarget] = useState('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifChannel, setNotifChannel] = useState<'order' | 'delivery' | 'wallet' | 'system' | 'promotion'>('system');

  // RBAC Admin Grant State
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('ops_admin');
  const [newAdminPerms, setNewAdminPerms] = useState('orders,shops,deliveries,complaints');

  // Settings Editor State
  const [settingsDraft, setSettingsDraft] = useState<AppSettingDoc>(
    appSettings || {
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
    }
  );

  const kpis = useMemo(() => {
    const completedOrders = orders.filter((o) => o.orderStatus === 'delivered').length;
    const cancelledOrders = orders.filter((o) => o.orderStatus === 'cancelled').length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending').length;
    const pendingComplaints = complaints.filter((c) => c.status === 'open' || c.status === 'investigating').length;

    const totalRevenueUsd = orders
      .filter((o) => o.orderStatus !== 'cancelled')
      .reduce((acc, o) => {
        const rate = COUNTRY_META[o.countryCode]?.usdRate ?? 1;
        return acc + o.totalAmount * rate;
      }, 0);

    const platformRevenueUsd = transactions
      .filter((t) => t.ledgerType === 'platform_revenue')
      .reduce((acc, t) => acc + t.amountUsd, 0);

    return {
      totalCustomers: customers.length,
      totalSellers: sellers.length,
      totalRiders: riders.length,
      totalShops: shops.length,
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      totalRevenueUsd,
      platformRevenueUsd,
      pendingWithdrawals,
      pendingComplaints,
    };
  }, [customers, sellers, riders, shops, orders, withdrawals, complaints, transactions]);

  const revenueByCountry = useMemo(() => {
    const map: Record<string, { orders: number; localTotal: number; usdTotal: number; currencyCode: string }> = {};
    orders
      .filter((o) => o.orderStatus !== 'cancelled')
      .forEach((o) => {
        if (!map[o.countryCode]) {
          map[o.countryCode] = { orders: 0, localTotal: 0, usdTotal: 0, currencyCode: o.currencyCode };
        }
        const rate = COUNTRY_META[o.countryCode]?.usdRate ?? 1;
        map[o.countryCode].orders += 1;
        map[o.countryCode].localTotal += o.totalAmount;
        map[o.countryCode].usdTotal += o.totalAmount * rate;
      });
    return map;
  }, [orders]);

  if (!user) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-stone-900">Admin Control Panel</h2>
        <p className="mt-2 text-sm text-stone-600">
          Role-Based Access Control (RBAC) protects all administrative operations. Sign in with an authorized admin account.
        </p>
        <button
          type="button"
          onClick={onRequireSignIn}
          className="mt-6 px-5 py-2.5 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-stone-900">RBAC Access Denied</h2>
        <p className="mt-2 text-sm text-stone-600">
          Signed in as <span className="font-mono-tabular font-medium">{user.email}</span>. Standard user accounts cannot self-assign admin privileges. An active Super Admin must authorize your UID inside the server-protected <span className="font-mono-tabular">adminUsers</span> registry.
        </p>
      </div>
    );
  }

  const handleBootstrap = async () => {
    setBusy(true);
    try {
      await bootstrapMarketplaceData(user);
      onToast('Bootstrapped 5 international marketplaces, currencies, settings, categories, shops, and products.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setBusy(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string }> = [
    { id: 'overview', label: '01. Overview & Reports' },
    { id: 'customers', label: '02. Customers' },
    { id: 'sellers', label: '03. Sellers' },
    { id: 'riders', label: '04. Riders & Delays' },
    { id: 'shops', label: '05. Shop Verification' },
    { id: 'products', label: '06. Products' },
    { id: 'orders', label: '07. Orders & Settlement' },
    { id: 'payments', label: '08. Payment Ledger' },
    { id: 'commissions', label: '09. Commissions' },
    { id: 'withdrawals', label: '10. Withdrawals' },
    { id: 'refunds', label: '11. Refunds' },
    { id: 'complaints', label: '12. Complaints' },
    { id: 'countries', label: '13. Countries' },
    { id: 'currencies', label: '14. Currencies' },
    { id: 'settings', label: '15. App Settings' },
    { id: 'notifications', label: '16. Notifications' },
    { id: 'rbac_audit', label: 'RBAC & Audit Logs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">YouthGo Admin Control Panel</h1>
          <p className="text-xs text-stone-500">
            Authorized Operator: {user.email} · {isSuperAdmin ? 'Super Admin' : 'Scoped Admin'} · All mutations logged to Audit Trail
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleBootstrap}
          className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? 'Syncing Firestore...' : 'Bootstrap 5-Country Marketplace Data'}
        </button>
      </div>

      {/* 10 Required Dashboard KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Customers', value: String(kpis.totalCustomers) },
          { label: 'Total Sellers', value: String(kpis.totalSellers) },
          { label: 'Delivery Partners', value: String(kpis.totalRiders) },
          { label: 'Total Shops', value: String(kpis.totalShops) },
          { label: 'Total Orders', value: String(kpis.totalOrders) },
          { label: 'Completed Orders', value: String(kpis.completedOrders) },
          { label: 'Cancelled Orders', value: String(kpis.cancelledOrders) },
          { label: 'Total GMV (USD)', value: `$${kpis.totalRevenueUsd.toFixed(2)}` },
          { label: 'Pending Withdrawals', value: String(kpis.pendingWithdrawals) },
          { label: 'Pending Complaints', value: String(kpis.pendingComplaints) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs text-stone-500 truncate">{kpi.label}</p>
            <p className="mt-1 text-xl font-bold text-stone-900 font-mono-tabular">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Workspace Split: Sidebar + Active Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 bg-white border border-stone-200 rounded-xl p-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                tab === item.id ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-9 bg-white border border-stone-200 rounded-xl p-6 overflow-x-auto">
          {tab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Reports & Multi-Currency Analytics</h2>
                <p className="text-xs text-stone-500">
                  Settled Platform Revenue: <span className="font-mono-tabular font-semibold text-stone-900">${kpis.platformRevenueUsd.toFixed(2)} USD</span>
                </p>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 px-3">Country</th>
                    <th className="py-2.5 px-3">Currency</th>
                    <th className="py-2.5 px-3 text-right">Orders</th>
                    <th className="py-2.5 px-3 text-right">Local Volume</th>
                    <th className="py-2.5 px-3 text-right">USD Equivalent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(Object.keys(COUNTRY_META) as Array<keyof typeof COUNTRY_META>).map((code) => {
                    const row = revenueByCountry[code];
                    return (
                      <tr key={code}>
                        <td className="py-2.5 px-3 font-medium text-stone-900">{COUNTRY_META[code].name}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-xs">{COUNTRY_META[code].currencyCode}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">{row?.orders || 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {formatMoney(row?.localTotal || 0, COUNTRY_META[code].currencyCode)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">${(row?.usdTotal || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Customer Account Control</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Country</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {customers.map((c) => (
                    <tr key={c.uid}>
                      <td className="py-2.5 px-3 font-medium">{c.fullName}</td>
                      <td className="py-2.5 px-3 text-xs text-stone-600">{c.email}</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{c.countryCode}</td>
                      <td className="py-2.5 px-3 text-xs">{c.isActive ? 'Active' : 'Deactivated'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'customers',
                              docId: c.uid,
                              updates: { isActive: !c.isActive },
                              actionName: c.isActive ? 'DEACTIVATE_CUSTOMER' : 'ACTIVATE_CUSTOMER',
                              summary: `${c.isActive ? 'Deactivated' : 'Activated'} customer ${c.email}`,
                            }).then(() => onToast('Customer status updated.'))
                          }
                          className="px-3 py-1 text-xs font-medium border border-stone-300 rounded-md hover:bg-stone-100"
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'sellers' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Seller Verification</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Business</th>
                    <th className="py-2 px-3">Country</th>
                    <th className="py-2 px-3">Commission</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sellers.map((s) => (
                    <tr key={s.uid}>
                      <td className="py-2.5 px-3 font-medium">{s.businessName}</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{s.countryCode} · {s.currencyCode}</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{s.commissionRatePct}%</td>
                      <td className="py-2.5 px-3 text-xs">{s.verificationStatus}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'sellers',
                              docId: s.uid,
                              updates: { verificationStatus: 'verified' },
                              actionName: 'VERIFY_SELLER',
                              summary: `Verified seller ${s.businessName}`,
                            }).then(() => onToast('Seller verified.'))
                          }
                          className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-md"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'sellers',
                              docId: s.uid,
                              updates: { verificationStatus: 'suspended' },
                              actionName: 'SUSPEND_SELLER',
                              summary: `Suspended seller ${s.businessName}`,
                            }).then(() => onToast('Seller suspended.'))
                          }
                          className="px-3 py-1 text-xs font-medium border border-stone-300 rounded-md"
                        >
                          Suspend
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'riders' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-stone-900">Delivery Partner Verification</h2>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="py-2 px-3">Rider</th>
                      <th className="py-2 px-3">Vehicle</th>
                      <th className="py-2 px-3">Country</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {riders.map((r) => (
                      <tr key={r.uid}>
                        <td className="py-2.5 px-3 font-medium">{r.fullName}</td>
                        <td className="py-2.5 px-3 text-xs">{r.vehicleType}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-xs">{r.countryCode}</td>
                        <td className="py-2.5 px-3 text-xs">{r.verificationStatus}</td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              adminMutateDoc({
                                actor: user,
                                collectionName: 'deliveryPartners',
                                docId: r.uid,
                                updates: { verificationStatus: 'verified' },
                                actionName: 'VERIFY_RIDER',
                                summary: `Verified rider ${r.fullName}`,
                              }).then(() => onToast('Rider verified.'))
                            }
                            className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-md"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              adminMutateDoc({
                                actor: user,
                                collectionName: 'deliveryPartners',
                                docId: r.uid,
                                updates: { verificationStatus: 'suspended' },
                                actionName: 'SUSPEND_RIDER',
                                summary: `Suspended rider ${r.fullName}`,
                              }).then(() => onToast('Rider suspended.'))
                            }
                            className="px-3 py-1 text-xs font-medium border border-stone-300 rounded-md"
                          >
                            Suspend
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 pt-4 border-t border-stone-200">
                <h3 className="text-base font-bold text-stone-900">Traffic / Unavoidable Delay Verification</h3>
                {deliveries.filter((d) => d.delayVerificationStatus === 'pending_review').length === 0 ? (
                  <p className="text-xs text-stone-500">No pending delivery delay claims.</p>
                ) : (
                  deliveries
                    .filter((d) => d.delayVerificationStatus === 'pending_review')
                    .map((d) => (
                      <div key={d.id} className="p-3 border border-stone-200 rounded-lg flex items-center justify-between gap-4 text-xs">
                        <div>
                          <p className="font-mono-tabular font-semibold">{d.id} · Order {d.orderId}</p>
                          <p className="text-stone-600 mt-0.5">Reason: {d.delayReason}</p>
                        </div>
                        <div className="space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              adminMutateDoc({
                                actor: user,
                                collectionName: 'deliveries',
                                docId: d.id,
                                updates: { delayVerificationStatus: 'approved_excused' },
                                actionName: 'APPROVE_DELIVERY_DELAY',
                                summary: `Excused traffic delay on delivery ${d.id}; preserved full rider payout`,
                              }).then(() => onToast('Delay excused; full rider payout preserved.'))
                            }
                            className="px-3 py-1 bg-emerald-700 text-white rounded-md"
                          >
                            Excuse & Pay Full
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              adminMutateDoc({
                                actor: user,
                                collectionName: 'deliveries',
                                docId: d.id,
                                updates: { delayVerificationStatus: 'rejected_penalty' },
                                actionName: 'REJECT_DELIVERY_DELAY',
                                summary: `Rejected unverified delay claim on ${d.id}`,
                              }).then(() => onToast('Delay claim rejected.'))
                            }
                            className="px-3 py-1 border border-stone-300 rounded-md"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {tab === 'shops' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Shop Verification</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Shop</th>
                    <th className="py-2 px-3">City / Country</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {shops.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-medium">{s.name}</td>
                      <td className="py-2.5 px-3 text-xs">{s.city} · {s.countryCode} ({s.currencyCode})</td>
                      <td className="py-2.5 px-3 text-xs">{s.approvalStatus}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'shops',
                              docId: s.id,
                              updates: { approvalStatus: 'approved' },
                              actionName: 'APPROVE_SHOP',
                              summary: `Approved shop ${s.name}`,
                            }).then(() => onToast('Shop approved.'))
                          }
                          className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-md"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'shops',
                              docId: s.id,
                              updates: { approvalStatus: 'rejected' },
                              actionName: 'REJECT_SHOP',
                              summary: `Rejected shop ${s.name}`,
                            }).then(() => onToast('Shop rejected.'))
                          }
                          className="px-3 py-1 text-xs font-medium border border-stone-300 rounded-md"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Product Moderation</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Market</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3">Visibility</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-medium">{p.title}</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{p.countryCode}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs">
                        {formatMoney(p.price, p.currencyCode)}
                      </td>
                      <td className="py-2.5 px-3 text-xs">{p.visibilityStatus}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'products',
                              docId: p.id,
                              updates: { visibilityStatus: p.visibilityStatus === 'active' ? 'hidden' : 'active' },
                              actionName: 'TOGGLE_PRODUCT_VISIBILITY',
                              summary: `Changed product ${p.title} visibility`,
                            }).then(() => onToast('Product visibility updated.'))
                          }
                          className="px-3 py-1 text-xs border border-stone-300 rounded-md"
                        >
                          {p.visibilityStatus === 'active' ? 'Hide' : 'Restore'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'products',
                              docId: p.id,
                              updates: { visibilityStatus: 'removed' },
                              actionName: 'REMOVE_PRODUCT',
                              summary: `Removed product ${p.title}`,
                            }).then(() => onToast('Product removed.'))
                          }
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded-md"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Order Observation & Idempotent Settlement</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Gateway</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Settled</th>
                    <th className="py-2 px-3 text-right">Total</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{o.id}</td>
                      <td className="py-2.5 px-3 text-xs">{o.paymentGateway} · {o.paymentStatus}</td>
                      <td className="py-2.5 px-3 text-xs font-medium">{o.orderStatus}</td>
                      <td className="py-2.5 px-3 text-xs font-mono-tabular">{o.settlementApplied ? 'Yes' : 'No'}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs">
                        {formatMoney(o.totalAmount, o.currencyCode)}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {o.orderStatus === 'delivered' && !o.settlementApplied && (
                          <button
                            type="button"
                            onClick={() =>
                              settleOrderIdempotently(o, user).then((done) =>
                                onToast(done ? `Settled ${o.id} to Seller, Rider & Platform ledgers.` : 'Already settled.')
                              )
                            }
                            className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-md"
                          >
                            Settle Wallets
                          </button>
                        )}
                        {o.orderStatus !== 'cancelled' && o.orderStatus !== 'delivered' && (
                          <button
                            type="button"
                            onClick={() =>
                              adminMutateDoc({
                                actor: user,
                                collectionName: 'orders',
                                docId: o.id,
                                updates: { orderStatus: 'cancelled' },
                                actionName: 'CANCEL_ORDER',
                                summary: `Cancelled order ${o.id}`,
                              }).then(() => onToast('Order cancelled.'))
                            }
                            className="px-3 py-1 text-xs border border-stone-300 rounded-md"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Idempotent Financial Ledger ({transactions.length})</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Tx ID</th>
                    <th className="py-2 px-3">Ledger</th>
                    <th className="py-2 px-3">Idempotency Key</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{t.id}</td>
                      <td className="py-2.5 px-3 text-xs">{t.ledgerType} ({t.direction})</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs text-stone-500">{t.idempotencyKey}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs">
                        {formatMoney(t.amount, t.currencyCode)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs">${t.amountUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'commissions' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Category & Seller Commission Rates</h2>
              <div className="divide-y divide-stone-100">
                {categories.map((cat) => (
                  <div key={cat.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-stone-900">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular text-xs text-stone-600">Current: {cat.commissionPct}%</span>
                      <button
                        type="button"
                        onClick={() =>
                          adminMutateDoc({
                            actor: user,
                            collectionName: 'categories',
                            docId: cat.id,
                            updates: { commissionPct: cat.commissionPct >= 15 ? 8 : cat.commissionPct + 2 },
                            actionName: 'UPDATE_CATEGORY_COMMISSION',
                            summary: `Updated ${cat.name} commission rate`,
                          }).then(() => onToast('Commission rate updated.'))
                        }
                        className="px-3 py-1 text-xs border border-stone-300 rounded-md"
                      >
                        Adjust (+2% / Reset 8%)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'withdrawals' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Withdrawal Verification Queue</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Requester</th>
                    <th className="py-2 px-3">Method</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="py-2.5 px-3 text-xs font-mono-tabular">{w.requesterRole} · {w.requesterUid}</td>
                      <td className="py-2.5 px-3 text-xs">{w.payoutMethod} ({w.accountMask})</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-xs">
                        {formatMoney(w.amount, w.currencyCode)}
                      </td>
                      <td className="py-2.5 px-3 text-xs">{w.status}</td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        {w.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                adminApproveWithdrawal({
                                  actor: user,
                                  withdrawalId: w.id,
                                  requesterUid: w.requesterUid,
                                  requesterRole: w.requesterRole,
                                  amount: w.amount,
                                  countryCode: w.countryCode,
                                  currencyCode: w.currencyCode,
                                  approve: true,
                                }).then(() => onToast('Withdrawal settled & wallet debited.'))
                              }
                              className="px-3 py-1 text-xs bg-emerald-700 text-white rounded-md"
                            >
                              Approve & Settle
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                adminApproveWithdrawal({
                                  actor: user,
                                  withdrawalId: w.id,
                                  requesterUid: w.requesterUid,
                                  requesterRole: w.requesterRole,
                                  amount: w.amount,
                                  countryCode: w.countryCode,
                                  currencyCode: w.currencyCode,
                                  approve: false,
                                }).then(() => onToast('Withdrawal rejected.'))
                              }
                              className="px-3 py-1 text-xs border border-stone-300 rounded-md"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'refunds' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Refund Management</h2>
              {refunds.map((r) => (
                <div key={r.id} className="p-4 border border-stone-200 rounded-lg flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-mono-tabular font-semibold">
                      Order {r.orderId} · {formatMoney(r.amount, r.currencyCode)} · {r.status}
                    </p>
                    <p className="text-stone-600 mt-1">{r.reason}</p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          adminMutateDoc({
                            actor: user,
                            collectionName: 'refunds',
                            docId: r.id,
                            updates: { status: 'processed', reviewedByUid: user.uid },
                            actionName: 'PROCESS_REFUND',
                            summary: `Processed refund ${r.id} for order ${r.orderId}`,
                          }).then(() => onToast('Refund processed.'))
                        }
                        className="px-3 py-1 bg-emerald-700 text-white rounded-md"
                      >
                        Process Refund
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          adminMutateDoc({
                            actor: user,
                            collectionName: 'refunds',
                            docId: r.id,
                            updates: { status: 'rejected', reviewedByUid: user.uid },
                            actionName: 'REJECT_REFUND',
                            summary: `Rejected refund ${r.id}`,
                          }).then(() => onToast('Refund rejected.'))
                        }
                        className="px-3 py-1 border border-stone-300 rounded-md"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {refunds.length === 0 && <p className="text-xs text-stone-500">No refund requests.</p>}
            </div>
          )}

          {tab === 'complaints' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Complaint Resolution</h2>
              {complaints.map((c) => (
                <div key={c.id} className="p-4 border border-stone-200 rounded-lg flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-stone-900">
                      {c.subject} · {c.status}
                    </p>
                    <p className="text-stone-600 mt-1">{c.description}</p>
                  </div>
                  {(c.status === 'open' || c.status === 'investigating') && (
                    <button
                      type="button"
                      onClick={() =>
                        adminMutateDoc({
                          actor: user,
                          collectionName: 'complaints',
                          docId: c.id,
                          updates: { status: 'resolved', resolutionNote: 'Resolved by YouthGo Operations' },
                          actionName: 'RESOLVE_COMPLAINT',
                          summary: `Resolved complaint ${c.id}: ${c.subject}`,
                        }).then(() => onToast('Complaint marked resolved.'))
                      }
                      className="px-3 py-1 bg-emerald-700 text-white rounded-md whitespace-nowrap"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
              {complaints.length === 0 && <p className="text-xs text-stone-500">No active complaints.</p>}
            </div>
          )}

          {tab === 'countries' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Country Marketplace Configuration</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Country</th>
                    <th className="py-2 px-3">Currency</th>
                    <th className="py-2 px-3">Gateways</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {countries.map((c) => (
                    <tr key={c.code}>
                      <td className="py-2.5 px-3 font-medium">{c.name} ({c.code})</td>
                      <td className="py-2.5 px-3 font-mono-tabular text-xs">{c.currencyCode}</td>
                      <td className="py-2.5 px-3 text-xs text-stone-600">{c.paymentGateways}</td>
                      <td className="py-2.5 px-3 text-xs">{c.isEnabled ? 'Enabled' : 'Disabled'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            adminMutateDoc({
                              actor: user,
                              collectionName: 'countries',
                              docId: c.code,
                              updates: { isEnabled: !c.isEnabled },
                              actionName: 'TOGGLE_COUNTRY',
                              summary: `${c.isEnabled ? 'Disabled' : 'Enabled'} ${c.name} marketplace`,
                            }).then(() => onToast('Country setting updated.'))
                          }
                          className="px-3 py-1 text-xs border border-stone-300 rounded-md"
                        >
                          {c.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'currencies' && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-900">Multi-Currency Exchange Rates</h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3 text-right">USD Rate</th>
                    <th className="py-2 px-3">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {currencies.map((cur) => (
                    <tr key={cur.code}>
                      <td className="py-2.5 px-3 font-mono-tabular font-semibold">{cur.code}</td>
                      <td className="py-2.5 px-3">{cur.name}</td>
                      <td className="py-2.5 px-3 font-mono-tabular">{cur.symbol}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">{cur.usdRate}</td>
                      <td className="py-2.5 px-3 text-xs">{cur.isActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'settings' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adminSaveAppSettings(user, settingsDraft).then(() => onToast('Global app settings saved.'));
              }}
              className="space-y-4 max-w-lg"
            >
              <h2 className="text-lg font-bold text-stone-900">Global Operational Settings</h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="block">
                  1–2 km SLA (minutes)
                  <input
                    type="number"
                    value={settingsDraft.shortDistanceSlaMinutes}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, shortDistanceSlaMinutes: Number(e.target.value) })
                    }
                    className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg font-mono-tabular"
                  />
                </label>
                <label className="block">
                  Default Commission (%)
                  <input
                    type="number"
                    value={settingsDraft.defaultPlatformCommissionPct}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, defaultPlatformCommissionPct: Number(e.target.value) })
                    }
                    className="mt-1 w-full px-3 py-2 border border-stone-200 rounded-lg font-mono-tabular"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={settingsDraft.requireDeliveryOtp}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, requireDeliveryOtp: e.target.checked })}
                />
                Require 4-digit Customer OTP before Delivery Completion
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={settingsDraft.requireAppCheck}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, requireAppCheck: e.target.checked })}
                />
                Enforce Firebase App Check Attestation
              </label>
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg">
                Save App Settings
              </button>
            </form>
          )}

          {tab === 'notifications' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                adminSendNotification({
                  actor: user,
                  targetUid: notifTarget,
                  title: notifTitle,
                  body: notifBody,
                  channel: notifChannel,
                }).then(() => {
                  setNotifTitle('');
                  setNotifBody('');
                  onToast('FCM notification queued.');
                });
              }}
              className="space-y-4 max-w-lg"
            >
              <h2 className="text-lg font-bold text-stone-900">FCM Notification Broadcast</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={notifTarget}
                  onChange={(e) => setNotifTarget(e.target.value)}
                  placeholder="Target UID or 'all'"
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
                />
                <select
                  value={notifChannel}
                  onChange={(e) =>
                    setNotifChannel(e.target.value as 'order' | 'delivery' | 'wallet' | 'system' | 'promotion')
                  }
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                >
                  <option value="system">System</option>
                  <option value="order">Order</option>
                  <option value="delivery">Delivery</option>
                  <option value="wallet">Wallet</option>
                  <option value="promotion">Promotion</option>
                </select>
              </div>
              <input
                type="text"
                required
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Notification Title"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
              <textarea
                required
                rows={3}
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                placeholder="Message body dispatched via Cloud Functions & FCM..."
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
              <button type="submit" className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg">
                Send Push Notification
              </button>
            </form>
          )}

          {tab === 'rbac_audit' && (
            <div className="space-y-8">
              {isSuperAdmin && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    adminGrantAdminUser({
                      actor: user,
                      uid: newAdminUid,
                      email: newAdminEmail,
                      displayName: newAdminName,
                      role: newAdminRole,
                      permissions: newAdminPerms,
                    }).then(() => {
                      setNewAdminUid('');
                      setNewAdminEmail('');
                      setNewAdminName('');
                      onToast('Admin RBAC role granted.');
                    });
                  }}
                  className="space-y-3 pb-6 border-b border-stone-200"
                >
                  <h2 className="text-lg font-bold text-stone-900">Authorize Admin Operator (RBAC)</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      placeholder="Firebase Auth UID"
                      className="px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                    />
                    <input
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="Verified Google Email"
                      className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Display Name"
                      className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
                    />
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                      className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                    >
                      <option value="ops_admin">ops_admin</option>
                      <option value="finance_admin">finance_admin</option>
                      <option value="support_admin">support_admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newAdminPerms}
                    onChange={(e) => setNewAdminPerms(e.target.value)}
                    placeholder="Comma-separated permissions"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                  />
                  <button type="submit" className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg">
                    Grant Scoped Admin Access
                  </button>
                </form>
              )}

              <div>
                <h3 className="text-sm font-bold text-stone-900 mb-2">Active Admin Operators ({adminUsers.length})</h3>
                <div className="divide-y divide-stone-100 text-xs mb-6">
                  {adminUsers.map((a) => (
                    <div key={a.uid} className="py-2 flex items-center justify-between">
                      <span>{a.displayName} ({a.email}) · {a.role}</span>
                      <span className="font-mono-tabular text-stone-500">{a.permissions}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-sm font-bold text-stone-900 mb-2">Immutable Admin Audit Logs ({auditLogs.length})</h3>
                <div className="divide-y divide-stone-100 text-xs">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="font-mono-tabular font-semibold text-stone-900">{log.action}</span>
                        <span className="text-stone-400 mx-1.5">·</span>
                        <span className="text-stone-700">{log.summary}</span>
                      </div>
                      <span className="font-mono-tabular text-stone-500 shrink-0">
                        {log.actorEmail} · {log.targetCollection}/{log.targetDocId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
