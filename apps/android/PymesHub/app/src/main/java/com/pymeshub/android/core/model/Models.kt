package com.pymeshub.android.core.model

import org.json.JSONObject

data class AuthResponse(
    val accessToken: String,
    val refreshToken: String?,
    val user: AuthUser
) {
    companion object {
        fun fromJson(json: JSONObject) = AuthResponse(
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token").takeIf { it.isNotBlank() },
            user = AuthUser.fromJson(json.getJSONObject("user"))
        )
    }
}

data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = RefreshResponse(
            accessToken = json.getString("access_token"),
            refreshToken = json.optString("refresh_token").takeIf { it.isNotBlank() }
        )
    }
}

data class AuthUser(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    val workspace: WorkspaceSummary
) {
    companion object {
        fun fromJson(json: JSONObject) = AuthUser(
            id = json.getString("id"),
            email = json.optString("email"),
            name = json.optString("name", "Usuario"),
            role = json.optString("role"),
            workspace = WorkspaceSummary.fromJson(json.getJSONObject("workspace"))
        )
    }
}

data class WorkspaceSummary(
    val id: String,
    val name: String,
    val slug: String,
    val plan: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = WorkspaceSummary(
            id = json.getString("id"),
            name = json.optString("name", "Workspace"),
            slug = json.optString("slug"),
            plan = json.optString("plan").takeIf { it.isNotBlank() }
        )
    }
}

data class Conversation(
    val id: String,
    val subject: String?,
    val status: String?,
    val priority: String?,
    val lastMessageText: String?
) {
    companion object {
        fun fromJson(json: JSONObject): Conversation {
            val messages = json.optJSONArray("messages")
            val lastMessage = messages?.optJSONObject(0)?.optString("body_text")?.takeIf { it.isNotBlank() }
            return Conversation(
                id = json.getString("id"),
                subject = json.optString("subject").takeIf { it.isNotBlank() },
                status = json.optString("status").takeIf { it.isNotBlank() },
                priority = json.optString("priority").takeIf { it.isNotBlank() },
                lastMessageText = lastMessage
            )
        }
    }
}

data class Message(
    val id: String,
    val bodyText: String?,
    val bodyHtml: String?,
    val direction: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = Message(
            id = json.getString("id"),
            bodyText = json.optString("body_text").takeIf { it.isNotBlank() },
            bodyHtml = json.optString("body_html").takeIf { it.isNotBlank() },
            direction = json.optString("direction").takeIf { it.isNotBlank() }
        )
    }
}

data class Contact(
    val id: String,
    val fullName: String?,
    val email: String?,
    val phone: String?,
    val companyName: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = Contact(
            id = json.getString("id"),
            fullName = json.optString("full_name").takeIf { it.isNotBlank() }
                ?: json.optString("name").takeIf { it.isNotBlank() },
            email = json.optString("email").takeIf { it.isNotBlank() },
            phone = json.optString("phone").takeIf { it.isNotBlank() },
            companyName = json.optString("company_name").takeIf { it.isNotBlank() }
                ?: json.optString("company").takeIf { it.isNotBlank() }
        )
    }
}

data class TaskItem(
    val id: String,
    val title: String,
    val description: String?,
    val status: String?,
    val priority: String?,
    val dueAt: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = TaskItem(
            id = json.getString("id"),
            title = json.optString("title", "Tarea"),
            description = json.optString("description").takeIf { it.isNotBlank() },
            status = json.optString("status").takeIf { it.isNotBlank() },
            priority = json.optString("priority").takeIf { it.isNotBlank() },
            dueAt = json.optString("due_at").takeIf { it.isNotBlank() }
        )
    }
}

data class Invoice(
    val id: String,
    val number: String?,
    val status: String?,
    val fiscalState: String?,
    val currency: String?,
    val amount: String?,
    val balanceDue: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = Invoice(
            id = json.getString("id"),
            number = json.optString("number").takeIf { it.isNotBlank() },
            status = json.optString("collection_state").takeIf { it.isNotBlank() }
                ?: json.optString("status").takeIf { it.isNotBlank() },
            fiscalState = json.optString("fiscal_state").takeIf { it.isNotBlank() }
                ?: json.optString("hacienda_status").takeIf { it.isNotBlank() },
            currency = json.optString("currency").takeIf { it.isNotBlank() },
            amount = json.valueString("amount"),
            balanceDue = json.valueString("balance_due")
        )
    }
}

data class NotificationItem(
    val id: String,
    val title: String,
    val body: String?,
    val type: String?,
    val readAt: String?
) {
    companion object {
        fun fromJson(json: JSONObject) = NotificationItem(
            id = json.getString("id"),
            title = json.optString("title", "Notificacion"),
            body = json.optString("body").takeIf { it.isNotBlank() },
            type = json.optString("type").takeIf { it.isNotBlank() },
            readAt = json.optString("read_at").takeIf { it.isNotBlank() }
        )
    }
}

private fun JSONObject.valueString(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return opt(key)?.toString()?.takeIf { it.isNotBlank() && it != "null" }
}
