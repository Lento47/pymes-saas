package com.pymeshub.android.ui.features

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
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
import com.pymeshub.android.core.api.ApiClient
import com.pymeshub.android.core.api.ApiError
import com.pymeshub.android.core.model.Conversation
import com.pymeshub.android.core.model.Message
import com.pymeshub.android.ui.components.EmptyState
import com.pymeshub.android.ui.components.EntityRow
import com.pymeshub.android.ui.components.ScreenHeader
import com.pymeshub.android.ui.components.ScreenSurface
import com.pymeshub.android.ui.components.StatusChip
import kotlinx.coroutines.launch

@Composable
fun InboxScreen(api: ApiClient) {
    var conversations by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var selected by remember { mutableStateOf<Conversation?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            conversations = api.getConversations()
        } catch (e: Exception) {
            error = ApiError.displayMessage(e)
        }
    }

    selected?.let { conversation ->
        ConversationDetail(api = api, conversation = conversation, onBack = { selected = null })
        return
    }

    ScreenSurface {
        LazyColumn(modifier = Modifier.fillMaxSize()) {
            item {
                ScreenHeader(
                    title = "Inbox",
                    subtitle = "${conversations.size} conversaciones activas",
                    error = error
                )
            }
            if (conversations.isEmpty() && error == null) {
                item { EmptyState("Sin conversaciones", "Cuando entren mensajes nuevos apareceran aqui.") }
            }
            items(conversations) { conversation ->
                EntityRow(
                    title = conversation.subject ?: "Conversacion",
                    subtitle = conversation.lastMessageText ?: "Sin mensajes recientes",
                    meta = listOfNotNull(conversation.status, conversation.priority).joinToString(" · "),
                    leadingText = conversation.subject ?: "CN",
                    modifier = Modifier.clickable { selected = conversation }
                )
            }
        }
    }
}

@Composable
private fun ConversationDetail(api: ApiClient, conversation: Conversation, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(conversation.id) {
        try {
            messages = api.getMessages(conversation.id)
        } catch (e: Exception) {
            error = ApiError.displayMessage(e)
        }
    }

    ScreenSurface {
        Column(modifier = Modifier.fillMaxSize()) {
            ScreenHeader(
                title = conversation.subject ?: "Conversacion",
                subtitle = listOfNotNull(conversation.status, conversation.priority).joinToString(" · "),
                error = error,
                action = {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Atras")
                        }
                        IconButton(onClick = { scope.launch { api.resolveConversation(conversation.id) } }) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Resolver")
                        }
                    }
                }
            )
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(messages) { message ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(message.bodyText ?: message.bodyHtml ?: "")
                        StatusChip(message.direction)
                    }
                }
            }
            Row(Modifier.padding(16.dp)) {
                OutlinedTextField(draft, { draft = it }, modifier = Modifier.weight(1f), label = { Text("Responder") })
                Spacer(Modifier.width(8.dp))
                Button(onClick = {
                    scope.launch {
                        val text = draft.trim()
                        if (text.isNotEmpty()) {
                            draft = ""
                            messages = messages + api.sendMessage(conversation.id, text)
                        }
                    }
                }) {
                    Icon(Icons.Default.Send, contentDescription = null)
                }
            }
        }
    }
}
