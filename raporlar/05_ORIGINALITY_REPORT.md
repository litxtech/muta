# 05 — Özgünlük ve Farklılaşma Raporu

Amaç: Apple 4.3(a) (Duplicate Content), 4.3(b) (Insufficient Differentiation) ve 4.2.6 (App Generation Services) itirazlarına **koddan doğrulanabilir** yanıt zemini hazırlamak.
Bu raporda uydurma pazar iddiası yoktur; yalnızca depodaki gerçek işlevler ve tasarım kararları listelenir.

---

## 1. Ürünün gerçek kapsamı (koddan doğrulanmış)

Tamuso, tek bir "yayın izleme" uygulaması değil; dört etkileşim eksenini aynı ürün içinde birleştiren bir sosyal platformdur:

| Eksen | Somut işlev | Kanıt (modül) |
| --- | --- | --- |
| Asenkron sosyal | Gönderi akışı, fotoğraf/video/metin, beğeni, yorum, hikâye | `src/moduller/durum`, `src/moduller/hikaye` |
| Sesli sosyal | Odalar, konuşmacı/dinleyici koltukları, mikrofon yönetimi, oda müziği | `src/moduller/ses-odalari`, `src/moduller/oda-muzik` |
| Görüntülü sosyal | Canlı yayın, yayın keşfi, yorum akışı, hediye, PK karşılaşması | `src/moduller/canli-yayin`, `src/moduller/pk` |
| Ekonomi | Coin, hediye, yayıncı kazancı, IAP, hareket geçmişi, tek oyun (Meyve Çarkı) | `src/moduller/cuzdan`, `src/moduller/iap`, `src/moduller/oyunlar/fruit-wheel` |

Ek olarak bölgesel katman: ülke filtresi ve şehir modülü (`src/moduller/ulke`, `app/sehir/*`), 7 dilde arayüz.

## 2. Farklılaşma noktaları (tasarım ve akış düzeyinde)

1. **Ülke filtresi + şehir katmanı.** Keşfet, akış ve canlı yayın listeleri ülke bazlı filtrelenebiliyor; şehir modülü yerel sıralama/etkinlik yüzeyi sunuyor. Bu, küresel ölçekli rakiplerin ana akışında varsayılan olarak bulunmayan bir katman.
2. **Sesli oda ↔ canlı yayın ↔ akış geçişi.** Aynı kullanıcı profili ve cüzdanı üç yüzeyde ortak; oda içinden oyun/hediye akışına, yayından profile kesintisiz geçiş var.
3. **PK'nın "oyun" değil "yayın etkileşimi" olarak konumlanması.** PK bir şans oyunu değil; iki yayıncının hediye puanıyla yarıştığı zaman sınırlı bir etkileşim. Apple'a bu ayrım net anlatılmalı (bkz. 11. rapor).
4. **Tek oyun politikası.** Eski sürümde 9 ayrı şans oyunu vardı; yeni sürümde yalnızca **Meyve Çarkı** var. Bu, "oyun koleksiyonu" görünümünü ortadan kaldırır ve 4.2.6/2.5.19 riskini düşürür.
5. **Görsel kimlik.** `src/tasarim-sistemi` altında merkezi token seti: koyu zemin, mor/indigo vurgu, sıcak altın aksan; kart tabanlı düzen, ince ayırıcılar, sınırlı gölge. Ekranlar birebir kopya değil; bilgi mimarisi (bölüm başlıkları, çift sütun grid, alt navigasyon) Tamuso'ya özgü kurgulanmıştır.
6. **Açıklama katmanı (?) düğmeleri.** 10 temel özellik için 7 dilde uygulama içi açıklama panelleri eklendi (`src/bilesenler/bilgi`). Bu, "belgelenmemiş işlev" itirazına karşı doğrudan bir yanıttır.
7. **Çok dilli altyapı.** 7 dil tek sözlük ağacından tipli anahtarlarla üretiliyor; Arapça için RTL desteği var.

## 3. Ortak kod denetimi (4.3 için kritik)

Yapılanlar:

