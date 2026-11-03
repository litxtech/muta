# 08 — Güvenlik ve Gizlilik Denetimi

> Kapsam: istemci kodu, Edge Function'lar, migration politikaları, admin paneli.
> Veritabanına canlı bağlantı kurulmadı; RLS **politikalarının varlığı** migration dosyalarından doğrulandı, üretimdeki etkinlik durumu doğrulanamadı.

---

## 1. İstemci sır taraması (temiz)

```
rg "service_role|SERVICE_ROLE|sk_live|sk_test|AKIA|BEGIN PRIVATE KEY" src app
```

Sonuç: yalnızca **yorum satırları** (`OrtamDegiskenleri.ts`: "Secret burada olmaz", `IapReceiptDogrulamaIstegiHazirla.ts`: "doğrulama Edge Function'da"). Gerçek anahtar yok.

- İstemcide yalnızca `EXPO_PUBLIC_SUPABASE_ANON_KEY` ve `EXPO_PUBLIC_SUPABASE_URL` gibi **yayınlanabilir** değerler var (`src/yapilandirma/OrtamDegiskenleri.ts`).
- Oturum belirteçleri `expo-secure-store` üzerinden saklanıyor (`GuvenliOturumDepolama.ts`, `MisafirCihazOturumDepolama.ts`).
- Biyometrik kilit: `BiyometriKilidi.ts` (expo-local-authentication).

## 2. Kimlik doğrulama ve yetkilendirme

| Alan | Durum |
| --- | --- |
| Supabase Auth (e-posta + OAuth) | Korundu; `auth.callback` deep link işleyicisi var |
| RLS | 124 migration `enable row level security` içeriyor |
| Admin yetkisi | `AdminYetkisiVarMi(profile)` + sunucu tarafı `is_admin`; arayüz kapısı yalnızca ek katman (`AdminOturumKapisi.tsx`) |
| Admin paneli ayrımı | `apps/super-admin` ayrı web export; **mobil binary'ye dahil değil**. Konsol logları temizleniyor (`adminKayitlariniTemizle`), geri tuşu kalkanı var (`adminGecmisKalkani`) |
| Kaldırılan oyun RPC'leri | `anon`/`authenticated` yetkileri alındı (migration) |

## 3. Ödeme güvenliği

- Apple IAP / Google Play Billing: makbuz doğrulama sunucuda (`iap-receipt-verify` Edge Function, `service_role` + Apple/Google API).
- `fruit_wheel_confirm` sunucu otoriteli; istemci kazanını göndermiyor (yalnızca tur + seçim + idempotency anahtarı).
- Idempotency: `p_key` ile tekrar işlem koruması.
- Stripe fonksiyonları kaldırıldı → istemcide kart verisi işleyen kod yok.
- **Geçmiş Stripe kayıtları** okunur durumda (satın alma geçmişi ekranı `provider = 'stripe'` → "Kart" etiketi). Bu bir veri gösterimi, ödeme yolu değil.

## 4. WebView güvenliği

`src/banner/webview/WebViewSecurity.ts`:

- Yalnızca `https:` kabul ediliyor.
- `javascript:`, `file:`, `data:`, `intent:`, `vbscript:`, `about:`, `blob:` şemaları reddediliyor.
- `localhost`, kullanıcı adı/şifre içeren URL, kontrol karakterleri reddediliyor.
- `onShouldStartLoadWithRequest` her yönlendirmeyi aynı doğrulamadan geçiriyor.

**Kalan risk:** alan adı beyaz listesi yok. Öneri: `tamuso.app`, `*.supabase.co` ve ödeme sağlayıcı alan adları dışındakileri `Linking.openURL` ile harici tarayıcıya göndermek.

## 5. Gizlilik ve veri

| Konu | Durum |
| --- | --- |
| Hesap silme | `app/hesap-sil/index.tsx` + `hesap-sil` Edge Function |
| Veri indirme / çevrimdışı | `app/ayarlar/veri-cevrimdisi.tsx` |
| Gizlilik ayarları | `app/ayarlar/gizlilik.tsx` (takipçi/gönderi gizleme) |
| Engelleme | `src/moduller/*engel*`, `app/engellenen-kullanicilar` |
| Şikâyet | `app/raporlarim`, moderasyon modülü |
| Fotoğraf/video izinleri | `expo-image-picker` + `Info.plist` metinleri `app.config.ts` içinde |
| Push izni | `aps-environment` + `remote-notification` (workspace kuralı gereği korundu) |

## 6. Rate limiting / kötüye kullanım

- Sunucu tarafı limitler büyük ölçüde **PostgreSQL/RLS ve RPC içi kontrollerle** yapılıyor (migration düzeyinde). Edge Function'larda açık bir genel rate limiter yok; yalnızca `_shared/deepseek/helpers.ts` 429 yanıtını ele alıyor.
- İstemcide `hataRateLimited` çeviri anahtarı var → sunucudan gelen limit hatası kullanıcıya gösteriliyor.
- **Öneri:** hediye gönderme, yayın açma ve oyun katılımı için RPC içinde `pg_advisory_xact_lock` + zaman penceresi limiti; `notification-push` için IP bazlı sınır.

## 7. Bu çalışmada yapılan güvenlik sertleştirmeleri

1. Sonuç belirleme RPC'lerinin (`force_next`, `publish`, `save_policy`, `game_admin_math_*`, `game_cikis_*`) `anon`/`authenticated` yetkileri kaldırıldı.
2. `creator_studio_*` fonksiyon ve tablolarının istemci erişimi kapatıldı.
3. Kaldırılan oyun tablolarına yazma yolu kapatıldı (arşiv).
4. İstemci oyun görünürlüğü `fruit_wheel` ile sınırlandı (sunucu hatası/kötüye kullanım savunması).
5. Silinen Stripe/ajans ödeme fonksiyonları ile istemci ödeme yüzeyi kaldırıldı.

## 8. Kalan riskler (öncelik sırasıyla)

| # | Risk | Etki | Öneri |
| --- | --- | --- | --- |
| 1 | WebView alan adı kısıtı yok | Orta | Beyaz liste + harici yönlendirme |
| 2 | Agora + LiveKit ikili RTC | Orta | Kullanılmayan SDK'yı kaldır |
| 3 | Edge Function'larda genel rate limit yok | Orta | Sayaç tablosu + `pg_advisory_lock` |
| 4 | Üretim RLS durumu doğrulanmadı | Yüksek (doğrulanana kadar) | `supabase db lint` / `pg_policies` denetimi |
| 5 | Admin paneli herkese açık bir URL'de barınıyorsa | Yüksek | Hosting katmanında IP/VPN ya da ek basic-auth |
| 6 | `scripts/` altında eski test fixture'ları | Düşük | Yalnızca geliştirme ortamı; CI'da ayrı tutulmalı |

## 9. Doğrulama komutları

```text
rg "service_role|sk_live|BEGIN PRIVATE KEY" src app   → 0 gerçek eşleşme
rg "enable row level security" supabase/migrations    → 124 dosya
rg "expo-secure-store" src                            → 4 dosya
rg "isSafeHttpsUrl|shouldAllowWebViewNavigation" src  → WebView kapısı
```
