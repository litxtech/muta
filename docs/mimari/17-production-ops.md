# Production / ops checklist

## Uygulanan (2026-09-10 → 09-10 devam)

- [x] SQL `001`–`015` (oda sohbet, oturum koruma, IAP/Stripe, admin RBAC)
- [x] Seed `001_catalog.sql`
- [x] Feature flags: live, video, pk, agency, city, events, missions, iap, …
- [x] Auth Site URL `https://litxtech.com` + redirect allow list
- [x] Anonymous auth ON
- [x] Secrets: `LIVEKIT_*`, `IAP_SANDBOX_ALLOW=true`, `PUSH_WORKER_SECRET`
- [x] Edge Functions ACTIVE: `livekit-token`, `iap-receipt-verify`, `stripe-checkout`, `stripe-webhook`, `notification-push`, `hesap-sil`, …
- [x] Mobil RTC: **LiveKit** (Agora kaldırıldı)
- [x] EAS peer fix: `.npmrc` `legacy-peer-deps=true` + `overrides.react-dom`

## Seed ozeti
- cities: 6 · missions: 3 · gifts: 10 · agency_levels: 6 · cert_checks: 10 · packages: 6+

## Manuel kalan (3rd party / store)

- [ ] Custom SMTP (e-posta onay/sifre)
- [ ] Apple Sign In native keys (SETUP.md)
- [ ] LiveKit Cloud API key/secret → Supabase secrets (varsa doğrula)
- [ ] Stripe canlı keys (`stripe_enabled` kapali kalsin ta ki keys gelene)
- [ ] Gercek Apple/Google IAP (`IAP_SANDBOX_ALLOW=false` + store products)
- [ ] Expo Push / APNs credentials (EAS credentials) — worker hazir
- [ ] Android FCM: `google-services.json` + rebuild
- [ ] EAS development build **LiveKit native** ile (WebRTC)
- [ ] EAS production build
- [ ] Super Admin Next.js paneli (`apps/super-admin`)

## Push worker

```bash
curl -X POST "https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/notification-push" \
  -H "Authorization: Bearer $ANON_OR_SERVICE" \
  -H "X-Worker-Secret: $(grep PUSH_WORKER_SECRET .env.push.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}'
```

## Uygulama baslat
```bash
npm run start:dev
npm run eas:dev:ios   # .npmrc commit edilmeli
```
