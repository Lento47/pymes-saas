package com.pymeshub.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.pymeshub.android.app.AppEnvironment
import com.pymeshub.android.ui.features.ContactsScreen
import com.pymeshub.android.ui.features.InboxScreen
import com.pymeshub.android.ui.features.InvoicesScreen
import com.pymeshub.android.ui.features.LoginScreen
import com.pymeshub.android.ui.features.SettingsScreen
import com.pymeshub.android.ui.features.TasksScreen

@Composable
fun PymesHubApp(environment: AppEnvironment) {
    LaunchedEffect(Unit) {
        environment.session.restoreSession()
    }

    if (!environment.session.isAuthenticated) {
        LoginScreen(session = environment.session)
        return
    }

    var tab by remember { mutableStateOf(AppTab.Inbox) }
    Scaffold(
        bottomBar = {
            NavigationBar {
                AppTab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        label = { Text(item.title) },
                        icon = { Icon(item.icon, contentDescription = null) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (tab) {
                AppTab.Inbox -> InboxScreen(api = environment.api)
                AppTab.Contacts -> ContactsScreen(api = environment.api)
                AppTab.Tasks -> TasksScreen(api = environment.api)
                AppTab.Invoices -> InvoicesScreen(api = environment.api)
                AppTab.Settings -> SettingsScreen(api = environment.api, session = environment.session)
            }
        }
    }
}

enum class AppTab(val title: String, val icon: ImageVector) {
    Inbox("Inbox", Icons.Default.Inbox),
    Contacts("Contactos", Icons.Default.Contacts),
    Tasks("Tareas", Icons.Default.CheckCircle),
    Invoices("Facturas", Icons.Default.ReceiptLong),
    Settings("Mas", Icons.Default.MoreHoriz)
}
