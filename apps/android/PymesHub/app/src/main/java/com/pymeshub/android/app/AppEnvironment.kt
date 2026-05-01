package com.pymeshub.android.app

import android.content.Context
import com.pymeshub.android.R
import com.pymeshub.android.core.api.ApiClient
import com.pymeshub.android.core.security.SecureTokenStore

class AppEnvironment private constructor(
    val api: ApiClient,
    val session: SessionStore
) {
    companion object {
        fun create(context: Context): AppEnvironment {
            val baseUrl = context.getString(R.string.api_base_url)
            val tokenStore = SecureTokenStore(context.applicationContext)
            val api = ApiClient(baseUrl = baseUrl)
            val session = SessionStore(api = api, tokenStore = tokenStore)
            api.authProvider = session
            return AppEnvironment(api = api, session = session)
        }
    }
}
