# LiveKit Token Edge Function

Secret **asla** mobil bundle'da olmaz. Sadece Supabase Edge Function secrets.

## Secrets (Dashboard veya CLI)
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL` (ornek: `wss://xxxx.livekit.cloud`)

CLI (muta projesine login olduktan sonra):

```bash
npx supabase link --project-ref vdkqrqtrftzhbtquzked
npx supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://...
npx supabase functions deploy livekit-token --project-ref vdkqrqtrftzhbtquzked
```

Dashboard alternatif:
1. Project Settings → Edge Functions → Secrets → ucunu ekle
2. Edge Functions → Deploy `livekit-token` (`supabase/functions/livekit-token`)

## Akis
1. Mobil JWT + roomName + role POST eder
2. Function kullaniciyi dogrular + `livekit_token_istegi_kaydet` (kill_live)
3. Kisa sureli LiveKit JWT uretir
4. Mobil `LiveKitBaglantiYoneticisi` ile baglanir

## Mobil env (`.env`)
```
EXPO_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
EXPO_PUBLIC_LIVEKIT_TOKEN_URL=https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/livekit-token
```

Native ses: `@livekit/react-native` + Expo Dev Client (FAZ 5.1). Expo Go'da token alimi gercek olabilir; oda baglantisi mock kalabilir.
