# IAP + Stripe (satış)

## Kural
- **iOS dijital coin** → yalnızca App Store IAP (`expo-iap`)
- **Android** → Play Billing IAP
- **Web / izinli kanal** → Stripe Checkout (`stripe_enabled`)

## App Store Connect ürünleri (Consumable)
Bundle: `com.litxtech.muta`

| Product ID | Örnek |
|------------|--------|
| `com.litxtech.muta.coins_60` | Starter |
| `com.litxtech.muta.coins_300` | Popular |
| `com.litxtech.muta.coins_1280` | VIP |
| `com.litxtech.muta.coins_6480` | Legend |

Aynı ID'leri Play Console'da da oluştur.

## SQL
`supabase/migrations/011_iap_stripe.sql`

```sql
update public.feature_flags set enabled = true where key in ('iap_enabled');
-- Stripe web icin:
-- update public.feature_flags set enabled = true where key = 'stripe_enabled';
```

## Edge secrets
```
IAP_SKIP_VERIFY=1          # sandbox; prod'da kaldir + Apple/Google verify ekle
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Deploy:
```
npx supabase functions deploy iap-receipt-verify --project-ref vdkqrqtrftzhbtquzked
npx supabase functions deploy stripe-checkout --project-ref vdkqrqtrftzhbtquzked
npx supabase functions deploy stripe-webhook --project-ref vdkqrqtrftzhbtquzked
```

Stripe webhook URL:
`https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/stripe-webhook`
Event: `checkout.session.completed`

## Mobil
- `expo-iap` plugin (`app.config.ts`)
- Cüzdan → `CoinPaketiSatinAl`
- Development build gerekir (Expo Go IAP yok)
