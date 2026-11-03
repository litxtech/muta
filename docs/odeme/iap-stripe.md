# Ödeme — yalnızca mağaza içi satın alma (IAP)

## Kural
- **iOS dijital coin** → yalnızca App Store IAP (`expo-iap` / StoreKit)
- **Android** → yalnızca Google Play Billing (`expo-iap`)
- **Uygulama içinde başka ödeme yolu yoktur.** Stripe, kart formu, harici checkout,
  ajans/indirimli coin satışı ve web ödeme yedeği **tamamen kaldırıldı**.
- Web (Vercel) istemcisinde coin satın alma kapalıdır; kullanıcıya
  "yalnızca mobil uygulamada" bilgisi gösterilir (`cuzdanX.coinYalnizMobil`).

## Kaldırılanlar (tekrar eklenmemeli)
- `src/moduller/stripe/**` (PaymentSheet + Checkout WebView)
- `@stripe/stripe-react-native` bağımlılığı ve config plugin
- Cüzdan "yetkili ajans" indirimli coin şeridi (`YetkiliAjansYukleSeridi`)
- Sohbet içi ajans paket teklifi / ödeme kartı / fiş kartı
- `AjansPaketTeklifOde`, `AjansPaketTeklifIslemleri`, `AjansCoinPaketKatalog`
- AI müzik Stripe yedeği (`AiMuzikSatinAl.ts` artık yalnızca IAP)
- `expo-dev-client` config plugin (yalnızca production dışı derlemelerde)

Sunucudaki `stripe-*` / `ajans-pay` edge function'ları artık istemciden çağrılmıyor;
istenirse ayrıca silinebilir.

## Takas ≠ IAP cash-out (Apple / Google)

MUTA PAY **coin takası** mağaza dışı “satın al → nakde çevir” değildir:

- Coin **yükleme** (IAP / Play Billing) ile **takas / ajans anlaşması** ayrı ekranlardır; aynı CTA’da birleştirilmez.
- UI dili: *katalog değeri*, *anlaşma tutarı*, *MUTA PAY takas* — “nakit bozdur / para çek / kazanç” kullanılmaz.
- Katalog: `1 coin = 0,10 ₺` · anlaşmada satıcı **%40**, platform **%60** (sunucuda kilitlenir).
- Mağazadan yüklenen coinler **14 gün** soğutulur; bu süre dolmadan takasa giremez (iade penceresi).
- `refunded` satın alma kaydı olan kullanıcıda yeni takas **engellenir**; iade / chargeback / sahte dekont hesap askı / kapatma sebebidir.
- Ödemeler ilk tamamlanan anlaşmadan itibaren ayın **01–15** ve **15–31** pencerelerinde yapılır.
- Elmas çekimi (host kazancı) bu modelden ayrıdır.

Rakip cent/dolar bandı + kilitli katalog oranları: [`coin-ekonomi-benchmark.md`](./coin-ekonomi-benchmark.md).

## App Store Connect ürünleri (Consumable)
Bundle: `com.litxtech.muta`

| Product ID | Örnek |
|------------|--------|
| `com.litxtech.muta.coins_60` | Starter |
| `com.litxtech.muta.coins_300` | Popular |
| `com.litxtech.muta.coins_1280` | VIP |
| `com.litxtech.muta.coins_6480` | Legend |

Aynı ID'leri Play Console'da da oluştur. Güncel TRY SKU’lar için `CoinPaketHesap.ts` / `coin_packages` tablosuna bak.

## SQL
`supabase/migrations/011_iap_stripe.sql`

Takas TL alanları + IAP soğutma:
`supabase/migrations/20260918120054_coin_takas_paylasim_tl_iap_sogutma.sql`

```sql
update public.feature_flags set enabled = true where key in ('iap_enabled');
```

## Edge secrets
```
IAP_SKIP_VERIFY=1          # sandbox; prod'da kaldir + Apple/Google verify ekle
```

Deploy:
```
npx supabase functions deploy iap-receipt-verify --project-ref vdkqrqtrftzhbtquzked
```

## AI müzik dakikası
- iOS/Android: App Store / Play IAP → `ai-music-iap-verify` → anında dakika
- Satın alma geçmişi: Ayarlar → `satin_alma_gecmisim` (coin + AI müzik)

## Mobil
- `expo-iap` plugin (`app.config.ts`)
- Cüzdan → `CoinPaketiSatinAl` (yalnız IAP)
- AI Müzik → `AiMuzikPaketSatinAl` (yalnız IAP) + alttan sheet
- Development build gerekir (Expo Go IAP desteklemez)
