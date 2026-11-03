# 07 — Performans Raporu

> Bu rapor iki bölümdür: **ölçülebilen/uygulanan** değişiklikler ve **ölçülmemiş** alanlar.
> Cihaz üzerinde FPS/bellek/açılış süresi ölçümü bu ortamda yapılmadı; uydurulmadı.

---

## 1. Uygulanan ve ölçülebilen değişiklikler

### 1.1 Paket boyutu

| Ölçüm | Değer | Kaynak |
| --- | --- | --- |
| Silinen asset boyutu | **40.472.636 bayt ≈ 38,6 MB** (115 dosya) | `git cat-file -s` ile HEAD blob boyutları toplandı |
| Silinen kaynak dosya | 107 dosya (oyun motorları, Stüdyo, prototipler) | `git diff --cached --name-status` |
| Silinen toplam satır | ~16.900 | `git diff --cached --shortstat` |

Öne çıkanlar:

- `assets/realm-of-storms/**` — 46 dosya, Storm King artıkları (arka plan, semboller, 30+ ses). Meyve Çarkı yalnızca 7 ses dosyası kullanıyordu; bunlar `assets/oyunlar/fruit-wheel/audio/` altına taşındı (~1 MB).
- `assets/games/storm-king/**` (32 dosya), `assets/zeus/**` (14), `assets/nox-reels/**` (16), `assets/dede/**` (3).
- `assets/oyunlar/astral-falls/dist/index.html` (194 KB, paketlenmiş oyun).
- `sis-spin/`, `imports/fair-spin-reference/`, `imports/astral-falls-reference/` — depo boyutu; uygulama paketine girmiyordu.

**Beklenen etki:** JS bundle'da 6 oyun motorunun kodu kalmadı; asset paketinde ~38 MB azalma. Gerçek IPA/AAB boyutu EAS derlemesi olmadan doğrulanamaz (bkz. §4).

### 1.2 Başlangıç (cold start) maliyeti

- `app/oyun/fruit-wheel.tsx` yalnızca Meyve Çarkı'nı kaydediyor (`registerFruitWheel()`); diğer oyunların kayıt/ön yükleme çağrıları koddan çıktı.
- `useGorunurOyunKodlari` başlangıçta varsayılan olarak `['fruit_wheel']` döndürüyor, ağ gelene kadar boş liste göstermiyor → ilk boyamada düzen kayması yok. Sunucudan gelen liste artık filtrelendiği için gereksiz oyun kartı render edilmiyor.
- `metro.config.js` içindeki silinmiş oyun klasörü yoksayma kalıpları kaldırıldı; Metro artık var olmayan dizinleri taramıyor.

### 1.3 Bellek / dinleyici temizliği (kod düzeyinde doğrulanan)

| Alan | Durum |
| --- | --- |
| Realtime kanal abonelikleri | `useGorunurOyunKodlari` `removeChannel` + timer `clearTimeout` ile temizliyor (korundu) |
| Sesli oda kaynakları | `app/room/[id].tsx` odak/yıkım etkileri mevcut (değiştirilmedi) |
| Oyun ses oynatıcıları | `FruitWheelAudio` tek sefer ön yükleme (`warmed` bayrağı) ve `players` map'i ile tekrar oluşturmayı engelliyor |
| (?) açıklama paneli | `Modal` yalnızca açıldığında render ediliyor (`visible` prop), ekranlarda ek maliyet yok |

### 1.4 Görsel katman

- Yeni (?) düğmesi 26 px, tek `Ionicons` — ekran başına ek render maliyeti ihmal edilebilir.
- Başlık satırlarına eklenen `flexShrink`/`numberOfLines` sayesinde uzun çevirilerde yeniden ölçüm/taşma kaynaklı layout thrash azalır.

## 2. Kod düzeyinde tespit edilen performans riskleri (düzeltilmedi, öneri)

| # | Bulgu | Konum | Öneri |
| --- | --- | --- | --- |
| 1 | `StyleSheet.absoluteFillObject` kullanımı RN 0.86 tiplerinde hata veriyor (çalışma zamanında çalışıyor) | `src/moduller/ses-odalari/bilesenler/*`, `web-tanitim/*` | `StyleSheet.absoluteFill` dizisine geçiş; aynı anda 18 tip hatası kapanır |
| 2 | Agora + LiveKit birlikte yüklü; iki native RTC SDK'sı açılış süresi ve binary boyutu ekler | `package.json` | Sesli odalar LiveKit ise `react-native-agora` + `agora-token` kaldırılmalı (cihaz testi şart) |
| 3 | `ai-music` modülünde ağır ekranlar ana bundle'da | `src/ekranlar/ai-muzik/*` | `React.lazy`/`require` ile ekran bazlı bölme |
| 4 | `scripts/oyun-cuzdan-sql-tests.ts` 961 satır eski oyun fixture'ı | `scripts/` | Paket dışı; CI süresini kısaltmak için sadeleştirilmeli |
| 5 | `_fil_value_cache.json` (200 KB) `src/i18n/locales` içinde | `src/i18n/locales` | Uygulama import etmiyor; `scripts/i18n` altına taşınmalı ki Metro taramasın |

## 3. Ölçülmesi gerekenler (yapılmadı)

| Metrik | Neden yapılamadı | Nasıl ölçülür |
| --- | --- | --- |
| Cold start süresi | Simülatör/cihaz yok | `npx expo start --profile`, Xcode Instruments / Android Studio Startup Profiler |
| Akış FPS ve kaydırma | Aynı | FlashList `onEndReached` + Flipper/Perf Monitor |
| Bellek (oda/yayın 10 dk) | LiveKit bağlantısı gerekir | Xcode Memory Graph, `adb shell dumpsys meminfo` |
| Paket boyutu | EAS derlemesi gerekir | `eas build` sonrası `.ipa`/`.aab` içindeki `assets` klasörü |
| Video önizleme yükleme | Gerçek medya gerekir | `expo-video` hata/log izleme |

## 4. Doğrulama sınırı

Bu ortamda `eas build` çalıştırılamadı (Apple/Google kimlik bilgisi, macOS imzalama, EAS oturumu yok). Bu nedenle:

- "Paket 38 MB küçüldü" ifadesi **kaynak asset** ölçümüdür, nihai IPA/AAB ölçümü değildir.
- Nihai doğrulama `12_FINAL_RELEASE_CHECKLIST.md` içindeki derleme adımlarıyla yapılmalıdır.
