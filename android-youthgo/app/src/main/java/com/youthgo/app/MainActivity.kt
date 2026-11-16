package com.youthgo.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.youthgo.app.data.model.YouthGoCountry
import com.youthgo.app.data.repository.YouthGoRepository
import com.youthgo.app.ui.screens.AdminControlScreen
import com.youthgo.app.ui.screens.AdminDashboardKpis
import com.youthgo.app.ui.screens.CustomerHomeScreen
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject
    lateinit var repository: YouthGoRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                var selectedTab by remember { mutableIntStateOf(0) }
                var selectedCountry by remember { mutableStateOf(YouthGoCountry.BANGLADESH) }
                val products by repository.observeActiveProducts(selectedCountry.code)
                    .collectAsState(initial = emptyList())
                val scope = rememberCoroutineScope()

                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            NavigationBarItem(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                icon = {},
                                label = { Text("Shop") }
                            )
                            NavigationBarItem(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                icon = {},
                                label = { Text("Admin") }
                            )
                        }
                    }
                ) { padding ->
                    Box(modifier = Modifier.padding(padding)) {
                        when (selectedTab) {
                            0 -> CustomerHomeScreen(
                                selectedCountry = selectedCountry,
                                onCountryChange = { selectedCountry = it },
                                products = products,
                                onPlaceOrder = { _, _ ->
                                    scope.launch {
                                        // Order placement delegates to YouthGoRepository.createOrderWithDelivery()
                                    }
                                }
                            )
                            1 -> AdminControlScreen(
                                kpis = AdminDashboardKpis(0, 0, 0, 0, 0, 0, 0, 0.0, 0, 0),
                                pendingShops = emptyList(),
                                auditLogs = emptyList(),
                                onApproveShop = {},
                                onRejectShop = {}
                            )
                        }
                    }
                }
            }
        }
    }
}
