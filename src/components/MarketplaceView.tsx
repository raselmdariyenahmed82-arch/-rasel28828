import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { Package, ShoppingBag, ShieldCheck, Truck, X } from 'lucide-react';
import { COUNTRY_META, formatMoney, HERO_IMAGE_URL } from '../lib/constants';
import {
  placeCustomerOrder,
  submitComplaint,
  submitRefundRequest,
} from '../lib/youthgoService';
import type {
  Category,
  CountryCode,
  Delivery,
  Order,
  Product,
  Shop,
} from '../types/youthgo';

interface Props {
  user: User | null;
  countryCode: CountryCode;
  onCountryChange: (code: CountryCode) => void;
  products: Product[];
  shops: Shop[];
  categories: Category[];
  orders: Order[];
  deliveries: Delivery[];
  onRequireSignIn: () => void;
  onToast: (msg: string) => void;
}

export const MarketplaceView: React.FC<Props> = ({
  user,
  countryCode,
  onCountryChange,
  products,
  shops,
  categories,
  orders,
  deliveries,
  onRequireSignIn,
  onToast,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [distanceKm, setDistanceKm] = useState(1.6);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedGateway, setSelectedGateway] = useState<string>(COUNTRY_META[countryCode].gateways[0]);
  const [submitting, setSubmitting] = useState(false);

  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [complaintOrderId, setComplaintOrderId] = useState<string | null>(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');

  const meta = COUNTRY_META[countryCode];

  const countryProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.countryCode !== countryCode || p.visibilityStatus !== 'active') return false;
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, countryCode, selectedCategory, searchQuery]);

  const shopById = useMemo(() => {
    const map = new Map<string, Shop>();
    shops.forEach((s) => map.set(s.id, s));
    return map;
  }, [shops]);

  const deliveryByOrderId = useMemo(() => {
    const map = new Map<string, Delivery>();
    deliveries.forEach((d) => map.set(d.orderId, d));
    return map;
  }, [deliveries]);

  const estimatedDeliveryFee = useMemo(() => {
    const safeDist = Math.max(0.5, distanceKm);
    return Number((meta.baseDeliveryFee + safeDist * meta.perKmFee).toFixed(2));
  }, [distanceKm, meta]);

  const estimatedSlaLabel = distanceKm <= 2 ? '1 hour (1-2 km)' : '1.5-2 hours (>2 km)';

  const openCheckout = (product: Product) => {
    if (!user) {
      onRequireSignIn();
      return;
    }
    setCheckoutProduct(product);
    setQuantity(1);
    setDistanceKm(1.6);
    setDeliveryAddress(`${meta.defaultCity}, Sector 4, Road 12`);
    setSelectedGateway(meta.gateways[0]);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !checkoutProduct) return;
    setSubmitting(true);
    try {
      const result = await placeCustomerOrder({
        customerUid: user.uid,
        product: checkoutProduct,
        quantity,
        distanceKm,
        deliveryAddress,
        paymentGateway: selectedGateway,
      });
      setCheckoutProduct(null);
      onToast(`Order ${result.orderId} confirmed via ${selectedGateway}. Delivery OTP: ${result.otp}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrder || !refundReason.trim()) return;
    setSubmitting(true);
    try {
      await submitRefundRequest({ order: refundOrder, reason: refundReason });
      setRefundOrder(null);
      setRefundReason('');
      onToast('Refund request submitted for admin review.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to submit refund');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !complaintSubject.trim() || !complaintDesc.trim()) return;
    setSubmitting(true);
    try {
      await submitComplaint({
        reporterUid: user.uid,
        reporterRole: 'customer',
        orderId: complaintOrderId || undefined,
        subject: complaintSubject,
        description: complaintDesc,
      });
      setComplaintOrderId(null);
      setComplaintSubject('');
      setComplaintDesc('');
      onToast('Complaint logged for support team.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to file complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
              {meta.name} · {meta.currencyCode} ({meta.symbol}) · {meta.gateways.join(' / ')}
            </p>
            <h1 className="mt-4 text-3xl lg:text-5xl font-bold tracking-tight text-stone-900 text-balance">
              Local-currency commerce with verified 1–2 hour urban dispatch.
            </h1>
            <p className="mt-4 text-base text-stone-600 max-w-xl leading-relaxed">
              Shop verified regional storefronts across Bangladesh, India, the United States, the UK, and Saudi Arabia. Every order settles in local currency with OTP-verified delivery handoff.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-wrap items-center gap-6 text-sm text-stone-600">
            <div>
              <span className="block text-xs text-stone-400">1–2 km Zone</span>
              <span className="font-semibold text-stone-900 font-mono-tabular">60 min SLA</span>
            </div>
            <div>
              <span className="block text-xs text-stone-400">2+ km Zone</span>
              <span className="font-semibold text-stone-900 font-mono-tabular">90–120 min SLA</span>
            </div>
            <div>
              <span className="block text-xs text-stone-400">Active Marketplace</span>
              <span className="font-semibold text-stone-900">{meta.defaultCity} Hub</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[280px] bg-stone-100">
          <img
            src={HERO_IMAGE_URL}
            alt="YouthGo courier completing an urban storefront delivery"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover lg:absolute lg:inset-0"
          />
        </div>
      </section>

      {/* Country & Category Toolbar */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg">
            {(Object.keys(COUNTRY_META) as CountryCode[]).map((code) => {
              const item = COUNTRY_META[code];
              const active = code === countryCode;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onCountryChange(code)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {item.name} · {item.currencyCode}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${meta.name} catalog...`}
              className="px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === 'all' ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === cat.id ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {countryProducts.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
            <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto" />
            <h2 className="mt-3 text-base font-semibold text-stone-900">
              No active products in {meta.name} yet
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Sign in as Admin and run Bootstrap International Marketplace Data from the Admin tab, or add items from the Seller panel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {countryProducts.map((product) => {
              const shop = shopById.get(product.shopId);
              return (
                <article
                  key={product.id}
                  className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="aspect-[4/3] bg-stone-100 relative overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 text-stone-500">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-stone-500 truncate">
                        {shop?.name || 'Verified Store'} · {shop?.city || meta.defaultCity} · {product.stock} in stock
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold text-stone-900">{product.title}</h3>
                      <p className="mt-1 text-sm text-stone-600 line-clamp-2">{product.description}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-3 border-t border-stone-100 flex items-center justify-between gap-4">
                    <span className="text-base font-bold text-stone-900 font-mono-tabular">
                      {formatMoney(product.price, product.currencyCode)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCheckout(product)}
                      className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      Order Now
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Customer Orders & Live OTP Tracking */}
      {user && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900">Your Orders & Delivery Tracking</h2>
              <p className="text-sm text-stone-500">
                Share the 4-digit OTP with your delivery partner upon handoff.
              </p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-8 text-sm text-stone-500">
              You have not placed any orders yet. Select any item above to test real multi-currency checkout.
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-3 px-4 font-medium">Order</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium">SLA & Distance</th>
                    <th className="py-3 px-4 font-medium">Payment</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Delivery OTP</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                    <th className="py-3 px-4 font-medium text-right">Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {orders.map((ord) => {
                    const del = deliveryByOrderId.get(ord.id);
                    return (
                      <tr key={ord.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4 font-mono-tabular text-xs text-stone-700">{ord.id}</td>
                        <td className="py-3 px-4 text-stone-900">{ord.itemSummary || `${ord.itemCount} item(s)`}</td>
                        <td className="py-3 px-4 text-xs text-stone-600 font-mono-tabular">
                          {ord.distanceKm} km · {ord.slaMinutes} min
                          {del?.riderLat ? ` · GPS ${del.riderLat.toFixed(3)}, ${del.riderLng?.toFixed(3)}` : ''}
                        </td>
                        <td className="py-3 px-4 text-xs text-stone-700">
                          {ord.paymentGateway} · {ord.paymentStatus}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-stone-900">
                          {ord.orderStatus}
                          {del?.delayReason ? ` (Delay: ${del.delayReason})` : ''}
                        </td>
                        <td className="py-3 px-4 font-mono-tabular font-semibold text-emerald-800">
                          {ord.deliveryOtp}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-stone-900">
                          {formatMoney(ord.totalAmount, ord.currencyCode)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => setRefundOrder(ord)}
                            className="text-xs font-medium text-stone-600 hover:text-stone-900 underline"
                          >
                            Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => setComplaintOrderId(ord.id)}
                            className="text-xs font-medium text-stone-600 hover:text-stone-900 underline"
                          >
                            Report
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Checkout Drawer */}
      {checkoutProduct && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 flex flex-col justify-between border-l border-stone-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <h3 className="text-lg font-bold text-stone-900">Verified Checkout</h3>
                <button
                  type="button"
                  onClick={() => setCheckoutProduct(null)}
                  className="p-2 text-stone-500 hover:text-stone-900"
                  aria-label="Close checkout"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="mt-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{checkoutProduct.title}</p>
                  <p className="text-xs text-stone-500 font-mono-tabular">
                    Unit price: {formatMoney(checkoutProduct.price, checkoutProduct.currencyCode)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-medium text-stone-700">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="mt-1 w-full px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                    />
                  </label>
                  <label className="block text-xs font-medium text-stone-700">
                    Distance (km)
                    <input
                      type="number"
                      step="0.5"
                      min={0.5}
                      max={25}
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(Math.max(0.5, Number(e.target.value)))}
                      className="mt-1 w-full px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                    />
                  </label>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Estimated Dispatch SLA: <strong className="font-mono-tabular">{estimatedSlaLabel}</strong></span>
                </div>

                <label className="block text-xs font-medium text-stone-700">
                  Delivery Address
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
                  />
                </label>

                <label className="block text-xs font-medium text-stone-700">
                  Local Payment Gateway ({meta.name})
                  <select
                    value={selectedGateway}
                    onChange={(e) => setSelectedGateway(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
                  >
                    {meta.gateways.map((gw) => (
                      <option key={gw} value={gw}>
                        {gw} ({meta.currencyCode})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="pt-4 border-t border-stone-200 space-y-2 text-sm">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span className="font-mono-tabular">
                      {formatMoney(checkoutProduct.price * quantity, checkoutProduct.currencyCode)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Delivery Fee ({distanceKm} km)</span>
                    <span className="font-mono-tabular">
                      {formatMoney(estimatedDeliveryFee, checkoutProduct.currencyCode)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-stone-900 pt-2 border-t border-stone-200">
                    <span>Total Payable</span>
                    <span className="font-mono-tabular">
                      {formatMoney(
                        checkoutProduct.price * quantity + estimatedDeliveryFee,
                        checkoutProduct.currencyCode
                      )}
                    </span>
                  </div>
                </div>
              </form>
            </div>

            <div className="pt-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>HMAC-verified gateway intent with order idempotency key.</span>
              </div>
              <button
                type="submit"
                form="checkout-form"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? 'Verifying Payment...' : `Pay with ${selectedGateway}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundOrder && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 flex items-center justify-center p-4">
          <form onSubmit={handleRefundSubmit} className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">Request Refund · {refundOrder.id}</h3>
            <p className="text-xs text-stone-500 font-mono-tabular">
              Amount: {formatMoney(refundOrder.totalAmount, refundOrder.currencyCode)}
            </p>
            <textarea
              required
              minLength={5}
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain why you are requesting a refund..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRefundOrder(null)} className="px-4 py-2 text-xs font-medium text-stone-600">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg">
                Submit Refund
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complaint Modal */}
      {complaintOrderId && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 flex items-center justify-center p-4">
          <form onSubmit={handleComplaintSubmit} className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-stone-900">File Service Complaint · {complaintOrderId}</h3>
            <input
              type="text"
              required
              value={complaintSubject}
              onChange={(e) => setComplaintSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <textarea
              required
              minLength={5}
              rows={3}
              value={complaintDesc}
              onChange={(e) => setComplaintDesc(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setComplaintOrderId(null)} className="px-4 py-2 text-xs font-medium text-stone-600">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg">
                Submit Complaint
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