- Depo içinde **başka bir uygulamanın** kopyası olabilecek kod arandı: `apps/` altında yalnızca `super-admin` (aynı ürünün web yönetim paneli) var; başka bir mobil uygulama kabuğu yok.
- Silinen `sis-spin/` prototipi, `imports/fair-spin-reference`, `imports/astral-falls-reference` gibi **üçüncü taraf referans projeleri** depodan çıkarıldı. Bunlar uygulama binary'sine girmiyordu ama "başka uygulamalardan alınmış varlık" izlenimi verebilirdi.
- Ortak üçüncü taraf kütüphaneler (Expo, React Native, LiveKit, Supabase) standart açık kaynak bağımlılıklardır; bunlar 4.3 kapsamında "paylaşılan uygulama kodu" sayılmaz.

**Doğrulanamayan / kanıt gerektiren konular (uydurulmadı):**

- Geliştirici hesabındaki **diğer uygulamalarla** ortak kaynak kodu olup olmadığı bu depodan tespit edilemez (Apple hesap düzeyinde inceleme yapar). Yapılması gereken: App Store Connect'teki diğer uygulamaların binary'lerinin bu depoyla ilişkisi yoksa bunu yazılı beyan etmek.
- Beta test kayıtları (TestFlight oturumları, geri bildirim sayısı) bu depoda yok. Apple'ın 9 sorusunun 4.'sü için ** gerçek TestFlight raporu** gerekiyor; rapor uydurulmadı (bkz. 11. rapor §Eksik kanıtlar).
- Pazarlama/indirme verileri bu depoda yok.

## 4. 4.2.6 (App Generation Services) savunması

Apple, uygulamanın "başka uygulama üretme aracı" olup olmadığını sorar. Kaldırılan yüzeyler:

- Oyun oluşturma editörü ve şablonları (`apps/super-admin/app/admin/oyun-algoritma`)
- Oyun üretim/paketleme/yükleme API'leri (`creator_studio_*`, `studio-r2-smoke`)
- Uzaktan oyun yükleme bayrağı (`remote_game_load_enabled`)
- Çıkış planı / algoritma editörü (`/admin/cikis-plani`, `game_admin_math_*`)

Kalan üretken araç: **AI müzik** (`ai-music-*`). Bu bir "uygulama üretme" aracı değil, içerik üretim özelliğidir; App Store'da içerik üretimi 4.2.6 kapsamına girmez. Yine de App Review notunda "kullanıcıya uygulama üretme imkânı sunulmuyor" cümlesi açıkça yazılmalı.

## 5. Apple'ın 9 sorusuna hazırlık (özet)

| Soru | Bu depodan üretilebilen yanıt | Durum |
| --- | --- | --- |
| 1. Uygulamanın amacı | Çok yüzeyli sosyal platform (akış + sesli oda + canlı yayın + ekonomi) | Hazır |
| 2. Hedef kitle | 18+ sosyal içerik tüketicisi/üreticisi; ülke bazlı keşif | Kısmen (pazar verisi yok) |
| 3. Farklılıklar | §2'deki 7 madde | Hazır |
| 4. Beta testleri | TestFlight kayıtları | **Eksik** |
| 5. Bağımsız ürün mü | Tek marka (Tamuso), tek backend, tek tasarım sistemi | Hazır |
| 6. Diğer uygulamalarla kapsam karşılaştırması | Modül envanteri (01 raporu) | Hazır |
| 7. Hesaptaki diğer uygulamalarla ortak kod | Depoda başka uygulama yok | Kısmen (hesap düzeyi beyan gerekir) |
| 8. Üçüncü taraf ortak kod/içerik | Referans prototipleri kaldırıldı; yalnızca açık kaynak bağımlılıklar | Hazır |
| 9. Kimin için / kimin markasıyla | LitXTech / Tamuso | Hazır |

## 6. Öneriler

1. App Review notunda oyun listesini **tek oyun** olarak açıkça yazın: "Meyve Çarkı (tek oyun)".
2. PK'yı "canlı yayın etkileşimi" olarak tanımlayın, oyun olarak değil.
3. Ülke/şehir katmanını ve 7 dili ekran görüntüleriyle gösterin.
4. `sosyal_medya_gizle` gibi görünürlük anahtarlarının inceleme döneminde kullanılmadığını beyan edin.
5. TestFlight beta kanıtlarını (tarih, test kullanıcı sayısı, geri bildirim özeti) ekleyin — bu depodan üretilemez.
