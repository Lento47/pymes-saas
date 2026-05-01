package com.pymeshub.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors: ColorScheme = lightColorScheme(
    primary = Color(0xFF155EEF),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDE7FF),
    onPrimaryContainer = Color(0xFF09245C),
    secondary = Color(0xFF0F766E),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCCFBF1),
    onSecondaryContainer = Color(0xFF0B3B36),
    tertiary = Color(0xFFB45309),
    tertiaryContainer = Color(0xFFFFEDD5),
    background = Color(0xFFF7F8FB),
    onBackground = Color(0xFF111827),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFE8ECF3),
    onSurfaceVariant = Color(0xFF475467),
    outline = Color(0xFFD0D5DD),
    error = Color(0xFFB42318)
)

private val DarkColors: ColorScheme = darkColorScheme(
    primary = Color(0xFF8EA8FF),
    onPrimary = Color(0xFF071B4D),
    primaryContainer = Color(0xFF1D3D8F),
    secondary = Color(0xFF5EEAD4),
    tertiary = Color(0xFFFDBA74),
    background = Color(0xFF0B1220),
    surface = Color(0xFF111827),
    surfaceVariant = Color(0xFF1F2937),
    onSurface = Color(0xFFF9FAFB),
    onSurfaceVariant = Color(0xFFCBD5E1),
    outline = Color(0xFF334155),
    error = Color(0xFFFCA5A5)
)

@Composable
fun PymesHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
