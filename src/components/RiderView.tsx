import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { COUNTRY_META, formatMoney } from '../lib/constants';
import {
  claimDeliveryAsRider,
  completeDeliveryWithOtp,
  confirmRiderPickup,
  registerDeliveryPartner,
  reportDeliveryDelay,
  requestWalletWithdrawal,
  settleOrderIdempotently,
} from '../lib/youthgoService';
import type {
  CountryCode,
  Delivery,
  DeliveryPartnerProfile,
  Order,
  WalletAccount,
} from '../types/youthgo';

interface Props {
  user: User | null;
  isAdmin: boolean;
  riderProfile: DeliveryPartnerProfile | null;
  deliveries: Delivery[];
  ordersById: Map<string, Order>;
  riderWallet: WalletAccount | null;
  onRequireSignIn: () => void;
  onToast: (msg: string) => void;
}

export const RiderView: React.FC<Props> = ({
  user,
  isAdmin,
  riderProfile,
  deliveries,
  ordersById,
  riderWallet,
  onRequireSignIn,
  onToast,
}) => {
  const [phone, setPhone] = useState('+8801700000000');
  const [countryCode, setCountryCode] = useState<CountryCode>('BD');
  const [vehicleType, setVehicleType] = useState<'bicycle' | 'motorbike' | 'ebike' | 'van'>('motorbike');
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [delayInputs, setDelayInputs] = useState<Record<string, string>>({});
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center max-w-xl mx-auto">
        <h2 className="text-xl font-bold text-stone-900">Delivery Partner Operations</h2>
        <p className="mt-2 text-sm text-stone-600">
          Sign in to claim regional dispatches, confirm pickups, verify customer OTPs, and track rider wallet payouts.
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

  const openPool = deliveries.filter((d) => d.status === 'awaiting_rider');
  const myDeliveries = deliveries.filter((d) => d.riderUid === user.uid);

  const handleRegisterRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await registerDeliveryPartner({ user, phone, countryCode, vehicleType });
      onToast('Delivery Partner profile submitted for Admin verification.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Rider registration failed');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (del: Delivery) => {
    const order = ordersById.get(del.orderId);
    if (!order) {
      onToast('Parent order record not loaded.');
      return;
    }
    const entered = otpInputs[del.id] || '';
    const ok = await completeDeliveryWithOtp(del, entered, order.deliveryOtp);
    if (!ok) {
      onToast('Invalid Customer OTP. Verify the 4-digit code with the recipient.');
      return;
    }
    if (isAdmin) {
      await settleOrderIdempotently({ ...order, orderStatus: 'delivered' }, user);
      onToast(`OTP verified & order ${order.id} idempotently settled to wallets.`);
    } else {
      onToast(`OTP verified! Delivery ${del.id} completed and queued for settlement.`);
    }
  };

  const handleRiderWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderWallet) return;
    const amt = Number(withdrawAmount);
    if (amt <= 0 || amt > riderWallet.availableBalance) {
      onToast('Invalid withdrawal amount.');
      return;
    }
    setBusy(true);
    try {
      await requestWalletWithdrawal({
        uid: user.uid,
        role: 'delivery_partner',
        countryCode: riderWallet.countryCode,
        currencyCode: riderWallet.currencyCode,
        amount: amt,
        payoutMethod: 'Mobile Wallet',
        accountMask: phone,
      });
      setWithdrawAmount('');
      onToast('Rider withdrawal requested.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to request withdrawal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs text-stone-500">Rider Verification Status</p>
          <p className="mt-1 text-lg font-bold text-stone-900">
            {riderProfile ? `${riderProfile.fullName} · ${riderProfile.vehicleType}` : 'Unregistered Courier'}
          </p>
          <p className="mt-2 text-xs text-stone-600">
            Status: <span className="font-semibold">{riderProfile?.verificationStatus || 'unregistered'}</span> · Completed:{' '}
            <span className="font-mono-tabular">{riderProfile?.completedDeliveries ?? 0}</span>
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-xs text-stone-500">Rider Wallet Balance</p>
          <p className="mt-1 text-2xl font-bold text-stone-900 font-mono-tabular">
            {riderWallet ? formatMoney(riderWallet.availableBalance, riderWallet.currencyCode) : '$0.00'}
          </p>
          <p className="mt-2 text-xs text-stone-600 font-mono-tabular">
            Total Earned: {riderWallet ? formatMoney(riderWallet.totalEarned, riderWallet.currencyCode) : '$0.00'}
          </p>
        </div>

        <form onSubmit={handleRiderWithdraw} className="bg-white border border-stone-200 rounded-xl p-6 space-y-3">
          <p className="text-xs font-semibold text-stone-900">Rider Payout Request</p>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="1"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 px-3 py-1.5 text-sm border border-stone-200 rounded-lg font-mono-tabular"
            />
            <button
              type="submit"
              disabled={busy || !riderWallet || riderWallet.availableBalance <= 0}
              className="px-4 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg disabled:opacity-40"
            >
              Withdraw
            </button>
          </div>
        </form>
      </div>

      {!riderProfile && (
        <form onSubmit={handleRegisterRider} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-stone-900">Onboard as Delivery Partner</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number"
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
            />
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as CountryCode)}
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
            >
              {(Object.keys(COUNTRY_META) as CountryCode[]).map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_META[c].name}
                </option>
              ))}
            </select>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as 'bicycle' | 'motorbike' | 'ebike' | 'van')}
              className="px-3 py-2 text-sm border border-stone-200 rounded-lg bg-white"
            >
              <option value="motorbike">Motorbike</option>
              <option value="ebike">E-Bike</option>
              <option value="bicycle">Bicycle</option>
              <option value="van">Cargo Van</option>
            </select>
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg">
            Register Delivery Profile
          </button>
        </form>
      )}

      {/* Open Dispatch Pool */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-stone-900">Available Dispatch Jobs ({openPool.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openPool.map((del) => (
            <div key={del.id} className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono-tabular text-stone-500">Order {del.orderId}</p>
                <p className="text-sm font-semibold text-stone-900 mt-0.5">
                  {del.distanceKm} km · {del.slaWindowLabel}
                </p>
                <p className="text-xs text-emerald-800 font-mono-tabular mt-1">
                  Rider Payout: {formatMoney(del.riderPayout, del.currencyCode)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  claimDeliveryAsRider(del, user.uid, del.countryCode).then(() =>
                    onToast(`Claimed delivery ${del.id} with live GPS ping.`)
                  )
                }
                className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                Accept Delivery
              </button>
            </div>
          ))}
          {openPool.length === 0 && (
            <p className="text-sm text-stone-500">No awaiting deliveries right now.</p>
          )}
        </div>
      </div>

      {/* Active Assigned Deliveries */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-stone-900">Your Active Deliveries ({myDeliveries.length})</h3>
        <div className="space-y-4">
          {myDeliveries.map((del) => {
            const parentOrder = ordersById.get(del.orderId);
            return (
              <div key={del.id} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono-tabular text-stone-500">
                      {del.id} · Order {del.orderId} · {del.status}
                    </p>
                    <p className="text-sm font-semibold text-stone-900 mt-1">
                      SLA: {del.slaWindowLabel} · Payout: {formatMoney(del.riderPayout, del.currencyCode)}
                    </p>
                    {parentOrder && (
                      <p className="text-xs text-stone-600 mt-0.5">
                        Drop-off: {parentOrder.deliveryAddress}
                      </p>
                    )}
                  </div>

                  {!del.pickupConfirmed && del.status !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => confirmRiderPickup(del).then(() => onToast('Order pickup confirmed.'))}
                      className="px-4 py-2 text-xs font-medium bg-stone-900 text-white rounded-lg"
                    >
                      Confirm Pickup
                    </button>
                  )}
                </div>

                {del.pickupConfirmed && !del.otpVerified && del.status !== 'delivered' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-stone-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpInputs[del.id] || ''}
                        onChange={(e) => setOtpInputs((prev) => ({ ...prev, [del.id]: e.target.value }))}
                        placeholder="Customer 4-digit OTP"
                        className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg font-mono-tabular"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyOtp(del)}
                        className="px-4 py-2 text-xs font-medium bg-emerald-700 text-white rounded-lg whitespace-nowrap"
                      >
                        Verify OTP & Deliver
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={delayInputs[del.id] || ''}
                        onChange={(e) => setDelayInputs((prev) => ({ ...prev, [del.id]: e.target.value }))}
                        placeholder="Traffic / Force-majeure delay reason"
                        className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const reason = delayInputs[del.id]?.trim();
                          if (reason) {
                            reportDeliveryDelay(del.id, reason).then(() =>
                              onToast('Traffic delay submitted for Admin verification.')
                            );
                          }
                        }}
                        className="px-3 py-2 text-xs font-medium border border-stone-300 text-stone-800 rounded-lg whitespace-nowrap"
                      >
                        Log Delay
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
