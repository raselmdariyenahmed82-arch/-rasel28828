package com.youthgo.app.util

import java.text.NumberFormat
import java.util.Locale

data class DeliverySlaEstimate(
    val distanceKm: Double,
    val estimatedMinutes: Int,
    val windowLabel: String,
    val deliveryFee: Double,
    val riderPayout: Double
)

object DeliverySlaCalculator {
    /**
     * YouthGo International Delivery SLA Rules:
     * - 1–2 km: 60 minutes (1 hour)
     * - > 2 km: 90–120 minutes (1.5–2 hours)
     */
    fun calculate(
        distanceKm: Double,
        baseFee: Double,
        perKmFee: Double
    ): DeliverySlaEstimate {
        val safeDist = distanceKm.coerceAtLeast(0.5)
        val isShortRange = safeDist <= 2.0
        val estimatedMinutes = if (isShortRange) 60 else if (safeDist <= 5.0) 90 else 120
        val windowLabel = if (isShortRange) "1 hour (1-2 km)" else "1.5-2 hours (>2 km)"
        val deliveryFee = ((baseFee + safeDist * perKmFee) * 100.0).toInt() / 100.0
        val riderPayout = ((deliveryFee * 0.85) * 100.0).toInt() / 100.0
        return DeliverySlaEstimate(
            distanceKm = safeDist,
            estimatedMinutes = estimatedMinutes,
            windowLabel = windowLabel,
            deliveryFee = deliveryFee,
            riderPayout = riderPayout
        )
    }
}

object CurrencyFormatter {
    fun format(amount: Double, currencyCode: String): String {
        val locale = when (currencyCode) {
            "BDT" -> Locale("bn", "BD")
            "INR" -> Locale("en", "IN")
            "GBP" -> Locale.UK
            "SAR" -> Locale("ar", "SA")
            else -> Locale.US
        }
        val formatter = NumberFormat.getCurrencyInstance(locale)
        return try {
            formatter.currency = java.util.Currency.getInstance(currencyCode)
            formatter.format(amount)
        } catch (_: Exception) {
            "$currencyCode ${String.format(Locale.US, "%.2f", amount)}"
        }
    }
}
