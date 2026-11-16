package com.youthgo.app

import com.youthgo.app.util.CurrencyFormatter
import com.youthgo.app.util.DeliverySlaCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliverySlaAndCurrencyTest {

    @Test
    fun shortDistanceDeliveryReturns60MinuteSla() {
        val estimate = DeliverySlaCalculator.calculate(distanceKm = 1.5, baseFee = 2.0, perKmFee = 0.8)
        assertEquals(60, estimate.estimatedMinutes)
        assertTrue(estimate.windowLabel.contains("1 hour"))
    }

    @Test
    fun longDistanceDeliveryReturns90To120MinuteSla() {
        val estimateMid = DeliverySlaCalculator.calculate(distanceKm = 3.5, baseFee = 2.0, perKmFee = 0.8)
        val estimateFar = DeliverySlaCalculator.calculate(distanceKm = 7.0, baseFee = 2.0, perKmFee = 0.8)
        assertEquals(90, estimateMid.estimatedMinutes)
        assertEquals(120, estimateFar.estimatedMinutes)
    }

    @Test
    fun currencyFormatterFormatsSupportedCurrencies() {
        val usd = CurrencyFormatter.format(49.5, "USD")
        val bdt = CurrencyFormatter.format(1250.0, "BDT")
        assertTrue(usd.contains("49.50"))
        assertTrue(bdt.isNotBlank())
    }
}
