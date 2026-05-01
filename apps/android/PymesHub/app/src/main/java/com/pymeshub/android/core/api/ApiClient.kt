package com.pymeshub.android.core.api

import com.pymeshub.android.app.AuthProvider
import com.pymeshub.android.core.model.AuthResponse
import com.pymeshub.android.core.model.AuthUser
import com.pymeshub.android.core.model.Contact
import com.pymeshub.android.core.model.Conversation
import com.pymeshub.android.core.model.Invoice
import com.pymeshub.android.core.model.Message
import com.pymeshub.android.core.model.NotificationItem
import com.pymeshub.android.core.model.RefreshResponse
import com.pymeshub.android.core.model.TaskItem
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class ApiClient(private val baseUrl: String) {
    var authProvider: AuthProvider? = null

    suspend fun login(email: String, password: String, workspaceSlug: String): AuthResponse {
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
        val json = request(
            method = "POST",
            path = "/api/auth/login",
            body = body,
            headers = mapOf("x-workspace-slug" to workspaceSlug),
            requiresAuth = false
        )
        return AuthResponse.fromJson(JSONObject(json))
    }

    suspend fun refresh(refreshToken: String): RefreshResponse {
        val json = request(
            method = "POST",
            path = "/api/auth/refresh",
            body = JSONObject().put("refresh_token", refreshToken),
            requiresAuth = false
        )
        return RefreshResponse.fromJson(JSONObject(json))
    }

    suspend fun getMe(): AuthUser = AuthUser.fromJson(JSONObject(request("GET", "/api/auth/me")))

    suspend fun logout() {
        request("POST", "/api/auth/logout")
    }

    suspend fun getConversations(): List<Conversation> {
        return parseArray(request("GET", "/api/conversations")).map(Conversation::fromJson)
    }

    suspend fun getMessages(conversationId: String): List<Message> {
        return parseArray(request("GET", "/api/conversations/$conversationId/messages")).map(Message::fromJson)
    }

    suspend fun sendMessage(conversationId: String, text: String): Message {
        val body = JSONObject().put("body_text", text)
        return Message.fromJson(JSONObject(request("POST", "/api/conversations/$conversationId/messages", body)))
    }

    suspend fun resolveConversation(id: String) {
        request("POST", "/api/conversations/$id/resolve")
    }

    suspend fun getContacts(): List<Contact> {
        return parseArray(request("GET", "/api/contacts")).map(Contact::fromJson)
    }

    suspend fun getTasks(): List<TaskItem> {
        return parseArray(request("GET", "/api/tasks")).map(TaskItem::fromJson)
    }

    suspend fun completeTask(id: String) {
        request("POST", "/api/tasks/$id/complete")
    }

    suspend fun getInvoices(): List<Invoice> {
        return parseArray(request("GET", "/api/invoices")).map(Invoice::fromJson)
    }

    suspend fun getNotifications(): List<NotificationItem> {
        return parseArray(request("GET", "/api/notifications")).map(NotificationItem::fromJson)
    }

    suspend fun getUnreadNotificationCount(): Int {
        val json = JSONObject(request("GET", "/api/notifications/unread-count"))
        return json.optInt("count", 0)
    }

    suspend fun markAllNotificationsRead(): Int {
        val json = JSONObject(request("POST", "/api/notifications/mark-read", JSONObject()))
        return json.optInt("count", 0)
    }

    private suspend fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        headers: Map<String, String> = emptyMap(),
        requiresAuth: Boolean = true,
        didRetry: Boolean = false
    ): String = withContext(Dispatchers.IO) {
        val connection = URL("${baseUrl.trimEnd('/')}/${path.trimStart('/')}").openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Accept", "application/json")
        headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }

        if (requiresAuth) {
            authProvider?.accessToken?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            authProvider?.workspaceSlug?.let { connection.setRequestProperty("x-workspace-slug", it) }
        }

        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()

        if (status == 401 && requiresAuth && !didRetry && authProvider?.refreshAccessToken() == true) {
            return@withContext request(method, path, body, headers, requiresAuth, didRetry = true)
        }

        if (status !in 200..299) {
            if (status == 401) authProvider?.clearSession()
            throw ApiException(status, response.ifBlank { "HTTP $status" })
        }

        response.ifBlank { "{}" }
    }

    private fun parseArray(raw: String): List<JSONObject> {
        val trimmed = raw.trim()
        val array = if (trimmed.startsWith("[")) {
            JSONArray(trimmed)
        } else {
            val root = JSONObject(trimmed.ifBlank { "{}" })
            when {
                root.optJSONArray("data") != null -> root.getJSONArray("data")
                root.optJSONArray("items") != null -> root.getJSONArray("items")
                root.optJSONArray("results") != null -> root.getJSONArray("results")
                else -> JSONArray()
            }
        }

        return List(array.length()) { index -> array.getJSONObject(index) }
    }
}
