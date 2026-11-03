# 01 — Proje Denetimi ve Modül Envanteri

Tarih: 3 Kasım 2026
Dal: `temizlik/appstore-uyum`
Başlangıç kontrol noktası: `51c24af chore: checkpoint before App Store cleanup (working tree as-is)`

---

## 1. Doğrulanan teknoloji yığını

Aşağıdaki sürümler `package.json` ve `app.config.ts` dosyalarından okunmuştur; varsayım yoktur.

| Katman | Teknoloji | Sürüm / kanıt |
| --- | --- | --- |
| Uygulama çatısı | Expo | `expo@~57.0.27` |
| React Native | RN | `react-native@0.86.3` |
| React | React | `react@19.2.3` |
| Yönlendirme | Expo Router | `expo-router@~57.0.25` (dosya tabanlı, `app/`) |
| Dil | TypeScript | `tsconfig.json`, `npx tsc --noEmit` çalışıyor |
| Backend | Supabase | `@supabase/supabase-js`, `supabase/migrations` (378 dosya) |
| Sunucu fonksiyonları | Supabase Edge Functions (Deno) | `supabase/functions` altında 21 aktif fonksiyon |
| Gerçek zamanlı sesli/görüntülü | LiveKit | `@livekit/react-native`, `livekit-client`, `livekit-token` edge function |
| Eski RTC kalıntısı | Agora | `react-native-agora`, `agora-token` edge function (bkz. 03 raporu) |
| Uygulama içi satın alma | expo-iap + `iap-receipt-verify` | Apple IAP / Google Play Billing |
| Bildirim | expo-notifications + `notification-push` + FCM | `google-services.json` / EAS env |
| Çok dillilik | i18next + react-i18next | 7 dil: tr, en, es, pt, ar, fr, fil |
| Medya | expo-image-picker, expo-video, expo-audio, react-native-compressor | — |
| Web admin | `apps/super-admin` — Expo Router **web export** | `expo export --platform web`, port 8090 |
| Canlı aktivite / widget | expo-widgets, TamusoLiveActivity, CallKit köprüsü | `src/moduller/tamuso-activity` |
| Test/doğrulama | `npx tsc --noEmit`, `scripts/` altında SQL ve simülasyon betikleri | — |

**Projede olmayan teknolojiler (varsayılmadı):** Web sitesi için ayrı bir Next.js/Vite uygulaması yoktur; web tanıtım sayfaları `src/moduller/web-tanitim` içinde RN Web bileşenleriyle üretilir. Flutter, Kotlin/Swift çoklu platform kodu, GraphQL, Redux yoktur.

## 2. Kimlik ve dağıtım bilgileri

- Uygulama adı: Tamuso (paket `muta`, sürüm `1.4.0`)
- iOS bundle identifier: `com.litxtech.muta`
- Android package: `com.litxtech.muta`
- `app.config.ts` içinde `aps-environment`, `UIBackgroundModes: remote-notification` — push için korunmalı (workspace kuralı).
- Android izinleri: kamera, mikrofon, bluetooth, foreground service (mikrofon/medya), wake lock, bildirim.

## 3. Dizin yapısı

```
app/                     Expo Router rotaları (ekran girişleri)
apps/super-admin/        Web yönetim paneli (Expo web export)
assets/                  Görsel + ses varlıkları
src/
  bilesenler/            Ortak uygulama bileşenleri (bilgi panelleri dahil)
  components/            Eski/çekirdek ortak bileşenler (Screen, EkranBasligi…)
  contexts/              Auth, Wallet, tema vb. sağlayıcılar
  ekranlar/              Ekran bazlı modüller
  hooks/                 Ortak kancalar
  i18n/                  7 dil sözlüğü + tipli çeviri anahtarları
  lib/                   Supabase istemcisi vb.
  moduller/              80 işlevsel modül (canlı yayın, odalar, cüzdan, oyun…)
  ortak/                 Hata sınırları, medya, ülke yardımcıları
  services/              API servisleri
  tasarim-sistemi/       Renk, boşluk, yarıçap, tipografi, header tokenları
  types/                 Veri modelleri
  web/                   Web'e özgü yardımcılar
  yapilandirma/          Ortam değişkenleri
supabase/
  functions/             21 Edge Function
  migrations/            378 migration
raporlar/                Bu denetim raporları
scripts/                 Geliştirme/test betikleri (paket içine girmez)
```

