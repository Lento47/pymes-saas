package com.pymeshub.android.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.pymeshub.android.core.api.ApiClient
import com.pymeshub.android.core.api.ApiError
import com.pymeshub.android.core.model.AuthUser
import com.pymeshub.android.core.security.SecureTokenStore

interface AuthProvider {
    val accessToken: String?
    val workspaceSlug: String?
    suspend fun refreshAccessToken(): Boolean
    fun clearSession()
}

class SessionStore(
    private val api: ApiClient,
    private val tokenStore: SecureTokenStore
) : AuthProvider {
    override var accessToken: String? by mutableStateOf(null)
        private set
    override var workspaceSlug: String? by mutableStateOf(tokenStore.readWorkspaceSlug())
        private set
    var user: AuthUser? by mutableStateOf(null)
        private set
    var isRestoring: Boolean by mutableStateOf(false)
        private set
    var errorMessage: String? by mutableStateOf(null)
        private set

    val isAuthenticated: Boolean
        get() = accessToken != null && user != null

    suspend fun restoreSession() {
        if (isRestoring || tokenStore.readRefreshToken() == null) return
        isRestoring = true
        try {
            if (refreshAccessToken()) {
                user = api.getMe()
                workspaceSlug = user?.workspace?.slug
                workspaceSlug?.let(tokenStore::saveWorkspaceSlug)
            }
        } catch (_: Exception) {
            clearSession()
        } finally {
            isRestoring = false
        }
    }

    suspend fun login(email: String, password: String, workspace: String) {
        errorMessage = null
        try {
            val response = api.login(email = email, password = password, workspaceSlug = workspace)
            accessToken = response.accessToken
            workspaceSlug = response.user.workspace.slug
            user = response.user
            response.refreshToken?.let(tokenStore::saveRefreshToken)
            tokenStore.saveWorkspaceSlug(response.user.workspace.slug)
        } catch (error: Exception) {
            errorMessage = ApiError.displayMessage(error)
        }
    }

    suspend fun logout() {
        try {
            api.logout()
        } catch (_: Exception) {
        }
        clearSession()
    }

    override suspend fun refreshAccessToken(): Boolean {
        val refreshToken = tokenStore.readRefreshToken() ?: return false
        return try {
            val response = api.refresh(refreshToken)
            accessToken = response.accessToken
            response.refreshToken?.let(tokenStore::saveRefreshToken)
            true
        } catch (_: Exception) {
            clearSession()
            false
        }
    }

    override fun clearSession() {
        accessToken = null
        workspaceSlug = null
        user = null
        tokenStore.clear()
    }
}
