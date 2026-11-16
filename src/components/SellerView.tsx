import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { COUNTRY_META, formatMoney, PRODUCT_IMAGE_POOL } from '../lib/constants';
import {
  createSellerProduct,
  registerSellerAndShop,
  requestWalletWithdrawal,
  updateOrderStatus,
} from '../lib/youthgoService';
import type {
  Category,
  CountryCode,
  Order,
  Product,
  SellerProfile,
  Shop,
  WalletAccount,
  Withdrawal,
} from '../types/youthgo';

interface Props {
  user: User | null;
  sellerProfile: SellerProfile | null;
  sellerShops: Shop[];
  sellerProducts: Product[];
  sellerOrders: Order[];
  sellerWallet: WalletAccount | null;
  sellerWithdrawals: Withdrawal[];
  categories: Category[];
  onRequireSignIn: () => void;
  onToast: (msg: string) => void;
}

export const SellerView: React.FC<Props> = ({
  user,
  sellerProfile,
  sellerShops,
  sellerProducts,
  sellerOrders,
  sellerWallet,
  sellerWithdrawals,
  categories,
  onRequireSignIn,
  onToast,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('Dhaka');
  const [countryCode, setCountryCode] = useState<CountryCode>('BD');
  const [shopCategory, setShopCategory] = useState('Electronics & Lifestyle');

  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('cat_audio');
  const [price, setPrice] = useState('120');
  const [stock, setStock] = useState('15');
  const [imageKey, setImageKey] = useState<keyof typeof PRODUCT_IMAGE_POOL>('headphones');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('Bank Transfer');
  const [accountMask, setAccountMask] = useState('**** 4821');
  const [busy, setBusy] = useState(false);

  const activeShop = useMemo(
    () => sellerShops.find((s) => s.id === selectedShopId) || sellerShops[0] || null,
    [sellerShops, selectedShopId]
  );

  if (!user) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-stone-900">Seller Operations Portal</h2>
        <p className="mt-2 text-sm text-stone-600">
          Sign in with your verified account to register a regional shop, publish local-currency inventory, and manage settlements.
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

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await registerSellerAndShop({
        user,
        businessName,
        city,
        countryCode,
        category: shopCategory,
      });
      setBusinessName('');
      onToast('Seller KYC & Shop submitted for Admin verification.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Shop registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShop) return;
    setBusy(true);
    try {
      await createSellerProduct({
        sellerUid: user.uid,
        shop: activeShop,
        title,
        description,
        categoryId: categories[0]?.id || categoryId,
        price: Number(price),
        stock: Number(stock),
        imageUrl: PRODUCT_IMAGE_POOL[imageKey],
      });
      setTitle('');
      setDescription('');
      onToast(`Published product in ${activeShop.currencyCode}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setBusy(false);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerWallet) return;
    const amt = Number(withdrawAmount);
    if (amt <= 0 || amt > sellerWallet.availableBalance) {
      onToast('Withdrawal amount exceeds available seller balance.');
      return;
    }
    setBusy(true);
    try {
      await requestWalletWithdrawal({
        uid: user.uid,
        role: 'seller',
        countryCode: sellerWallet.countryCode,
        currencyCode: sellerWallet.currencyCode,
        amount: amt,
        payoutMethod,
        accountMask,
      });
      setWithdrawAmount('');
      onToast('Withdrawal request queued for Admin verification.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header & Wallet Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs text-stone-500">Seller Verification</p>
          <p className="mt-1 text-lg font-bold text-stone-900">
            {sellerProfile ? sellerProfile.businessName : 'Not Registered'}
          </p>
          <p className="mt-2 text-xs text-stone-600">
            Status: <span className="font-semibold">{sellerProfile?.verificationStatus || 'unregistered'}</span> · Commission:{' '}
            <span className="font-mono-tabular">{sellerProfile?.commissionRatePct ?? 10}%</span>
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs text-stone-500">Available Seller Wallet</p>
          <p className="mt-1 text-2xl font-bold text-stone-900 font-mono-tabular">
            {sellerWallet ? formatMoney(sellerWallet.availableBalance, sellerWallet.currencyCode) : '$0.00'}
          </p>
          <p className="mt-2 text-xs text-stone-600 font-mono-tabular">
            Lifetime Earned: {sellerWallet ? formatMoney(sellerWallet.totalEarned, sellerWallet.currencyCode) : '$0.00'}
          </p>
        </div>

        <form onSubmit={handleWithdrawal} className="bg-white border border-stone-200 rounded-xl p-6 space-y-3">
          <p className="text-xs font-semibold text-stone-900">Request Settlement Payout</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              min="1"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount"
              className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg font-mono-tabular"
            />
            <input
              type="text"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              placeholder="Method"
              className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={accountMask}
              onChange={(e) => setAccountMask(e.target.value)}
              placeholder="Account Mask"
              className="flex-1 px-3 py-1.5 text-sm border border-stone-200 rounded-lg"
            />
            <button
              type="submit"
              disabled={busy || !sellerWallet || sellerWallet.availableBalance <= 0}
              className="px-4 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg disabled:opacity-40 whitespace-nowrap"
            >
              Withdraw
            </button>
          </div>
        </form>
      </div>

      {/* Shop Onboarding or Product Creation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleRegisterShop} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-stone-900">Register New Regional Shop</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Shop / Business Name"
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as CountryCode)}
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
            >
              {(Object.keys(COUNTRY_META) as CountryCode[]).map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_META[c].name} ({COUNTRY_META[c].currencyCode})
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={shopCategory}
              onChange={(e) => setShopCategory(e.target.value)}
              placeholder="Store Category"
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
          >
            Submit Shop for Approval
          </button>

          {sellerShops.length > 0 && (
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <p className="text-xs font-medium text-stone-500">Your Registered Shops</p>
              {sellerShops.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100">
                  <span className="font-medium text-stone-900">
                    {s.name} · {s.city} ({s.countryCode}/{s.currencyCode})
                  </span>
                  <span className="text-stone-600 font-mono-tabular">{s.approvalStatus}</span>
                </div>
              ))}
            </div>
          )}
        </form>

        <form onSubmit={handleAddProduct} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-stone-900">Publish Marketplace Product</h3>
          {sellerShops.length === 0 ? (
            <p className="text-sm text-stone-500">Register a shop first to publish local-currency products.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={activeShop?.id || ''}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                >
                  {sellerShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.currencyCode})
                    </option>
                  ))}
                </select>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product Title"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product Description"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={`Price (${activeShop?.currencyCode})`}
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                />
                <input
                  type="number"
                  min="0"
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="Stock"
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                />
                <select
                  value={imageKey}
                  onChange={(e) => setImageKey(e.target.value as keyof typeof PRODUCT_IMAGE_POOL)}
                  className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                >
                  <option value="headphones">Studio Headphones</option>
                  <option value="watch">Titanium Watch</option>
                  <option value="backpack">Commuter Pack</option>
                  <option value="flask">Travel Flask</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
              >
                Publish Product
              </button>
            </>
          )}
        </form>
      </div>

      {/* Incoming Shop Orders */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-stone-900">Shop Order Fulfillment Queue</h3>
        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="py-3 px-4 font-medium">Order ID</th>
                <th className="py-3 px-4 font-medium">Summary</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Subtotal</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {sellerOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-stone-500">
                    No incoming orders for your shops yet.
                  </td>
                </tr>
              ) : (
                sellerOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-3 px-4 font-mono-tabular text-xs">{ord.id}</td>
                    <td className="py-3 px-4">{ord.itemSummary || `${ord.itemCount} item(s)`}</td>
                    <td className="py-3 px-4 text-xs font-medium">{ord.orderStatus}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      {formatMoney(ord.subtotal, ord.currencyCode)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {ord.orderStatus === 'placed' && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(ord.id, 'confirmed').then(() => onToast('Order confirmed.'))}
                          className="px-3 py-1 text-xs font-medium bg-stone-900 text-white rounded-md"
                        >
                          Confirm
                        </button>
                      )}
                      {ord.orderStatus === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateOrderStatus(ord.id, 'ready_for_pickup').then(() => onToast('Marked ready for pickup.'))
                          }
                          className="px-3 py-1 text-xs font-medium bg-emerald-700 text-white rounded-md"
                        >
                          Ready for Pickup
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seller Catalog & Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h4 className="text-sm font-bold text-stone-900 mb-3">Your Published Products ({sellerProducts.length})</h4>
          <div className="divide-y divide-stone-100 text-xs">
            {sellerProducts.map((p) => (
              <div key={p.id} className="py-2 flex items-center justify-between">
                <span className="text-stone-900 font-medium">{p.title}</span>
                <span className="font-mono-tabular text-stone-600">
                  {formatMoney(p.price, p.currencyCode)} · {p.visibilityStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h4 className="text-sm font-bold text-stone-900 mb-3">Withdrawal History</h4>
          <div className="divide-y divide-stone-100 text-xs">
            {sellerWithdrawals.length === 0 ? (
              <p className="text-stone-500">No withdrawal requests submitted.</p>
            ) : (
              sellerWithdrawals.map((w) => (
                <div key={w.id} className="py-2 flex items-center justify-between">
                  <span className="font-mono-tabular text-stone-900">
                    {formatMoney(w.amount, w.currencyCode)} · {w.payoutMethod}
                  </span>
                  <span className="text-stone-600">{w.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
