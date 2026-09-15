# Android Push — Firebase FCM

Android bildirimleri **Firebase Cloud Messaging (FCM)** ile gider.

## Senin yapman gerekenler

1. [Firebase Console](https://console.firebase.google.com) → proje oluştur / seç
2. Android app ekle — package: `com.litxtech.muta`
3. `google-services.json` indir → proje köküne koy (`google-services.example.json` şablon)
4. Project Settings → Service accounts → **Generate new private key** (FCM V1)
5. Supabase secret:
   ```
   npx supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat firebase-service-account.json)" --project-ref vdkqrqtrftzhbtquzked
   ```
   (veya Dashboard → Edge Functions → Secrets)
6. EAS FCM (Expo Push yedek): `eas credentials` → Android → Google Service Account → FCM V1 upload
7. Yeni Android build: `eas build --platform android --profile development` (veya preview/production)
8. `npm run functions:deploy` (notification-push güncellendi)

## Kod tarafı (hazır)

- `app.config.ts` → `android.googleServicesFile`
- Android cihaz → native FCM token (`push_provider=fcm`)
- `notification-push` → FCM HTTP v1 + Expo yedek
- `eas.json` → Android `withoutCredentials` kaldırıldı
