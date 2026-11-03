# 10 — iOS / Android Release Denetimi

> Bu ortamda `eas build` çalıştırılamadı (EAS oturumu, Apple/Google kimlik bilgisi ve macOS imzalama yok).
> Bu nedenle **binary içeriği doğrulanamadı**; aşağıdaki tablo kaynak/konfigürasyon düzeyindedir ve eksik kanıtlar açıkça işaretlenmiştir.

---

## 1. iOS konfigürasyonu (kaynak düzeyinde doğrulandı)

| Alan | Değer | Dosya |
| --- | --- | --- |
| Bundle identifier | `com.litxtech.muta` | `app.config.ts` |
| Sürüm | `1.4.0` | `app.config.ts`, `package.json` |
| Entitlements | `aps-environment`: production/development (APP_ENV'e göre) | `app.config.ts` |
| Arka plan modları | `remote-notification`, `audio`, `voip` | `app.config.ts` |
| Live Activity | `NSSupportsLiveActivities: true`, `...FrequentUpdates: false` | `app.config.ts` |
| Şifreleme beyanı | `ITSAppUsesNonExemptEncryption: false` | `app.config.ts` |
| Apple ile giriş | `usesAppleSignIn: true` | `app.config.ts` |
| Tablet | `supportsTablet: false` | `app.config.ts` |
| Yerelleştirme | `CFBundleLocalizations`: tr, en, es, pt, ar, **fr, fil** | Bu çalışmada fr + fil eklendi |
| Kamera/mikrofon/Bluetooth metinleri | İngilizce, kullanım amacı açık | `app.config.ts` |

### İzin metinleri

- `NSCameraUsageDescription` — profil fotoğrafı, DM, canlı görüntülü görüşme, KYC.
- `NSMicrophoneUsageDescription` — sesli oda, canlı yayın, arama; arka plan sesi açıklaması dahil.
- `NSBluetoothAlwaysUsageDescription` / `...Peripheral...` — kulaklık bağlantısı.

Bu metinler Apple 5.1.1 için yeterlidir; ancak **KYC** ifadesi kullanıldığı için App Review notunda hangi ekranda kullanıldığı (`src/moduller/kyc`, `app/kyc`) belirtilmelidir.

### Eksik / doğrulanması gereken

| Konu | Durum | Yapılacak |
| --- | --- | --- |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | Expo 57 eklentileri üretir; **üretilen dosya incelenmedi** | Derleme sonrası `.ipa` içinde kontrol |
| Embedded frameworks (LiveKit, WebRTC) | `@livekit/react-native-webrtc` | `.ipa` içinde `Frameworks/` listesi |
| App extension (CallKit / Live Activity) | `expo-widgets`, `TamusoLiveActivity` | `ExpoWidgetsTarget` ve entitlements doğrulanmalı |
| Push sertifikası | Workspace kuralı: EAS'te Apple Push Key kayıtlı | Sonraki `eas build` sırasında "Setup Push Notifications?" → **Yes** |
| Kaldırılan oyun referansı | Kaynakta yok | Binary içinde `zeus`/`storm`/`kaskad` string taraması yapılmalı |

## 2. Android konfigürasyonu

| Alan | Değer |
| --- | --- |
| Application ID | `com.litxtech.muta` |
| minSdkVersion | 24 |
| İzinler | CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, ACCESS_WIFI_STATE, ACCESS_NETWORK_STATE, BLUETOOTH_CONNECT, FOREGROUND_SERVICE(+MICROPHONE, MEDIA_PLAYBACK), WAKE_LOCK, POST_NOTIFICATIONS, VIBRATE, RECEIVE_BOOT_COMPLETED, USE_FULL_SCREEN_INTENT |
| FCM | `google-services.json` (kök veya EAS env) |
| Adaptive icon | foreground/background/monochrome mevcut |
| Klavye | `softwareKeyboardLayoutMode: 'resize'` |

Not: `USE_FULL_SCREEN_INTENT` Play Console'da "Calling app" beyanı gerektirir (`app.config.ts` yorumunda da belirtilmiş). Aksi hâlde Play incelemesi reddedebilir.

## 3. Kaynak düzeyinde kaldırma doğrulaması

| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| Oyun motorları | `rg -i "zeus|nox|kaskad|fair.?spin|astral|storm.?king|sis.?spin" src app` | 0 gerçek referans |
| Oyun assetleri | `rg "realm-of-storms|assets/zeus|assets/nox-reels|assets/dede"` | 0 |
| Edge function tanımları | `supabase/config.toml` | 5 silinmiş tanım kaldırıldı |
| Stüdyo fonksiyonu | `supabase/functions/studio-r2-smoke` | Silindi |
| Oyun rotaları | `app/oyun/*` | Yalnızca `fruit-wheel*` var |
| Admin oyun ekranları | `apps/super-admin/app/admin/*` | `oyunlar`, `oyun-algoritma`, `cikis-plani` yok |

## 4. Binary doğrulaması (yapılmadı)

Aşağıdaki komutlar derleme sonrası çalıştırılmalıdır:

```bash
# iOS
unzip -l build.ipa | grep -Ei "zeus|nox|kaskad|fair|astral|storm|sis|dede|slot|studio"
unzip -p build.ipa "Payload/*.app/Info.plist" | plutil -p -
# Privacy manifest
unzip -l build.ipa | grep -i PrivacyInfo.xcprivacy

# Android
unzip -l build.aab | grep -Ei "zeus|nox|kaskad|fair|astral|storm|sis|dede|slot|studio"
bundletool dump manifest --bundle=build.aab
```

Beklenen: yalnızca `fruit_wheel` ile ilgili kayıtlar; `assets/oyunlar/fruit-wheel/*`.
Bulunursa: ilgili `require()` veya `app.json`/`metro` kalıntısı temizlenmeli.

## 5. Build engelleri ve riskler

| Risk | Etki | Not |
| --- | --- | --- |
| `tsc` 118 hata (önceden var) | Derleme engellemez (Metro tip kontrolü yapmaz) | Teknik borç; `StyleSheet.absoluteFillObject`, `CameraType.Back` gibi RN 0.86 uyumsuzlukları |
| `google-services.json` yoksa | Android push derlemesi | EAS env ile sağlanmalı |
| Push sertifikası | iOS push | Workspace kuralına göre sonraki build'de "Yes" seçilmeli |
| Agora + LiveKit | Binary boyutu, olası çakışma | Cihaz testi sonrası biri kaldırılmalı |
| `CFBundleLocalizations` eksikliği | iOS'ta fr/fil görünmemesi | Bu çalışmada düzeltildi |

## 6. Sonuç

- Kaynak ve konfigürasyon düzeyinde kaldırma **tamam**.
- Gerçek dağıtım paketi **denetlenmedi** — derleme erişimi olmadığı için. Bu, raporun en önemli sınırıdır ve `12_FINAL_RELEASE_CHECKLIST.md` §1'de zorunlu adım olarak yer alır.
