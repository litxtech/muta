# 04 — Apple 2.5.19 Uyum Denetimi (Gizli / Pasif / Belgelenmemiş İşlevler)

## 1. Yöntem

Taranan desenler (kod tabanı, `node_modules` hariç):

```
hidden | dormant | undocumented | remote feature | feature flag | dynamic import |
require( değişken | WebView | admin | testMode | internal | killSwitch | gizle
```

Her bulgu için üç soru soruldu: (a) gerçek kullanım amacı ne, (b) kullanıcı bunu görebiliyor mu, (c) inceleme sırasında farklı davranıyor mu.

## 2. Bulgular ve yapılan işlemler

| # | Bulgu | Konum | Risk | İşlem |
| --- | --- | --- | --- | --- |
| 1 | 9 adet oynanabilir oyun (Zeus, Nox Reels, Kozmik Kaskad, Fair Spin, Astral Falls, Storm King, Sis Spin, Dede, Slot) | `src/moduller/oyunlar`, `supabase/functions`, `assets` | **Kritik** — App Store tanıtımında yer almayan oyunlar | Tamamen kaldırıldı (bkz. 02) |
| 2 | Oyun Stüdyosu: oyun oluşturma editörü, şablon motoru, yayınlama, dinamik yükleyici | `apps/super-admin/app/admin/oyun*`, `creator_studio_*` | **Kritik** — 4.2.6 (App Generation Services) | Ekranlar silindi, sunucu yetkileri kapatıldı |
| 3 | Sonuç belirleme: `fruit_wheel_admin_force_next`, `_publish_fruits`, `_save_policy`, `game_admin_math_*`, `game_cikis_*` | Admin API'leri + RPC | **Kritik** — sonucun sunucuda elle belirlenmesi | İstemci kodu silindi, RPC yetkileri alındı |
| 4 | Uzaktan oyun görünürlüğü: `admin_oyun_gorunurluk_ayarla`, `oyun_bayrak_anahtari`, `game_control_configs` | RPC + realtime hook | **Yüksek** — binary'de olmayan oyunu etkinleştirme | Sunucu yetkileri kapatıldı; istemci yalnızca `fruit_wheel` kabul ediyor |
| 5 | `/webview` rotası: herhangi bir `https://` adresini uygulama içi tarayıcıda açıyor | `app/webview.tsx` → `TamusoWebViewScreen` | **Orta** — belgelenmemiş web içeriği | `https` zorunlu, `javascript:`/`file:`/`data:`/`blob:` şemaları engelli, kullanıcı adı/şifre içeren URL reddediliyor. İçerik hâlâ herhangi bir alan adı olabilir (bkz. §5) |
| 6 | Giriş ekranında sunucudan yönetilen `sosyal_medya_gizle` / `tum_butonlar_gizle` | `app/(auth)/login.tsx`, `GirisLobisi` modülü, admin paneli | **Orta** — inceleme sırasında farklı görünüm izlenimi | Belgelenmiş yönetim ayarı olarak korundu; politikası §5'te tanımlandı |
| 7 | `expo-updates` (OTA ile JS değiştirme) | `package.json` (kurulu değil), `app.config.ts` | — | **Yok**: Expo Updates bağımlılığı ve `updates` yapılandırması bulunmuyor. Uygulama yalnızca mağaza binary'siyle güncellenir |
| 8 | Test/geliştirici menüleri | `app/(tabs)/cihazlar.tsx`, `scripts/*` | Düşük | `cihazlar` kullanıcıya açık oturum yönetimi ekranıdır (gizli değil). Geliştirici betikleri pakete girmiyor |
| 9 | Özellik bayrakları (`feature_flags`) | Supabase + `OzellikBayragiAktifMiSunucu` | Düşük | Kill switch'ler yalnızca **kapatma** yönünde kullanılıyor (moderasyon/acil durdurma). Kaldırılan oyun/Stüdyo bayrakları migration ile kapalı |

