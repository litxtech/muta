# 11 — Apple Review Yanıtları İçin Doğrulanmış Bilgiler

Bu dosya, App Store Connect → App Review Information alanına yazılacak cevapların **kaynak koddan doğrulanmış** dayanaklarını içerir.
Doğrulanamayan her başlık "kanıt eksik" olarak işaretlenmiştir. Uydurma veri yoktur.

---

## Soru 1 — Uygulamanın gerçek amacı nedir?

**Yanıt taslağı:**
Tamuso, kullanıcıların birbirini keşfettiği, sesli odalarda ve canlı yayınlarda gerçek zamanlı etkileşime girdiği ve asenkron gönderi akışında içerik paylaştığı bir sosyal platformdur. Ekonomi katmanı (coin, sanal hediye, yayıncı kazancı) bu etkileşimleri destekler.

**Kanıt:** `src/moduller/durum` (akış), `src/moduller/ses-odalari` (sesli oda), `src/moduller/canli-yayin` (canlı yayın), `src/moduller/pk` (yayın içi yarışma), `src/moduller/cuzdan` (ekonomi).

## Soru 2 — Hedef kullanıcı kitlesi kim?

**Yanıt taslağı:** 18 yaş ve üzeri, sosyal içerik üreten ve tüketen, ülke bazlı keşif isteyen kullanıcılar. Arayüz 7 dilde sunulur (tr, en, es, pt, ar, fr, fil).

**Kanıt:** `app.config.ts` `CFBundleLocalizations` (bu çalışmada fr/fil eklendi), `src/i18n/locales/*` (7 sözlük), `src/moduller/ulke` + `app/ulke/*` (ülke filtresi), yaş doğrulama akışı `src/moduller/kyc`, `app/kyc`.

**Kanıt eksik:** hedef kitle büyüklüğü, pazar araştırması, indirme sayısı — bu depoda yok, yazılmamalı.

## Soru 3 — Mevcut pazardaki somut farklılıkları neler?

**Yanıt taslağı (7 madde, 05 raporundan):**

1. Ülke filtresi + şehir katmanı (`app/ulke`, `app/sehir`) keşif, akış ve yayın listelerinde ortak çalışır.
2. Sesli oda ↔ canlı yayın ↔ gönderi akışı arasında aynı profil ve cüzdanla kesintisiz geçiş.
3. PK bir şans oyunu değil, iki yayıncının hediye puanıyla yarıştığı zaman sınırlı yayın etkileşimidir.
4. Tek oyun politikası: yalnızca Meyve Çarkı (`app/oyun/fruit-wheel.tsx`).
5. Merkezi tasarım sistemi (`src/tasarim-sistemi`) ile özgün görsel dil; kopya ekran yok.
6. 10 temel özellik için 7 dilde uygulama içi (?) açıklama panelleri (`src/bilesenler/bilgi`).
7. 7 dilli altyapı + RTL (Arapça) desteği.

## Soru 4 — Gerçek beta test kayıtları ve geri bildirimler

**Durum: KANIT EKSİK.** Bu depoda TestFlight/Play Internal Testing kaydı, test kullanıcı sayısı veya geri bildirim özeti bulunmuyor.
**Yapılacak:** App Store Connect → TestFlight → Build geçmişi ve "Feedback" ekranından tarih aralığı, tester sayısı ve öne çıkan geri bildirimler çıkarılıp bu bölüme eklenmeli. Uydurma sayı yazılmamalı.

## Soru 5 — Bağımsız bir ürün mü?

