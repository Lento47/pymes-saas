package com.pymeshub.android.core.api

class ApiException(val status: Int, message: String) : Exception("$status: $message")

object ApiError {
    fun displayMessage(error: Throwable): String {
        return error.message ?: "No se pudo completar la solicitud."
    }
}
