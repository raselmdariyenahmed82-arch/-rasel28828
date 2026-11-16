package com.youthgo.app.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId

enum class YouthGoCountry(val code: String, val currencyCode: String, val symbol: String) {
    BANGLADESH("BD", "BDT", "৳"),
    INDIA("IN", "INR", "₹"),
    USA("US", "USD", "$"),
    UK("GB", "GBP", "£"),
    SAUDI_ARABIA("SA", "SAR", "﷼");

    companion object {
        fun fromCode(code: String): YouthGoCountry =
            entries.firstOrNull { it.code == code } ?: USA
    }
}

data class UserProfile(
    @DocumentId val uid: String = "",
    val displayName: String = "",
    val email: String = "",
    val role: String = "customer",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val isActive: Boolean = true,
    val photoUrl: String? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class CustomerProfile(
    @DocumentId val uid: String = "",
    val fullName: String = "",
    val email: String = "",
    val phone: String = "",
    val countryCode: String = "US",
    val defaultAddress: String = "",
    val isActive: Boolean = true,
    val totalOrders: Int = 0,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class SellerProfile(
    @DocumentId val uid: String = "",
    val businessName: String = "",
    val ownerName: String = "",
    val email: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val verificationStatus: String = "pending",
    val kycDocumentRef: String? = null,
    val commissionRatePct: Double = 10.0,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class DeliveryPartnerProfile(
    @DocumentId val uid: String = "",
    val fullName: String = "",
    val phone: String = "",
    val countryCode: String = "US",
    val vehicleType: String = "motorbike",
    val verificationStatus: String = "pending",
    val isAvailable: Boolean = true,
    val currentLat: Double = 0.0,
    val currentLng: Double = 0.0,
    val completedDeliveries: Int = 0,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class ShopModel(
    @DocumentId val id: String = "",
    val sellerUid: String = "",
    val name: String = "",
    val category: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val city: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val approvalStatus: String = "pending",
    val isOpen: Boolean = true,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class ProductModel(
    @DocumentId val id: String = "",
    val shopId: String = "",
    val sellerUid: String = "",
    val categoryId: String = "",
    val title: String = "",
    val description: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val price: Double = 0.0,
    val stock: Int = 0,
    val imageUrl: String = "",
    val visibilityStatus: String = "active",
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class OrderModel(
    @DocumentId val id: String = "",
    val customerUid: String = "",
    val shopId: String = "",
    val sellerUid: String = "",
    val riderUid: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val subtotal: Double = 0.0,
    val deliveryFee: Double = 0.0,
    val platformCommission: Double = 0.0,
    val riderPayout: Double = 0.0,
    val sellerNet: Double = 0.0,
    val totalAmount: Double = 0.0,
    val distanceKm: Double = 1.5,
    val slaMinutes: Int = 60,
    val paymentGateway: String = "Stripe",
    val paymentStatus: String = "pending",
    val paymentReference: String = "",
    val idempotencyKey: String = "",
    val settlementApplied: Boolean = false,
    val orderStatus: String = "placed",
    val deliveryOtp: String = "",
    val deliveryAddress: String = "",
    val itemCount: Int = 1,
    val itemSummary: String = "",
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class DeliveryModel(
    @DocumentId val id: String = "",
    val orderId: String = "",
    val customerUid: String = "",
    val sellerUid: String = "",
    val riderUid: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val distanceKm: Double = 1.5,
    val slaWindowLabel: String = "1 hour (1-2 km)",
    val estimatedMinutes: Int = 60,
    val deliveryFee: Double = 0.0,
    val riderPayout: Double = 0.0,
    val status: String = "awaiting_rider",
    val pickupConfirmed: Boolean = false,
    val otpVerified: Boolean = false,
    val delayReason: String = "",
    val delayVerificationStatus: String = "none",
    val riderLat: Double = 0.0,
    val riderLng: Double = 0.0,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class WalletLedger(
    val ownerUid: String = "",
    val countryCode: String = "US",
    val currencyCode: String = "USD",
    val availableBalance: Double = 0.0,
    val pendingBalance: Double = 0.0,
    val totalEarned: Double = 0.0,
    val totalWithdrawn: Double = 0.0,
    val lastOrderId: String = "",
    val updatedAt: Timestamp? = null
)

data class AdminUserRecord(
    @DocumentId val uid: String = "",
    val email: String = "",
    val displayName: String = "",
    val role: String = "ops_admin",
    val permissions: String = "",
    val isActive: Boolean = true,
    val grantedByUid: String = "",
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

data class AuditLogRecord(
    @DocumentId val id: String = "",
    val actorUid: String = "",
    val actorEmail: String = "",
    val actorRole: String = "",
    val action: String = "",
    val targetCollection: String = "",
    val targetDocId: String = "",
    val summary: String = "",
    val createdAt: Timestamp? = null
)
