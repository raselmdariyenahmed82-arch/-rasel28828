package com.youthgo.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.youthgo.app.data.model.ProductModel
import com.youthgo.app.data.model.YouthGoCountry
import com.youthgo.app.util.CurrencyFormatter

@Composable
fun CustomerHomeScreen(
    selectedCountry: YouthGoCountry,
    onCountryChange: (YouthGoCountry) -> Unit,
    products: List<ProductModel>,
    onPlaceOrder: (ProductModel, Double) -> Unit
) {
    var distanceKmInput by remember { mutableStateOf("1.8") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(
            text = "YouthGo Marketplace (${selectedCountry.name})",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            YouthGoCountry.entries.forEach { country ->
                FilterChip(
                    selected = country == selectedCountry,
                    onClick = { onCountryChange(country) },
                    label = { Text("${country.code} · ${country.currencyCode}") }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = distanceKmInput,
            onValueChange = { distanceKmInput = it },
            label = { Text("Delivery Distance (km)") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(products, key = { it.id }) { product ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(product.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(product.description, style = MaterialTheme.typography.bodySmall)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = CurrencyFormatter.format(product.price, product.currencyCode),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Button(onClick = {
                                onPlaceOrder(product, distanceKmInput.toDoubleOrNull() ?: 1.5)
                            }) {
                                Text("Checkout")
                            }
                        }
                    }
                }
            }
        }
    }
}
