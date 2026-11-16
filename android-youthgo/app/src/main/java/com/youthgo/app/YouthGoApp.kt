package com.youthgo.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@HiltAndroidApp
class YouthGoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)

        val appCheck = FirebaseAppCheck.getInstance()
        if (BuildConfig.DEBUG) {
            appCheck.installAppCheckProviderFactory(DebugAppCheckProviderFactory.getInstance())
        } else {
            appCheck.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
        }

        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG)
        FirebaseAnalytics.getInstance(this).setAnalyticsCollectionEnabled(true)
    }
}

@Module
@InstallIn(SingletonComponent::class)
object FirebaseModule {
    @Provides
    @Singleton
    fun provideFirestore(): FirebaseFirestore =
        FirebaseFirestore.getInstance(FirebaseApp.getInstance(), BuildConfig.FIRESTORE_DB_ID)
}
