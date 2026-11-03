# 03 — Ölü Kod ve Bağımlılık Temizliği

## 1. Kaynak kod temizliği

| Dosya | İşlem | Gerekçe |
| --- | --- | --- |
| `src/moduller/admin/oyunlar/AdminOyunIslemleri.ts` | Silindi | Yalnızca kaldırılan oyunların admin işlemleri |
| `src/moduller/oyunlar/ortak/servisler/OyunAlgoritmaAdminApi.ts` | Silindi | Uzaktan oyun matematiği = App Store 2.5.19 riski |
| `src/moduller/oyunlar/ortak/servisler/OyunCikisAdminApi.ts` | Silindi | "Çıkış planı" sonuç belirleme yüzeyi |
| `supabase/functions/_shared/cikis/plan.ts` | Silindi | Aynı |
| `supabase/functions/_shared/{zeus,nox-reels,kozmik-kaskad,fair-spin,astral-falls}/math.ts` | Silindi | Kaldırılan oyun matematiği |
| `supabase/functions/_shared/storm-king/engine.ts` | Silindi | Kaldırılan oyun motoru |
| `apps/super-admin/app/admin/{oyunlar.tsx,oyun-algoritma/index.tsx,cikis-plani.tsx}` | Silindi | Stüdyo/sonuç belirleme panelleri |
| `src/moduller/oyunlar/ortak/katalog/OyunKartKatalogu.ts` | Sadeleştirildi | Yalnızca `fruit_wheel` |
| `src/moduller/oyunlar/ortak/hooks/useGorunurOyunKodlari.ts` | Sıkılaştırıldı | Sunucu yalnızca `fruit_wheel` açabilir |
| `src/moduller/oyunlar/ortak/tipler/OyunTipleri.ts` | Korundu | Jenerik tip; katalog zaten tek oyunla sınırlı |
| `src/moduller/oyunlar/oyunlar/kazanc-balonu/OyunKazancinaGit.ts` | Yorum nötrleştirildi | Kaldırılan oyun adları koddan çıkarıldı |

### Kaldırılmayan "ölü" adaylar ve nedeni

- `OyunEkonomiMotoru`, `OyunKayitSistemi`, `OyunLogger`, `OyunOyuncuKatmani` → Meyve Çarkı'nın ekonomi/log katmanı tarafından kullanılıyor.
- `OyunLobisi`, `OyunBaslatModal`, `OyunSonucuModali` → sesli oda içi oyun akışında hâlâ kullanılıyor.
- `GameCode = 'fruit_wheel' | (string & {})` → tipi daraltmak onlarca çağrı yerinde kırılma üretir; çalışma zamanı kısıtı `IZINLI_OYUNLAR` ile sağlandı.

## 2. Bağımlılık denetimi

`package.json` bağımlılık sayısı: **66**. Her birinin kullanımı tarandı.

| Paket | Kullanım (dosya) | Karar |
| --- | --- | --- |
| `react-native-agora` | 5 | **Şüpheli** — LiveKit ile birlikte duruyor. Sesli odaların hangi RTC'yi kullandığı cihazda doğrulanmalı; kaldırma native prebuild gerektirir |
| `expo-print` | 19 | Korundu |
| `expo-blur` | 4 | Korundu |
| `expo-widgets` | 8 | Korundu (Live Activity/widget) |
| `expo-sharing` | 6 | Korundu |
| `expo-local-authentication` | 3 | Korundu (biyometrik kilit) |
| `react-native-lossless-trim` | 2 | Korundu (video kırpma) |
| `@supersami/rn-foreground-service` | 4 | Korundu (arka plan ses) |

**Kaldırılan paket yok.** Hiçbir paket "güncel olsun" diye yükseltilmedi; sürüm uyumu korundu.
Kaldırılan oyunların hiçbiri ayrı bir npm paketi kullanmıyordu (motorlar kendi kodlarıydı), bu nedenle `node_modules` tarafında ölü SDK kalmadı.

`supabase/config.toml`: silinmiş 5 fonksiyon tanımı (zeus, storm-king, kozmik-kaskad, fair-spin + stripe-* + ajans-pay) kaldırıldı.

