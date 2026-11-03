# 02 — Kaldırılan Özellikler

Bu raporda yalnızca **fiilen silinmiş** dosyalar ve kapatılmış sunucu yüzeyleri yer alır.
Her satır `git diff --cached --name-status` ve `git status` çıktısıyla doğrulanmıştır.

Toplam silinen dosya: **222** (izlenen) · Silinen satır: **~16.900**
Yeni eklenen dosya: `src/bilesenler/bilgi/OzellikBilgiDugmesi.tsx`, `supabase/migrations/20261103090000_appstore_uyum_kapatma.sql`, 7 ses dosyası.

---

## 1. Kaldırılan oyunlar (Meyve Çarkı hariç)

| Oyun | İstemci kodu | Sunucu | Varlıklar |
| --- | --- | --- | --- |
| Zeus | `src/moduller/oyunlar/*` (zeus motoru) | `supabase/functions/zeus-spin`, `_shared/zeus/math.ts` | `assets/zeus/**` |
| Nox Reels | slot motoru | `supabase/functions/nox-reels-spin`, `_shared/nox-reels/math.ts` | `assets/nox-reels/**` |
| Kozmik Kaskad | kaskad motoru | `supabase/functions/kozmik-kaskad-spin`, `_shared/kozmik-kaskad/math.ts` | — |
| Fair Spin | çark motoru | `supabase/functions/fair-spin-spin`, `_shared/fair-spin/math.ts` | `imports/fair-spin-reference/**` |
| Astral Falls | slot motoru | `supabase/functions/astral-falls-spin`, `_shared/astral-falls/math.ts` | `imports/astral-falls-reference/**`, `assets/oyunlar/astral-falls/**` |
| Storm King | slot motoru | `supabase/functions/storm-king-spin`, `_shared/storm-king/engine.ts` | `assets/games/storm-king/**` |
| Sis Spin | bağımsız Vite prototipi | — | `sis-spin/**` (tüm uygulama) |
| Dede | slot/karakter | — | `assets/dede/**` |
| Slot (genel) | slot RPC'leri | slot fonksiyonları | — |
| Realm of Storms | ses/görsel artıkları (Storm King) | — | `assets/realm-of-storms/**` |

Silme sonrası doğrulama:

```text
rg -i "zeus|nox|kaskad|fair.?spin|astral|storm.?king|sis.?spin" src app
→ yalnızca iki yorum satırı; ikisi de bu çalışmada nötrleştirildi.
```

## 2. Oyun Stüdyosu (Creator Studio) kaldırma

Silinen dosyalar:

- `apps/super-admin/app/admin/oyunlar.tsx`
- `apps/super-admin/app/admin/oyun-algoritma/index.tsx`
- `apps/super-admin/app/admin/cikis-plani.tsx`
- `src/moduller/admin/oyunlar/AdminOyunIslemleri.ts`
- `src/moduller/oyunlar/ortak/servisler/OyunAlgoritmaAdminApi.ts`
- `src/moduller/oyunlar/ortak/servisler/OyunCikisAdminApi.ts`
- `src/moduller/admin/arama/AdminModulKatalogu.ts` içindeki Stüdyo/oyun katalog girişleri (dosya korundu, bağlantılar çıkarıldı)
- `supabase/functions/studio-r2-smoke` (boş kalmış smoke fonksiyonu)

Sunucu tarafı: `creator_studio_*` fonksiyon ve tabloları **silinmedi**; yalnızca `anon`/`authenticated` yetkileri kaldırıldı ve tablolar `ARSIV` olarak işaretlendi (veri kaybı yok).

## 3. Oyun sonucu belirleme / uzaktan etkinleştirme yüzeyleri

Bu yüzeyler uygulama kodundan çıkarıldı ve sunucuda yetkileri kapatıldı:

| Yüzey | Eski işlev | Şimdi |
| --- | --- | --- |
| `fruit_wheel_admin_force_next` | Sonraki turun kazananını zorlama | İstemci çağrısı yok; RPC yetkisi alındı |
| `fruit_wheel_admin_publish_fruits` | Tur meyvelerini elle yayınlama | Aynı |
| `fruit_wheel_admin_save_policy` | Oran/politika değiştirme | Aynı |
| `game_admin_math_activate` / `_settings_update` / `_schedule_*` | Oyun matematiğini uzaktan değiştirme | Yetki kapatıldı |
| `game_cikis_*` (çıkış planı) | Önceden belirlenmiş kayıp/çıkış planı | Yetki kapatıldı, `_shared/cikis/plan.ts` silindi |
| `admin_oyun_gorunurluk_ayarla`, `oyun_bayrak_anahtari` | Uzaktan oyun açma/kapatma | Yetki kapatıldı |