## 4. Modül sınıflandırması

Sınıf tanımları: **A** korunacak aktif sistem · **B** kaldırılan oyun/Stüdyo · **C** ölü kod · **D** gerekli arka plan servisi · **E** belirsiz (elle incelenecek).

### A — Korunan aktif sistemler

| Modül | Amaç | Giriş noktası |
| --- | --- | --- |
| `src/moduller/canli-yayin` | Canlı yayın izleme/yayın açma | `app/canli/index.tsx`, `app/canli/[id].tsx` |
| `src/moduller/ses-odalari` | Sesli oda oturumu, mikrofon, koltuklar | `app/room/[id].tsx`, `app/(tabs)/rooms.tsx` |
| `src/moduller/pk` + `pk` | PK karşılaşmaları | `app/pk/index.tsx` |
| `src/moduller/cuzdan` | Cüzdanım, coin yükleme, hareketler, yayıncı kazancı | `app/(tabs)/wallet.tsx`, `app/cuzdan/*` |
| `src/moduller/hediye*` | Sanal hediye gönderimi ve geçmişi | Yayın/oda/mesaj içinden |
| `src/moduller/mesajlasma` | Sohbet listesi, mesajlaşma | `app/(tabs)/messages.tsx`, `app/mesaj/[id].tsx` |
| `src/moduller/kullanici-profili` | Profil, takip, istatistik | `app/(tabs)/profile.tsx`, `app/kullanici/[id].tsx` |
| `src/moduller/kesfet`, `kisiler-kesif` | Keşfet, kişi bulma, ülke filtresi | `app/kesfet.tsx`, `app/(tabs)/index.tsx` |
| `src/moduller/durum` | Sosyal gönderi akışı (fotoğraf/video/metin) | `app/(tabs)/durum.tsx`, `app/durum/*` |
| `src/moduller/oyunlar/fruit-wheel` | **Tek korunan oyun: Meyve Çarkı** | `app/oyun/fruit-wheel.tsx` |
| `src/moduller/iap` | Apple IAP / Google Play doğrulama | Coin paketleri |
| `src/moduller/bildirim*` | Push ve uygulama içi bildirim | — |
| `src/moduller/moderasyon`, `raporlarim`, `engellenen-kullanicilar` | Şikâyet, engelleme, moderasyon | — |
| `src/moduller/tamuso-activity` | iOS Live Activity / CallKit | Arka plan arama |
| `src/tasarim-sistemi` | Token tabanlı tema | Tüm ekranlar |

### B — Kaldırılan (bu çalışmada silindi)

Ayrıntı: `02_REMOVED_FEATURES.md`. Özet: 175 dosya silindi — Zeus, Nox Reels, Kozmik Kaskad, Fair Spin, Astral Falls, Storm King, Sis Spin, Dede, Slot oyun motorları/assetleri/edge functionları, Oyun Stüdyosu yönetim ekranları, çıkış planı ve oyun algoritma API'leri, Stripe ödeme fonksiyonları, `sis-spin/` bağımsız prototip uygulaması.

### C — Ölü kod / kalıntı (temizlendi veya raporlandı)

