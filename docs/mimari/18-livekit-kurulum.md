# LiveKit kurulumu (RTC primary)

Agora kaldırıldı. Ses / görüntü / ses odası / canlı / 1:1 → **LiveKit**.

## Paketler
- `livekit-client`
- `@livekit/react-native`
- `@livekit/react-native-expo-plugin`
- `@livekit/react-native-webrtc`
- `@config-plugins/react-native-webrtc`

## Config
`app.config.ts` plugins:
- `@livekit/react-native-expo-plugin`
- `@config-plugins/react-native-webrtc`

`EXPO_PUBLIC_RTC_PROVIDER=livekit`  
`EXPO_PUBLIC_LIVEKIT_URL=wss://…livekit.cloud`  
`EXPO_PUBLIC_LIVEKIT_TOKEN_URL=…/functions/v1/livekit-token`

## Edge secrets
```bash
# Dashboard veya:
npx supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://...
npm run functions:deploy
```

## Build
Native WebRTC → **Expo Go yetmez**. Development build:
```bash
npx eas-cli build --platform android --profile development
npx eas-cli build --platform ios --profile development
```

iOS Push: bir sonraki build’de **Setup Push Notifications → Yes**.

## Kod
- Facade: `src/moduller/livekit/MedyaBaglantisi.ts`
- Bağlantı: `LiveKitBaglantiYoneticisi.ts`
- Token: `LiveKitTokenAl.ts` + `supabase/functions/livekit-token`
