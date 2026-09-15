# IAP Receipt Verify Edge Function

Mobilde Apple/Google secret **olmaz**. Dogrulama burada.

## Secrets
- `IAP_SANDBOX_ALLOW` — `true` (varsayilan) gelistirme; prod'da `false` + store credentials
- (sonra) Apple shared secret / Google service account JSON

## Deploy
```bash
npx supabase functions deploy iap-receipt-verify --project-ref vdkqrqtrftzhbtquzked
```

## Mobil
```
EXPO_PUBLIC_IAP_VERIFY_URL=https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/iap-receipt-verify
```

Akis: JWT + packageId POST → sandbox kabul → `coin_satin_al_onayla` RPC.
