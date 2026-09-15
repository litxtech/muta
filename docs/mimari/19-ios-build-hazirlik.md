# iOS Development Build — hazirlik

Tarih: 2026-09-10

## Tespit edilen eksikler → duzeltildi

| Eksik | Durum |
|-------|--------|
| `expo-audio` (mikrofon izni + plugin) | Kuruldu |
| `expo-system-ui` | Kuruldu |
| `react-native-get-random-values` (Supabase crypto) | Kuruldu + `supabase.ts` import |
| Mic izin akisi join oncesi | `MedyaIzinleriniIste` |
| iOS plist: Bluetooth + encryption flag | `app.config.ts` |
| EAS profile env (Supabase/LiveKit/Agora URL) | `eas.json` |
| Agora App ID bos iken crash riski | LiveKit fallback |
| `expo-doctor` | 21/21 OK |
| `tsc` | temiz |

## Hala senin verecegin / Dashboard

1. **Agora** `App ID` + `App Certificate` → `.env.agora.local` + `EXPO_PUBLIC_AGORA_APP_ID`
   - Verilince: secrets set + `eas.json` AGORA_APP_ID guncelle
   - Simdilik RTC otomatik **LiveKit** (secret'lar mevcut)
2. Apple Developer: EAS credentials (`eas credentials`) — Team + provisioning
3. Custom SMTP (email confirm) — opsiyonel build icin
4. APNs key — push icin EAS Credentials

## Sonraki iOS build — Push (zorunlu)

Ilk device build'de **Push Notifications → No** secildi. Sonraki build'de:

1. `npx eas-cli build --profile development --platform ios` (**interactive**; `--non-interactive` yok)
2. Sorulunca: **Setup Push Notifications → Yes**
3. Sorulunca: **APNs key olustur/yukle → Yes**
4. Eski provisioning Push icermiyorsa: `npx eas-cli credentials -p ios` ile profili yenile
5. Repo hazir: `ios.entitlements.aps-environment` + `expo-notifications` + `remote-notification`

## Bilerek sonraki sprinte birakilan (binary'ye gerek yok / admin)

- Super Admin web RBAC
- APNs/FCM worker (outbox)
- Stripe canli keys (`stripe_enabled=false`)
- Gercek StoreKit verify (`IAP_SANDBOX`)
- `expo-camera` video UI (mic + plist hazir; kamera paketi sonraki)
- Native `@livekit/react-native` (Agora birincil)

## Build failed: npm ci ERESOLVE

**Neden:** EAS `npm ci` calistirir; `react@19.2.3` vs `react-dom@19.3.0` peer catismasi.
`.npmrc` lokalde vardi ama **git'e eklenmemisti** → EAS `legacy-peer-deps` gormedi.

**Fix (repo):**
- `.npmrc` → `legacy-peer-deps=true` (commit et)
- `package.json` → `overrides.react-dom=19.2.3` + `eas-build-pre-install`
- `package-lock.json` yenilendi; lokal `npm ci --include=dev` OK

Commit/push sonrasi tekrar:

```bash
npm run eas:dev:ios
```

Simulator icin:

```bash
eas build --profile development --platform ios
```

Kurulum sonrasi:

```bash
npx expo start --dev-client --clear
```
