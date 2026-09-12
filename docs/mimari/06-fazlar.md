# Gelistirme Fazlari

Her faz **ayri test edilebilir**. Sonraki faza gecmeden: `tsc`, lint, build temiz.

## FAZ 1 — Temel mimari (bu faz)
- Repo analizi
- Modul sinirlari + klasor iskeleti
- Design System
- Yapilandirma (APP_NAME vb.)
- Feature flags + kill switch sozlesmesi
- Error boundaries
- Navigasyon iskeleti (Home/Rooms/Create/Messages/Profile)

## FAZ 2 — Kimlik ve guvenlik temeli
- Public User ID
- Guest identity + upgrade
- SecureStore session
- Device sessions
- RLS genisletme
- Audit + security_events iskeleti

## FAZ 3 — Finans
- Ledger hardening
- IAP verify
- Gift settlement genisletme
- Idempotency
- Kill switches aktif

## FAZ 4 — Sosyal cekirdek
- Profile stats denormalized
- Follow
- Home / Explore
- Messaging
- Notification foundation

## FAZ 5 — Realtime medya
- LiveKit
- Voice rooms + Room Layout Engine
- Lobby ayri modul
- Live streaming
- PK (server score)

## FAZ 6 — Prestige ve hediye UX
- Dinamik gift catalog (1000+)
- Animasyon CDN + queue
- VIP / Gifter / Charm / Recharge
- Rankings

## FAZ 7 — Ajans / Host ✅
- Applications, commission snapshot
- Transfers, withdrawals
- Authorized distributor
- Bkz. [13-faz7-tamamlandi.md](13-faz7-tamamlandi.md)

## FAZ 8 — Sehir platformu ✅
- Official city rooms
- League, battle, election
- Leader / Vice leader
- Bkz. [14-faz8-tamamlandi.md](14-faz8-tamamlandi.md)

## FAZ 9 — Platform operasyon ✅
- Events, missions, badges
- Announcements vs Policies
- Push center
- Moderation + Security Center
- Analytics
- Bkz. [15-faz9-tamamlandi.md](15-faz9-tamamlandi.md)

## FAZ 10 — Sertifikasyon ✅
- Load / security / reconciliation
- Low-end Android
- LiveKit + gift animation stress
- Network failure / graceful degradation
- Bkz. [16-faz10-tamamlandi.md](16-faz10-tamamlandi.md)

## Ozellik kabul checklist

1. Hangi bagimsiz module ait?
2. Bagimsiz islemler ayri Turkce ASCII dosyalarda mi?
3. Bozulursa ne etkilenir; fault isolation var mi?
4. Backend dogrulama gereken kritik veri var mi?