## 3. Asset temizliği

| Klasör | Dosya | Durum |
| --- | --- | --- |
| `assets/realm-of-storms` | 46 | Silindi — 7 gerekli ses Meyve Çarkı klasörüne taşındı |
| `assets/games/storm-king` | 32 | Silindi |
| `assets/zeus` | 14 | Silindi |
| `assets/nox-reels` | 16 | Silindi |
| `assets/dede` | 3 | Silindi |
| `assets/oyunlar/astral-falls` | 1 | Silindi |

Korunan Meyve Çarkı varlıkları: 8 meyve JPG/PNG, kapak, 2 müzik/çark sesi + taşınan 7 efekt sesi.
Aktif ekranlarda kullanılan hiçbir görsel silinmedi (tüm `require(...)` yolları silme sonrası doğrulandı, `tsc` kırılmadı).

## 4. Backend / API temizliği

- 11 Edge Function silindi (oyunlar + Stripe + ajans-pay).
- Silinen fonksiyonlara istemciden yapılan çağrı kalmadı (`rg "functions.invoke"` taraması).
- `fruit_wheel_*`, `cuzdan_oyun_*` RPC'leri dokunulmadı.
- Kullanılmayan realtime aboneliği: `useGorunurOyunKodlari` içindeki `game_control_configs` dinleyicisi **korundu** — yönetim tarafında oyun kapatma hâlâ çalışır, yalnızca `fruit_wheel` dışı kodlar istemcide filtrelenir.
- Silinen oyun tablolarına yazan tetikleyici/CRON varsa yazma duracak: tablo yetkileri kaldırıldığı için `anon`/`authenticated` üzerinden yazma imkânsız; `service_role` ile çalışan bakım işleri etkilenmez.

### Açık kalan (bilinçli)

`scripts/oyun-cuzdan-sql-tests.ts` (961 satır) hâlâ kaldırılmış oyun RPC'lerini fixture olarak tanımlıyor. Bu betik yalnızca geliştirici ortamında çalışır, uygulama paketine girmez. İçindeki `fruit_wheel` cüzdan doğrulamaları değerli olduğu için silinmedi; sadeleştirme önerisi raporda bırakıldı.

## 5. Veritabanı koruması

`supabase/migrations/20261103090000_appstore_uyum_kapatma.sql`:

- **DROP yok, DELETE yok.**
- `feature_flags`: 16 oyun/Stüdyo bayrağı `enabled = false`.
- `game_control_configs`: `game_code <> 'fruit_wheel'` → `is_enabled = false`, `mode = 'MAINTENANCE'`.
- Yetki kaldırma: sonuç belirleme RPC'leri, kaldırılan oyun RPC'leri, `creator_studio_*` fonksiyon/tabloları, `zeus_/nox_/kaskad_/storm_king_/fair_spin_/astral_falls_/sis_spin_/dede_/slot_` tabloları → `revoke all ... from public, anon, authenticated`.
- `service_role` erişimi korunur; arşiv yorumları eklenir.
- Rollback: yetkiler `grant` ile geri verilebilir, veri yerinde.

## 6. Doğrulama

| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| Tip denetimi (kök) | `npx tsc --noEmit -p tsconfig.json` | 118 hata — **hepsi önceden var**, dokunulan dosyalarda 0 |
| Tip denetimi (admin) | `apps/super-admin` içinde `tsc --noEmit` | Yeni hata yok |
| Kaldırılan oyun adları | `rg -i "zeus|nox|kaskad|..." src app` | 0 gerçek referans |
| Silinen asset referansı | `rg "realm-of-storms"` | 0 |
| Çeviri dosyaları | `node -e require(json)` | `ar`, `fr`, `fil` geçerli JSON |

> Not: 118 hata Expo 57 / RN 0.86 tip tanımlarından kaynaklanan **mevcut** teknik borçtur (ör. `StyleSheet.absoluteFillObject`, `CameraType.Back`). Bu proje kapsamı "yeni hata eklememek" olarak tanımlandı; temizlik öncesi 175'ti, sonrasında 118'e düştü.
