package com.pymeshub.android.ui.features

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pymeshub.android.app.SessionStore
import com.pymeshub.android.core.api.ApiClient
import com.pymeshub.android.core.api.ApiError
import com.pymeshub.android.core.model.Contact
import com.pymeshub.android.core.model.Invoice
import com.pymeshub.android.core.model.NotificationItem
import com.pymeshub.android.core.model.TaskItem
import com.pymeshub.android.ui.components.EmptyState
import com.pymeshub.android.ui.components.EntityRow
import com.pymeshub.android.ui.components.ScreenHeader
import com.pymeshub.android.ui.components.ScreenSurface
import com.pymeshub.android.ui.components.StatusChip
import kotlinx.coroutines.launch

@Composable
fun ContactsScreen(api: ApiClient) {
    var contacts by remember { mutableStateOf<List<Contact>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { contacts = api.getContacts() } catch (e: Exception) { error = ApiError.displayMessage(e) }
    }
    ScreenSurface {
        LazyColumn(Modifier.fillMaxSize()) {
            item { ScreenHeader("Contactos", "${contacts.size} registros", error) }
            if (contacts.isEmpty() && error == null) {
                item { EmptyState("Sin contactos", "La agenda movil se llenara con clientes y leads.", Icons.Default.Person) }
            }
            items(contacts) { contact ->
                EntityRow(
                    title = contact.fullName ?: "Sin nombre",
                    subtitle = contact.email ?: contact.phone ?: "Sin contacto",
                    meta = contact.companyName,
                    leadingText = contact.fullName ?: contact.companyName ?: "CO"
                )
            }
        }
    }
}

@Composable
fun TasksScreen(api: ApiClient) {
    val scope = rememberCoroutineScope()
    var tasks by remember { mutableStateOf<List<TaskItem>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    suspend fun reload() {
        try { tasks = api.getTasks() } catch (e: Exception) { error = ApiError.displayMessage(e) }
    }
    LaunchedEffect(Unit) { reload() }
    ScreenSurface {
        LazyColumn(Modifier.fillMaxSize()) {
            item { ScreenHeader("Tareas", "${tasks.size} pendientes o recientes", error) }
            if (tasks.isEmpty() && error == null) {
                item { EmptyState("Sin tareas", "Las tareas manuales y automaticas apareceran aqui.", Icons.Default.TaskAlt) }
            }
            items(tasks) { task ->
                EntityRow(
                    title = task.title,
                    subtitle = task.description ?: "Sin descripcion",
                    meta = listOfNotNull(task.priority, task.dueAt).joinToString(" · "),
                    leadingText = task.title,
                    trailing = {
                        Column {
                            StatusChip(task.status)
                            OutlinedButton(onClick = { scope.launch { api.completeTask(task.id); reload() } }) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null)
                                Text("Completar")
                            }
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun InvoicesScreen(api: ApiClient) {
    var invoices by remember { mutableStateOf<List<Invoice>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { invoices = api.getInvoices() } catch (e: Exception) { error = ApiError.displayMessage(e) }
    }
    ScreenSurface {
        LazyColumn(Modifier.fillMaxSize()) {
            item { ScreenHeader("Facturas", "${invoices.size} documentos", error) }
            if (invoices.isEmpty() && error == null) {
                item { EmptyState("Sin facturas", "Las facturas recientes y saldos pendientes apareceran aqui.", Icons.Default.ReceiptLong) }
            }
            items(invoices) { invoice ->
                EntityRow(
                    title = invoice.number ?: "Factura",
                    subtitle = listOfNotNull(invoice.currency, invoice.amount).joinToString(" · "),
                    meta = invoice.balanceDue?.let { "Saldo: $it" },
                    leadingText = invoice.number ?: "FA",
                    trailing = {
                        Column {
                            StatusChip(invoice.status)
                            StatusChip(invoice.fiscalState)
                        }
                    }
                )
            }
        }
    }
}

@Composable
fun SettingsScreen(api: ApiClient, session: SessionStore) {
    val scope = rememberCoroutineScope()
    var unread by remember { mutableStateOf<Int?>(null) }
    var notifications by remember { mutableStateOf<List<NotificationItem>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun reloadNotifications() {
        try {
            unread = api.getUnreadNotificationCount()
            notifications = api.getNotifications()
        } catch (e: Exception) {
            error = ApiError.displayMessage(e)
        }
    }

    LaunchedEffect(Unit) { reloadNotifications() }

    ScreenSurface {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                ScreenHeader(
                    title = "Mas",
                    subtitle = session.user?.workspace?.name ?: "Cuenta y notificaciones",
                    error = error
                )
            }
            session.user?.let { user ->
                item {
                    EntityRow(
                        title = user.name,
                        subtitle = user.email,
                        meta = "Rol: ${user.role}",
                        leadingText = user.name
                    )
                }
            }
            item {
                EntityRow(
                    title = "Notificaciones",
                    subtitle = "${unread ?: 0} no leidas",
                    leadingText = "NO",
                    trailing = {
                        OutlinedButton(onClick = { scope.launch { api.markAllNotificationsRead(); reloadNotifications() } }) {
                            Icon(Icons.Default.Notifications, contentDescription = null)
                            Text("Marcar")
                        }
                    }
                )
            }
            items(notifications.take(5)) { notification ->
                EntityRow(
                    title = notification.title,
                    subtitle = notification.body ?: notification.type ?: "Notificacion",
                    meta = if (notification.readAt == null) "No leida" else "Leida",
                    leadingText = notification.type ?: "NO"
                )
            }
            item {
                Column(Modifier.padding(16.dp)) {
                    Button(onClick = { scope.launch { session.logout() } }) {
                        Text("Cerrar sesion")
                    }
                }
            }
        }
    }
}