## 3. İnceleme sırasında farklı davranış

Aranan mekanizmalar ve sonuç:

- İnceleme algılama (`isReview`, `sandbox`, `review_build`, `__DEV__` ile özellik gizleme): **bulunamadı**.
- Sunucudan gelen "review modu" bayrağı: **bulunamadı**.
- Uygulama sürümü / bundle id'ye göre dallanan gizli ekran: **bulunamadı** (yalnızca normal `Platform.OS` ve özellik bayrağı kontrolleri var).
- Dinamik kod yükleme (`eval`, uzaktan JS bundle, `import()` ile URL): **bulunamadı**. `expo-updates` yok.
- Uzaktan oyun yükleme (`remote_game_load_enabled` bayrağı ve `studio-r2-smoke`): kaldırıldı.

Sonuç: uygulama, inceleme sırasında ve yayınlandıktan sonra **aynı** belgelenmiş ekran kümesini gösterir. Tek istisna, yönetim panelinden yönetilen giriş lobisi görünümüdür (§5).

## 4. Korunan meşru servisler (gizli diye silinmedi)

| Servis | Neden gerekli | Kullanıcıya görünürlük |
| --- | --- | --- |
| Kimlik doğrulama / oturum | Giriş, oturum yenileme | Görünür ekranlar |
| Yetkilendirme (RLS + roller) | Veri güvenliği | Dolaylı |
| Moderasyon ve şikâyet | Topluluk kuralları | Görünür (`raporlarim`, admin) |
| Dolandırıcılık/ kötüye kullanım önleme | Ledger tutarlılığı, rate limit | Görünmez, altyapı |
| Ödeme doğrulama (`iap-receipt-verify`) | Apple/Google makbuz doğrulama | Satın alma akışı |
| Bildirim teslimi (`notification-push`) | Push | Ayarlardan açılıp kapanır |
| Medya işleme (`react-native-compressor`) | Yükleme boyutu | Dolaylı |
| Gerçek zamanlı senkron (`realtime`) | Mesaj, hediye, PK | Ekranlarda |
| Güvenlik günlükleri | Denetim | Yalnızca admin |
| Hesap silme (`hesap-sil`) | App Store zorunluluğu | `app/hesap-sil` |
| Gizlilik kontrolleri | KVKK/GDPR | `app/ayarlar/gizlilik` |

## 5. Kalan riskler ve öneriler

1. **WebView alan adı kısıtı yok.** `isSafeHttpsUrl` yalnızca şemayı doğrular. Öneri: izinli alan adı listesi (`tamuso.app`, `*.supabase.co`, ödeme sağlayıcı alan adları) ve liste dışı URL'lerde harici tarayıcıya yönlendirme.
2. **Giriş lobisi görünürlük anahtarları.** `sosyal_medya_gizle` ve `tum_butonlar_gizle` inceleme döneminde kapatılırsa Apple bunu "incelemeye özel davranış" olarak değerlendirebilir. Öneri: bu anahtarlar yalnızca sağlayıcı gerçekten devre dışıyken kullanılmalı ve App Review notlarında belirtilmeli. Bu çalışmada davranış değiştirilmedi (mevcut işlev korunur), risk burada kayda geçirildi.
3. **Agora + LiveKit birlikte.** `react-native-agora` ve `agora-token` hâlâ depoda. Kullanılmayan ikinci bir RTC SDK'sı binary'de "pasif modül" olarak görünebilir. Cihaz testiyle doğrulanıp kaldırılması önerilir.

## 6. Kanıtlar

```text
rg -n "isReview|reviewMode|appreview" src app      → 0 sonuç
rg -n "expo-updates" package.json app.config.ts    → 0 sonuç
rg -n "eval\(|new Function\(" src app             → 0 sonuç
rg -n "creator_studio" src app                     → yalnızca migration (yetki kapatma)
rg -n "force_next|game_cikis|game_admin_math" src app → 0 sonuç (yalnızca migration)
```
