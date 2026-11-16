package com.youthgo.app.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.youthgo.app.data.model.AdminUserRecord
import com.youthgo.app.data.model.DeliveryModel
import com.youthgo.app.data.model.OrderModel
import com.youthgo.app.data.model.ProductModel
import com.youthgo.app.data.model.ShopModel
import com.youthgo.app.data.model.UserProfile
import com.youthgo.app.data.model.WalletLedger
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class YouthGoRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()

    suspend fun getCurrentProfile(): UserProfile? {
        val uid = auth.currentUser?.uid ?: return null
        return firestore.collection("users").document(uid).get().await().toObject(UserProfile::class.java)
    }

    suspend fun checkAdminAccess(): AdminUserRecord? {
        val uid = auth.currentUser?.uid ?: return null
        val snap = firestore.collection("adminUsers").document(uid).get().await()
        val record = snap.toObject(AdminUserRecord::class.java)
        return if (record != null && record.isActive) record else null
    }

    fun observeActiveProducts(countryCode: String): Flow<List<ProductModel>> = callbackFlow {
        val reg = firestore.collection("products")
            .whereEqualTo("visibilityStatus", "active")
            .whereEqualTo("countryCode", countryCode)
            .addSnapshotListener { snap, err ->
                if (err != null) {
                    close(err)
                    return@addSnapshotListener
                }
                trySend(snap?.toObjects(ProductModel::class.java) ?: emptyList())
            }
        awaitClose { reg.remove() }
    }

    fun observeApprovedShops(countryCode: String): Flow<List<ShopModel>> = callbackFlow {
        val reg = firestore.collection("shops")
            .whereEqualTo("approvalStatus", "approved")
            .whereEqualTo("countryCode", countryCode)
            .addSnapshotListener { snap, err ->
                if (err != null) {
                    close(err)
                    return@addSnapshotListener
                }
                trySend(snap?.toObjects(ShopModel::class.java) ?: emptyList())
            }
        awaitClose { reg.remove() }
    }

    suspend fun createOrderWithDelivery(
        order: OrderModel,
        delivery: DeliveryModel
    ): String {
        val orderId = order.id.ifBlank { "ord_${UUID.randomUUID().toString().take(12)}" }
        val deliveryId = delivery.id.ifBlank { "del_${UUID.randomUUID().toString().take(12)}" }
        val idempotencyKey = order.idempotencyKey.ifBlank { "idem_${UUID.randomUUID().toString().replace("-", "")}" }

        val batch = firestore.batch()
        val orderRef = firestore.collection("orders").document(orderId)
        val deliveryRef = firestore.collection("deliveries").document(deliveryId)

        batch.set(
            orderRef,
            mapOf(
                "id" to orderId,
                "customerUid" to order.customerUid,
                "shopId" to order.shopId,
                "sellerUid" to order.sellerUid,
                "riderUid" to "",
                "countryCode" to order.countryCode,
                "currencyCode" to order.currencyCode,
                "subtotal" to order.subtotal,
                "deliveryFee" to order.deliveryFee,
                "totalAmount" to order.totalAmount,
                "distanceKm" to order.distanceKm,
                "slaMinutes" to order.slaMinutes,
                "paymentGateway" to order.paymentGateway,
                "paymentStatus" to order.paymentStatus,
                "paymentReference" to order.paymentReference,
                "idempotencyKey" to idempotencyKey,
                "settlementApplied" to false,
                "orderStatus" to "placed",
                "deliveryOtp" to order.deliveryOtp,
                "deliveryAddress" to order.deliveryAddress,
                "itemCount" to order.itemCount,
                "itemSummary" to order.itemSummary,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )

        batch.set(
            deliveryRef,
            mapOf(
                "id" to deliveryId,
                "orderId" to orderId,
                "customerUid" to order.customerUid,
                "sellerUid" to order.sellerUid,
                "riderUid" to "",
                "countryCode" to order.countryCode,
                "currencyCode" to order.currencyCode,
                "distanceKm" to delivery.distanceKm,
                "slaWindowLabel" to delivery.slaWindowLabel,
                "estimatedMinutes" to delivery.estimatedMinutes,
                "deliveryFee" to delivery.deliveryFee,
                "riderPayout" to delivery.riderPayout,
                "status" to "awaiting_rider",
                "pickupConfirmed" to false,
                "otpVerified" to false,
                "delayVerificationStatus" to "none",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )

        batch.commit().await()
        return orderId
    }

    suspend fun confirmPickup(deliveryId: String, orderId: String) {
        val batch = firestore.batch()
        batch.update(
            firestore.collection("deliveries").document(deliveryId),
            mapOf(
                "pickupConfirmed" to true,
                "status" to "picked_up",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        batch.update(
            firestore.collection("orders").document(orderId),
            mapOf(
                "orderStatus" to "picked_up",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        batch.commit().await()
    }

    suspend fun verifyOtpAndCompleteDelivery(
        deliveryId: String,
        orderId: String,
        enteredOtp: String,
        expectedOtp: String
    ): Boolean {
        if (enteredOtp.trim() != expectedOtp.trim()) return false
        val batch = firestore.batch()
        batch.update(
            firestore.collection("deliveries").document(deliveryId),
            mapOf(
                "otpVerified" to true,
                "status" to "delivered",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        batch.update(
            firestore.collection("orders").document(orderId),
            mapOf(
                "orderStatus" to "delivered",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        batch.commit().await()
        return true
    }

    suspend fun fetchSellerWallet(sellerUid: String): WalletLedger? {
        val snap = firestore.collection("sellerWallets").document(sellerUid).get().await()
        return snap.toObject(WalletLedger::class.java)
    }

    suspend fun fetchRiderWallet(riderUid: String): WalletLedger? {
        val snap = firestore.collection("riderWallets").document(riderUid).get().await()
        return snap.toObject(WalletLedger::class.java)
    }

    suspend fun writeAdminAuditLog(
        action: String,
        targetCollection: String,
        targetDocId: String,
        summary: String
    ) {
        val user = auth.currentUser ?: return
        val logId = "log_${System.currentTimeMillis()}"
        firestore.collection("auditLogs").document(logId).set(
            mapOf(
                "id" to logId,
                "actorUid" to user.uid,
                "actorEmail" to (user.email ?: ""),
                "actorRole" to "admin",
                "action" to action,
                "targetCollection" to targetCollection,
                "targetDocId" to targetDocId,
                "summary" to summary,
                "createdAt" to FieldValue.serverTimestamp()
            )
        ).await()
    }
}
