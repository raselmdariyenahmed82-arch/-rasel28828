package com.youthgo.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.youthgo.app.data.model.AuditLogRecord
import com.youthgo.app.data.model.ShopModel

data class AdminDashboardKpis(
    val totalCustomers: Int,
    val totalSellers: Int,
    val totalDeliveryPartners: Int,
    val totalShops: Int,
    val totalOrders: Int,
    val completedOrders: Int,
    val cancelledOrders: Int,
    val totalRevenueUsd: Double,
    val pendingWithdrawals: Int,
    val pendingComplaints: Int
)

@Composable
fun AdminControlScreen(
    kpis: AdminDashboardKpis,
    pendingShops: List<ShopModel>,
    auditLogs: List<AuditLogRecord>,
    onApproveShop: (ShopModel) -> Unit,
    onRejectShop: (ShopModel) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("YouthGo Admin Control Panel", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Customers: ${kpis.totalCustomers} · Sellers: ${kpis.totalSellers} · Riders: ${kpis.totalDeliveryPartners}")
                    Text("Shops: ${kpis.totalShops} · Orders: ${kpis.totalOrders} (Done: ${kpis.completedOrders} / Cancelled: ${kpis.cancelledOrders})")
                    Text("Total Revenue (USD): $${String.format("%.2f", kpis.totalRevenueUsd)}", fontWeight = FontWeight.SemiBold)
                    Text("Pending Withdrawals: ${kpis.pendingWithdrawals} · Pending Complaints: ${kpis.pendingComplaints}")
                }
            }
        }
        item {
            Text("Shop Verification Queue", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        items(pendingShops, key = { it.id }) { shop ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${shop.name} (${shop.countryCode} · ${shop.currencyCode})", fontWeight = FontWeight.SemiBold)
                    Text("${shop.city} · ${shop.category}")
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { onApproveShop(shop) }) { Text("Approve") }
                        OutlinedButton(onClick = { onRejectShop(shop) }) { Text("Reject") }
                    }
                }
            }
        }
        item {
            Text("Recent Audit Logs", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        items(auditLogs, key = { it.id }) { log ->
            Text("${log.action} · ${log.targetCollection}/${log.targetDocId} — ${log.summary}")
        }
    }
}
