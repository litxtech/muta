# Agora RTC Token Edge Function

**App Certificate asla mobilde olmaz.** Sadece Edge secrets.

## Secrets (sen vereceksin)
```bash
npx supabase secrets set --project-ref vdkqrqtrftzhbtquzked \
  AGORA_APP_ID=... \
  AGORA_APP_CERTIFICATE=...
```

## Deploy
```bash
npx supabase functions deploy agora-token --project-ref vdkqrqtrftzhbtquzked --use-api
```

## Mobil (.env)
```
EXPO_PUBLIC_RTC_PROVIDER=agora
EXPO_PUBLIC_AGORA_APP_ID=...
EXPO_PUBLIC_AGORA_TOKEN_URL=https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/agora-token
```

Not: `react-native-agora` Expo Go'da calismaz — development build gerekir (`expo-dev-client` + EAS).
