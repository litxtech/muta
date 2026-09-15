# FAZ devam — kamera, push, admin, ince UX (2026-09-10)

## Yapilan
- `expo-camera` + `CanliKameraOnizleme` + Agora `publishCameraTrack`
- `notification-push` Edge Function (Expo Push + outbox) deploy
- Migrations `013`–`015` remote apply (`is_admin`, IAP/Stripe, oturum)
- Gizlilik ayarlari (`user_privacy_settings`) Settings ekraninda
- Kesfet oneri filtre motoru
- PK arena UI (timer, bar, skor olaylari)
- Admin hub ozet kartlari
- City battle skor bari
- `video_enabled` + `iap_enabled` flags ON

## Hala 3rd-party bekleyen
- Agora App ID/Certificate
- Stripe live keys
- Store IAP products + `IAP_SANDBOX_ALLOW=false`
- SMTP / Apple Sign In / EAS credentials
- Super Admin Next.js implementasyonu
