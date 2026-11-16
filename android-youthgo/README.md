# YouthGo Android Studio Project

## Architecture
- **Language / UI**: Kotlin 2.0 + Jetpack Compose Material 3 + Hilt DI
- **Firebase Project**: `symmetric-vial-lmn89` (Firestore DB: `ai-studio-1db59aa7-128f-4f55-8cbf-5a450f7ad7e1`)
- **Services**: Authentication, Cloud Firestore, Storage, FCM, Cloud Functions, App Check (Play Integrity / Debug), Crashlytics, Analytics

## Building an Installable APK in Android Studio or CI
1. Open `android-youthgo/` in Android Studio Ladybug+ (JDK 17, Android SDK 35).
2. Download your project's Android `google-services.json` from Firebase Console (after adding package `com.youthgo.app` and your SHA-1 fingerprint) and place it in `android-youthgo/app/google-services.json`.
3. Run `./gradlew assembleDebug` (or Build -> Build Bundle(s) / APK(s) -> Build APK(s)).
4. Deploy Cloud Functions from `../functions/` using `firebase deploy --only functions`.
