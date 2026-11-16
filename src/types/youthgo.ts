export type CountryCode = 'BD' | 'IN' | 'US' | 'GB' | 'SA';
export type CurrencyCode = 'BDT' | 'INR' | 'USD' | 'GBP' | 'SAR';
export type UserRole = 'customer' | 'seller' | 'delivery_partner' | 'admin';
export type AdminRole = 'super_admin' | 'ops_admin' | 'finance_admin' | 'support_admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  isActive: boolean;
  photoUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomerProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  countryCode: CountryCode;
  defaultAddress?: string;
  isActive: boolean;
  totalOrders: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SellerProfile {
  uid: string;
  businessName: string;
  ownerName: string;
  email: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended';
  kycDocumentRef?: string;
  commissionRatePct: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeliveryPartnerProfile {
  uid: string;
  fullName: string;
  phone: string;
  countryCode: CountryCode;
  vehicleType: 'bicycle' | 'motorbike' | 'ebike' | 'van';
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended';
  isAvailable: boolean;
  currentLat?: number;
  currentLng?: number;
  completedDeliveries: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Shop {
  id: string;
  sellerUid: string;
  name: string;
  category: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  city: string;
  lat?: number;
  lng?: number;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  isOpen: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  shopId: string;
  sellerUid: string;
  categoryId: string;
  title: string;
  description?: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  price: number;
  stock: number;
  imageUrl?: string;
  visibilityStatus: 'active' | 'hidden' | 'removed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  commissionPct: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Order {
  id: string;
  customerUid: string;
  shopId: string;
  sellerUid: string;
  riderUid?: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  subtotal: number;
  deliveryFee: number;
  platformCommission?: number;
  riderPayout?: number;
  sellerNet?: number;
  totalAmount: number;
  distanceKm: number;
  slaMinutes: number;
  paymentGateway: string;
  paymentStatus: 'pending' | 'verified' | 'failed' | 'refunded';
  paymentReference?: string;
  idempotencyKey: string;
  settlementApplied: boolean;
  orderStatus: 'placed' | 'confirmed' | 'ready_for_pickup' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  deliveryOtp: string;
  deliveryAddress: string;
  itemCount: number;
  itemSummary?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Delivery {
  id: string;
  orderId: string;
  customerUid: string;
  sellerUid: string;
  riderUid?: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  distanceKm: number;
  slaWindowLabel: string;
  estimatedMinutes: number;
  deliveryFee: number;
  riderPayout: number;
  status: 'awaiting_rider' | 'assigned' | 'picked_up' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled';
  pickupConfirmed: boolean;
  otpVerified: boolean;
  delayReason?: string;
  delayVerificationStatus: 'none' | 'pending_review' | 'approved_excused' | 'rejected_penalty';
  riderLat?: number;
  riderLng?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LedgerTransaction {
  id: string;
  idempotencyKey: string;
  orderId?: string;
  targetUid: string;
  ledgerType: 'seller_wallet' | 'rider_wallet' | 'platform_revenue' | 'gateway_charge' | 'refund' | 'withdrawal';
  direction: 'credit' | 'debit';
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  amount: number;
  amountUsd: number;
  gateway: string;
  gatewaySignature?: string;
  status: 'pending' | 'verified' | 'settled' | 'failed';
  createdAt?: unknown;
}

export interface WalletAccount {
  sellerUid?: string;
  riderUid?: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  lastOrderId?: string;
  updatedAt?: unknown;
}

export interface Withdrawal {
  id: string;
  requesterUid: string;
  requesterRole: 'seller' | 'delivery_partner';
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  amount: number;
  payoutMethod: string;
  accountMask: string;
  status: 'pending' | 'approved' | 'settled' | 'rejected';
  reviewedByUid?: string;
  gatewayPayoutRef?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Refund {
  id: string;
  orderId: string;
  customerUid: string;
  countryCode: CountryCode;
  currencyCode: CurrencyCode;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  reviewedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Complaint {
  id: string;
  reporterUid: string;
  reporterRole: 'customer' | 'seller' | 'delivery_partner';
  orderId?: string;
  subject: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolutionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  targetUid: string;
  title: string;
  body: string;
  channel: 'order' | 'delivery' | 'wallet' | 'system' | 'promotion';
  isRead: boolean;
  createdAt?: unknown;
}

export interface CountryDoc {
  code: CountryCode;
  name: string;
  currencyCode: CurrencyCode;
  paymentGateways: string;
  baseDeliveryFee: number;
  perKmFee: number;
  defaultCommissionPct: number;
  isEnabled: boolean;
  updatedAt?: unknown;
}

export interface CurrencyDoc {
  code: CurrencyCode;
  name: string;
  symbol: string;
  usdRate: number;
  decimalPlaces: number;
  isActive: boolean;
  updatedAt?: unknown;
}

export interface AppSettingDoc {
  id: string;
  shortDistanceKmMax: number;
  shortDistanceSlaMinutes: number;
  longDistanceSlaMinMinutes: number;
  longDistanceSlaMaxMinutes: number;
  defaultPlatformCommissionPct: number;
  minWithdrawalUsd: number;
  requireDeliveryOtp: boolean;
  requireAppCheck: boolean;
  maintenanceMode: boolean;
  updatedAt?: unknown;
}

export interface AdminUserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: string;
  isActive: boolean;
  grantedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogDoc {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetDocId: string;
  summary: string;
  createdAt?: unknown;
}
