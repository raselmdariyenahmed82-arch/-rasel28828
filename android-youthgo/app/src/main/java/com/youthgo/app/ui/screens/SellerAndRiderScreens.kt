package com.youthgo.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.youthgo.app.data.model.DeliveryModel
import com.youthgo.app.data.model.OrderModel
import com.youthgo.app.data.model.WalletLedger
import com.youthgo.app.util.CurrencyFormatter

@Composable
fun SellerPanelScreen(
    orders: List<OrderModel>,
    wallet: WalletLedger?,
    onConfirmOrder: (String) -> Unit,
    onReadyForPickup: (String) -> Unit,
    onRequestWithdrawal: (Double) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Seller Operations", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(12.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Seller Wallet", style = MaterialTheme.typography.titleMedium)
                val balanceText = if (wallet != null) {
                    CurrencyFormatter.format(wallet.availableBalance, wallet.currencyCode)
                } else {
                    "No settled balance yet"
                }
                Text(balanceText, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    enabled = (wallet?.availableBalance ?: 0.0) > 0.0,
                    onClick = { wallet?.let { onRequestWithdrawal(it.availableBalance) } }
                ) {
                    Text("Request Payout Withdrawal")
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(orders, key = { it.id }) { order ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Order #${order.id} · ${order.orderStatus}", fontWeight = FontWeight.SemiBold)
                        Text("Total: ${CurrencyFormatter.format(order.totalAmount, order.currencyCode)} · SLA: ${order.slaMinutes} min")
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (order.orderStatus == "placed") {
                                Button(onClick = { onConfirmOrder(order.id) }) { Text("Confirm") }
                            }
                            if (order.orderStatus == "confirmed") {
                                Button(onClick = { onReadyForPickup(order.id) }) { Text("Ready for Pickup") }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RiderDeliveryScreen(
    deliveries: List<DeliveryModel>,
    wallet: WalletLedger?,
    onConfirmPickup: (DeliveryModel) -> Unit,
    onVerifyOtp: (DeliveryModel, String) -> Unit,
    onReportTrafficDelay: (DeliveryModel, String) -> Unit
) {
    var otpInputs by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var delayInputs by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Delivery Partner Panel", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        wallet?.let {
            Text(
                "Rider Wallet: ${CurrencyFormatter.format(it.availableBalance, it.currencyCode)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(deliveries, key = { it.id }) { delivery ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Order #${delivery.orderId} · ${delivery.status}", fontWeight = FontWeight.SemiBold)
                        Text("Distance: ${delivery.distanceKm} km · SLA: ${delivery.slaWindowLabel}")
                        Text("Rider Payout: ${CurrencyFormatter.format(delivery.riderPayout, delivery.currencyCode)}")
                        Spacer(modifier = Modifier.height(8.dp))

                        if (!delivery.pickupConfirmed) {
                            Button(onClick = { onConfirmPickup(delivery) }) {
                                Text("Confirm Order Pickup")
                            }
                        } else if (!delivery.otpVerified) {
                            OutlinedTextField(
                                value = otpInputs[delivery.id] ?: "",
                                onValueChange = { otpInputs = otpInputs + (delivery.id to it) },
                                label = { Text("Customer Delivery OTP") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Button(onClick = { onVerifyOtp(delivery, otpInputs[delivery.id] ?: "") }) {
                                Text("Verify OTP & Complete")
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = delayInputs[delivery.id] ?: "",
                            onValueChange = { delayInputs = delayInputs + (delivery.id to it) },
                            label = { Text("Traffic / Force-Majeure Delay Reason") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        OutlinedButton(onClick = {
                            val reason = delayInputs[delivery.id].orEmpty()
                            if (reason.isNotBlank()) onReportTrafficDelay(delivery, reason)
                        }) {
                            Text("Submit Delay Verification")
                        }
                    }
                }
            }
        }
    }
}