**Yanıt taslağı:** Evet. Tek marka (Tamuso), tek Supabase projesi, tek tasarım sistemi, tek web yönetim paneli (`apps/super-admin`, mobil binary'ye dahil değil).
**Kanıt:** `src/yapilandirma/UygulamaKimligi.ts` (marka, destek e-postası, yasal URL'ler), `package.json` (tek uygulama), `apps/` altında yalnızca aynı ürünün admin paneli.

## Soru 6 — Diğer uygulamalarla ürün kapsamı karşılaştırması

**Yanıt taslağı:** Kapsam, genel amaçlı kısa video uygulamalarından farklı olarak sesli oda + canlı yayın + PK + ekonomi + tek oyunu aynı üründe birleştirir. Modül envanteri `01_PROJECT_AUDIT.md` §4'te listelenmiştir.
**Kanıt:** `01_PROJECT_AUDIT.md`.

## Soru 7 — Geliştirici hesabındaki diğer uygulamalarla ortak kod var mı?

**Yanıt taslağı (kaynak düzeyinde):** Bu depoda başka bir mobil uygulamanın kaynak kodu bulunmuyor. `apps/` altındaki tek ek uygulama, aynı ürünün web yönetim panelidir.
**Kanıt:** `apps/` dizin içeriği, `app.config.ts` tek bundle id (`com.litxtech.muta`), tek `package.json`.
**Kanıt eksik:** Hesap düzeyindeki diğer uygulamalarla ilişki bu depodan doğrulanamaz. Beyan, hesap sahibi tarafından yapılmalıdır.

## Soru 8 — Üçüncü taraf uygulamalarla ortak kod veya içerik var mı?

**Yanıt taslağı:** Üçüncü taraf oyun prototipleri (`imports/fair-spin-reference`, `imports/astral-falls-reference`) ve bağımsız `sis-spin/` projesi bu çalışmada depodan **tamamen çıkarıldı**. Kalan üçüncü taraf kod yalnızca açık kaynak kütüphanelerdir (Expo, React Native, LiveKit, Supabase).
**Kanıt:** `git status` silinen dosya listesi; `package.json` bağımlılıkları (66 paket, hepsi açık kaynak).

## Soru 9 — Uygulama kimin için ve kimin markasıyla geliştirildi?

**Yanıt taslağı:** LitXTech (destek: support@litxtech.com) tarafından Tamuso markasıyla geliştirilmiştir. Yasal metinler litxtech.com altında yayınlanır.
**Kanıt:** `src/yapilandirma/UygulamaKimligi.ts`.

---

## Ek: 2.5.19 / 4.3 / 4.2.6 için hazır cevap maddeleri

| İddia | Dayanak |
| --- | --- |
| "Uygulamada App Store tanıtımında yer almayan oyun yok." | 6 oyun motoru, 9 oyun bayrağı ve tüm ilgili assetler kaldırıldı (02 raporu) |
| "Tek oyun var: Meyve Çarkı." | `src/moduller/oyunlar/fruit-wheel`, `app/oyun/fruit-wheel.tsx` |
| "Uygulama üretme aracı yok." | `creator_studio_*` yetkileri kapatıldı, Stüdyo ekranları silindi |
| "Oyun sonucu sunucuda belirleniyor, istemciden yönlendirilemiyor." | `fruit_wheel_confirm` yalnızca tur + seçim alır; `force_next`/`game_cikis_*` yetkileri kaldırıldı |
| "İnceleme sırasında farklı davranış yok." | `isReview`/`reviewMode` deseni yok; `expo-updates` yok (04 raporu) |
| "Kaldırılan özellikler sunucudan yeniden açılamaz." | `admin_oyun_gorunurluk_ayarla` yetkisi kaldırıldı + istemci `IZINLI_OYUNLAR` filtresi |
| "Tüm temel özellikler uygulama içinde açıklanıyor." | 10 konu × 7 dil (?) paneli |
| "7 dil destekleniyor." | `src/i18n/locales/*` + `CFBundleLocalizations` |

## Ek: Review notuna önerilen kısa metin

> Tamuso is a social platform combining a photo/video feed, live audio rooms, live streams with in-stream PK battles, and a coin/gift economy. The app contains exactly one game: Fruit Wheel, a server-authoritative live round wheel. No game creation, app generation, dynamic code loading or remote feature activation exists in this build. All 10 core features include an in-app help panel available in 7 languages. A demo account is provided in the Review Notes section.