- `assets/realm-of-storms/*` (Storm King artıkları; Meyve Çarkı yalnızca 7 ses dosyasını kullanıyordu) → 7 dosya `assets/oyunlar/fruit-wheel/audio/fw-*.wav` olarak kopyalandı, klasör silindi.
- `assets/oyunlar/astral-falls/dist/index.html` → silindi.
- `kaskad-sim-1m.json` (Kozmik Kaskad simülasyon çıktısı) → silindi.
- `scripts/generate-win-sfx.mjs`, `kaskad-*.ts`, `nox-simulator.ts`, `storm-king-*`, `process-zeus-art.py` → silindi.
- `supabase/functions/studio-r2-smoke` (boş kalmış Stüdyo smoke fonksiyonu) → silindi.
- `supabase/config.toml` içindeki silinmiş fonksiyon tanımları (zeus/storm/kaskad/fair-spin, stripe-*, ajans-pay) → kaldırıldı.

### D — Gerekli arka plan servisleri (korundu, kullanıcıya görünmez ama belgelenmiş)

`livekit-token`, `notification-push`, `iap-receipt-verify`, `hesap-sil`, `admin-gunluk-ozet`, `misafir-cihaz-oturum`, `link-preview`, `share-redirect`, `canli-kesit`, `rtc-livekit-olcum`, `blog-asistan`, `deepseek-assistant`, `deepseek-translate`, `ai-music-*`, `ajans-dekont-pdf`, `admin-kullanici-*`, `admin-ornek-kullanicilar`, `agora-token`.
Bunlar App Store 2.5.19 kapsamında "gizli özellik" değildir; kimlik doğrulama, ödeme doğrulama, moderasyon ve bildirim altyapısıdır (bkz. `04_APPLE_2519_COMPLIANCE.md` §3).

### E — Belirsiz / karar bekleyen (silinmedi)

| Öğe | Neden belirsiz | Öneri |
| --- | --- | --- |
| `react-native-agora` + `agora-token` | LiveKit ile birlikte duruyor; 5 referans | Sesli odalar tamamen LiveKit ise kaldırılabilir; cihaz testi gerekir |
| `scripts/oyun-cuzdan-sql-tests.ts` | Kaldırılan oyun RPC'lerini test ediyor, ama `fruit_wheel` cüzdan kurallarını da doğruluyor | Yalnızca fruit_wheel bölümü kalacak şekilde sadeleştirilmeli |
| `src/i18n/locales/_fil_value_cache.json` | Çeviri üretim artefaktı, uygulamaya girmiyor | Paket dışı; silinebilir |
| `docs/_i18n_*.json` | i18n tarama çıktıları | Arşivlenebilir |
| `apps/super-admin/app/admin/oyunlar.tsx` vb. | Bu çalışmada silindi; kalan menü bağlantıları temizlendi | — |

## 5. Başlangıç durumu ve doğrulama

- Başlangıç `tsc --noEmit`: **175 hata** (hepsi önceden var olan, Expo 57 / RN 0.86 tip değişikliklerinden).
- Bu çalışma sonunda: **118 hata** (yalnızca silinen modüllere ait hatalar düştü; yeni hata eklenmedi).
- `apps/super-admin` typecheck: aynı ortak hata havuzu, yeni hata yok.
- Gerçek iOS/Android derlemesi bu ortamda alınamadı (EAS/Apple kimlik bilgisi ve macOS imzalama gerekir) → `10_IOS_ANDROID_BUILD_AUDIT.md` içinde açıkça belirtilmiştir.

## 6. Kritik kullanıcı akışları (regresyon kapsamı)

1. Kayıt → doğrulama → giriş → oturum yenileme
2. Akış (durum) → gönderi oluşturma → beğeni/yorum
3. Keşfet → ülke filtresi → profil → takip
4. Sesli oda → koltuk → mikrofon → hediye → çıkış
5. Canlı yayın → izleme → yorum → hediye → PK → çıkış
6. Cüzdanım → coin paketi → satın alma → hareketler
7. Meyve Çarkı → tur → seçim → sonuç → geçmiş
8. Mesajlaşma → medya → bildirim
9. Ayarlar → dil değiştirme → gizlilik → hesap silme
10. Web admin → kullanıcı/moderasyon/finans görünümü
