package com.pymeshub.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import com.pymeshub.android.app.AppEnvironment
import com.pymeshub.android.ui.PymesHubApp
import com.pymeshub.android.ui.theme.PymesHubTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val environment = remember { AppEnvironment.create(this) }
            PymesHubTheme {
                Surface {
                    PymesHubApp(environment = environment)
                }
            }
        }
    }
}
