# Live Social Entertainment Platform

Creator-led Live Social Community & Entertainment Platform.

Stack: **Expo 57 · Expo Router · Supabase · LiveKit (FAZ 5) · PostgreSQL (RLS)**

> Geçici marka config: `src/yapilandirma/UygulamaKimligi.ts`  
> Production mimari: [`docs/mimari/README.md`](docs/mimari/README.md)

## Hızlı başlangıç

```bash
npm install --legacy-peer-deps
npm run start:dev
```

Test ortamı:

```bash
# .env.test zaten hazır
npx --yes dotenv-cli -e .env.test -- expo start --clear
```

Expo Go veya emülatör ile aç.

## Supabase kurulumu (zorunlu)

Proje: `vdkqrqtrftzhbtquzked`

1. Dashboard → **SQL Editor**
2. `supabase/migrations/001_initial_schema.sql` çalıştır
3. `supabase/seed/001_catalog.sql` çalıştır
4. Auth + SMTP adımları: [`supabase/SETUP.md`](supabase/SETUP.md)

### Auth özellikleri (hazır)

- E-posta / şifre kayıt
- Giriş
- Şifre sıfırlama maili (`resetPasswordForEmail`)
- Yeni şifre belirleme ekranı
- Oturum kalıcılığı (AsyncStorage)
- Kayıtta otomatik `profiles` + `wallets` (welcome 100 coin)

### SMTP

Supabase Dashboard → Authentication → Emails → **Custom SMTP** aç.
Resend / SendGrid / SES / Brevo vb. bağla. Detay: `supabase/SETUP.md`.

Redirect URL örnekleri:

```
muta://reset-password
muta://auth/callback
exp://127.0.0.1:8081/--/reset-password
```

## Monetization modeli

| Varlık | Rol |
|--------|-----|
| **Coin** | Kullanıcı satın alır, hediye gönderir |
| **Elmas** | Host hediyeden kazanır, çekim talep eder |
| **Gifts** | Coin → elmas dönüşümü (`send_gift` RPC, atomic) |
| **Packages** | IAP katalog (`coin_packages`) |
| **Payouts** | `payout_requests` ile çekim kuyruğu |

IAP (App Store / Play Billing) bir sonraki adımda bağlanacak; katalog ve cüzdan UI hazır.

## Uygulama ekranları

- Auth: login / register / forgot / reset
- Tabs: Keşfet · Odalar · Canlı (oda aç) · Cüzdan · Profil
- Room: mic seats, mute, gift panel

## Ortam değişkenleri

`.env` (gitignore):

```
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=https://vdkqrqtrftzhbtquzked.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
EXPO_PUBLIC_APP_NAME=Muta
EXPO_PUBLIC_APP_SCHEME=muta
```

`service_role` key **asla** uygulamaya konmaz.

## Mimari (FAZ 1–6)

- FAZ 6: Gift kategori/animasyon queue, VIP·Gifter·Charm·Recharge, rankings
- SQL: `001` … `007_faz6_hediye_vip_ranking`
- Doküman: `docs/mimari/`

## Sonraki: FAZ 7

Agency / Host / commission / transfers / withdrawals.  
`npm run typecheck` temiz olmalı.