Ayrıca istemcide savunma katmanı eklendi: `useGorunurOyunKodlari` sunucudan başka bir oyun kodu gelse bile **yalnızca `fruit_wheel`** kodunu görünür kabul eder (`IZINLI_OYUNLAR`). Böylece sunucu tarafında bir hata ya da kötüye kullanım binary'de olmayan bir oyunu etkinleştiremez.

## 4. Kaldırılan ödeme altyapısı

Stripe ve ajans ödeme akışı uygulamadan çıkarıldı (Apple IAP / Google Play Billing korunur):

- `supabase/functions/stripe-checkout`, `stripe-confirm-payment`, `stripe-payment-sheet`, `stripe-webhook`
- `supabase/functions/ajans-pay`
- `supabase/config.toml` içindeki ilgili tanımlar

**Korunan:** geçmiş Stripe işlemlerine ait kayıtlar ve `stripe_price_id` alanları okunur durumda bırakıldı (`src/types/models.ts`, `CoinPaketleriniGetir.ts`, satın alma geçmişi ekranı). Geçmiş kullanıcı hareketleri silinmedi.

## 5. Kaldırılan geliştirme betikleri ve artefaktları

- `kaskad-sim-1m.json` (1.000.000 turluk RTP simülasyon çıktısı)
- `scripts/kaskad-calibrate.ts`, `kaskad-simulator.ts`, `kaskad-tests.ts`
- `scripts/nox-simulator.ts`
- `scripts/storm-king-assets.py`, `storm-king-sim.ts`, `storm-king-tests.ts`, `generate-storm-sfx.mjs`
- `scripts/process-zeus-art.py`
- `scripts/generate-win-sfx.mjs` (silinen `assets/realm-of-storms` klasörüne yazıyordu)
- `imports/astral-falls-reference/**`, `imports/fair-spin-reference/**` (referans prototipleri)
- `sis-spin/**` (bağımsız Vite oyun prototipi; uygulamaya dahil değildi ama depoda duruyordu)

## 6. Varlık (asset) temizliği

| İşlem | Sonuç |
| --- | --- |
| Meyve Çarkı'nın kullandığı 7 ses dosyası taşındı | `assets/oyunlar/fruit-wheel/audio/fw-{open,click,confirm,lock,stop,win,error}.wav` |
| `src/moduller/oyunlar/fruit-wheel/ses/FruitWheelAudio.ts` yolları güncellendi | Çalışma zamanı kırılması önlendi |
| `assets/realm-of-storms/**` (46 dosya) silindi | ~30 kullanılmayan ses + tüm sembol/karakter görselleri paketten çıktı |
| `assets/games/storm-king/**` (32 dosya) silindi | — |
| `assets/zeus/**` (14), `assets/nox-reels/**` (16), `assets/dede/**` (3) silindi | — |
| `assets/oyunlar/astral-falls/dist/index.html` silindi | Paketlenmiş oyun HTML'i binary'den çıktı |

## 7. Menu ve yönlendirme temizliği

- `metro.config.js` içindeki silinmiş oyun klasörü yoksayma kalıpları kaldırıldı.
- `package.json` içindeki silinmiş oyun test/üretim betikleri kaldırıldı (`test:oyun-cuzdan` hariç — bkz. `03_DEAD_CODE_CLEANUP.md` §4).
- `OyunKazancSayfasi()` artık hiçbir oyun için bağımsız rota döndürmüyor; yalnızca Meyve Çarkı kendi rotasını (`/oyun/fruit-wheel`) kullanıyor.
- `OyunKartKatalogu` yalnızca `fruit_wheel` kaydını içeriyor.

## 8. Kaldırılmayanlar (bilinçli karar)

- `fruit_wheel_*` tabloları, ledger, bakiyeler, geçmiş turlar.
- Eski oyunlara ait **veri tabloları** (arşiv, erişim kapalı).
- Kullanıcı hesapları, mesajlar, gönderiler, medya, takip ilişkileri, ödeme kayıtları, moderasyon kayıtları.
- Admin panelinin kullanıcı/moderasyon/finans işlevleri.
