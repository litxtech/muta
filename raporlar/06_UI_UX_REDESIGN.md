# 06 — UI/UX Yeniden Tasarım Durumu

> Bu rapor **yapılanı** ve **yapılmayanı** ayırır. Tamamlanmamış ekranlar "yapıldı" olarak işaretlenmemiştir.

---

## 1. Tasarım sistemi (tamamlandı)

`src/tasarim-sistemi/` altında merkezi token seti; ekranlarda ham renk/ölçü yazılması yerine bu tokenlar kullanılıyor:

| Token dosyası | İçerik |
| --- | --- |
| `RenkTokenlari.ts` | Aktif temaya göre çözülen dinamik proxy: `primary`, `primarySoft`, `accent`, `magenta`, `violet`, `bg`, `bgCard`, `bgElevated`, `text`, `textMuted`, `textOnPrimary`, `border`, `borderAccent`, `pressFill`, `scrim`, `gradientPrimary`, durum renkleri |
| `BoslukVeYaricapTokenlari.ts` | `BoslukTokenlari` (xs→xxl), `YaricapTokenlari` (sm→pill), `AnimasyonTokenlari` (hizli/orta/yavas), `HeaderTokenlari` (yükseklik, dokunma hedefi, tipografi) |
| `TipografiTokenlari.ts` | `micro`, `caption`, `body`, `h2`, `h1`, `title` ölçekleri |
| `tema/TemaDurumu.ts` | Koyu/açık tema + sahne kilidi |
| `YonluIkon.tsx` | RTL'de yön değiştiren ikon sarmalayıcı |

Kurallar: kartlarda sınırlı gölge, cam efekti zorunlu değil, vurgu rengi mor/indigo + altın aksan, ince ayırıcılar.

## 2. Bu çalışmada tamamlanan tasarım işleri

### 2.1 Açıklama katmanı (yeni, tamamlandı)

`src/bilesenler/bilgi/OzellikBilgiDugmesi.tsx`

- 26 px daire, `accent` renkli `help` ikonu, `hitSlop: 10` ile ~46 px dokunma alanı.
- `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityHint` → ekran okuyucu uyumlu.
- Açılınca `Modal` (slide) + güvenli alan destekli alt panel: başlık, "Ne işe yarar", "Nasıl kullanılır", "Coin ve kurallar" bölümleri, "Anladım" düğmesi.
- 10 konu: `canli`, `sesliOda`, `pk`, `cuzdan`, `coinPaket`, `hediye`, `meyveCarki`, `profil`, `kesfet`, `gonderi`.

Metinler 7 dilde tamamlandı (`bilgi` ad alanı):

| Dil | Dosya | Anahtar |
| --- | --- | --- |
| Türkçe | `src/i18n/locales/tr.ts` | 46 |
| İngilizce | `en.ts` | 46 |
| İspanyolca | `es.ts` | 46 |
| Portekizce | `pt.ts` | 46 |
| Arapça | `ar.json` | 46 |
| Fransızca | `fr.json` | 46 |
| Filipince | `fil.json` | 46 |

Tüm metinler gerçek davranışı anlatır (ör. Meyve Çarkı için "sonuç sunucuda üretilir, oyun coinleri çekilebilir bakiye değildir"). Olmayan özellik tanıtılmadı.

### 2.2 Düğmenin yerleştirildiği ekranlar (tamamlandı)

| Ekran | Dosya | Konum |
| --- | --- | --- |
| Ortak başlık bileşeni | `src/components/EkranBasligi.tsx` | Yeni `bilgi` prop'u; başlık satırında (?) düğmesi. Ortalanmış başlıkta `pointerEvents` düzeltildi |
| Cüzdanım sekmesi | `app/(tabs)/wallet.tsx` | Başlık satırı |
| Cüzdan hero kartı | `src/moduller/cuzdan/bilesenler/CuzdanimBolumleri.tsx` | Marka satırının sağı |
| Coin yükleme | `app/cuzdan/coin-yukle.tsx` | Başlık (`bilgi="coinPaket"`) |
| Hediye geçmişi | `app/cuzdan/hediye-gecmisi.tsx` | Başlık (`bilgi="hediye"`) |
| Sesli odalar | `src/moduller/odalar/bilesenler/OdalarMarkaBasligi.tsx` | Başlık yanı |
| Canlı yayın keşfi | `src/moduller/canli-yayin/bilesenler/CanliYayinMarkaBasligi.tsx` | Başlık yanı |
| Keşfet | `src/moduller/kesfet/bilesenler/KesfetMarkaBasligi.tsx` | Başlık yanı |
| PK | `app/pk/index.tsx` | Başlık (`bilgi="pk"`) |
| Profil | `src/moduller/kullanici-profili/bilesenler/ProfilXBaslik.tsx` | İsim satırı |
| Gönderi akışı | `app/(tabs)/durum.tsx` | Başlık satırı (yeni `headerSol` sarmalayıcı) |
| Meyve Çarkı | `FruitWheelEkrani` | Ekranda zaten bilgi (kurallar) ikonu var — dokunulmadı |

Başlık satırlarında `flexShrink: 1` + `numberOfLines={1}` eklendi; uzun çeviri metinlerinde (ör. Almanca/Portekizce uzun başlıklar) taşma olmaması için.

### 2.3 Yerleşim düzeltmeleri

- `EkranBasligi`: ortalanmış modda `pointerEvents="none"` (?) düğmesini de kilitliyordu → yalnızca `bilgi` yokken kapatılacak şekilde düzeltildi.
- `durum.tsx`: başlık + (?) düğmesi tek satırda; paylaş düğmesi sağda korundu.
- `OdalarMarkaBasligi` / `CanliYayinMarkaBasligi` / `KesfetMarkaBasligi`: başlık `Text`'i sarmalayıp `gap: 8` ile hizalama yapıldı; canlı sayaç rozetleri korundu.

## 3. Yapılmayanlar (açıkça)

Aşağıdaki ekranların **kapsamlı yeniden tasarımı bu çalışmada tamamlanmadı**. Mevcut düzen korunuyor, yalnızca açıklama katmanı ve başlık hizalamaları eklendi:

| Ekran | Mevcut durum | Önerilen sonraki adım |
| --- | --- | --- |
| Ana sayfa / akış grid'i (`app/(tabs)/index.tsx`) | Çalışıyor, ülke filtresi + grid | Kart hiyerarşisi, boş durum ve banner düzeni gözden geçirilmeli |
| Gönderi kartı (`DurumKart`) | Çalışıyor | Medya oranı, başlık tipografisi, etkileşim satırı standardizasyonu |
| Canlı yayın ekranı (`app/canli/[id].tsx`) | Çalışıyor | Kontrol katmanı yerleşimi, PK göstergesi, güvenli alan |
| Sesli oda içi (`app/room/[id].tsx`) | Çalışıyor | Koltuk düzeni, konuşmacı vurgusu, mikrofon kontrolleri |
| Mesajlaşma (`app/(tabs)/messages.tsx`, `app/mesaj/[id].tsx`) | Çalışıyor | Balon stilleri, tarih ayırıcı, klavye davranışı |
| Profil | Çalışıyor | Kapak/avatar oranı, sekme çubuğu, istatistik kartları |
| Cüzdanım | Çalışıyor (hero + kartlar) | Hareket listesi görsel hiyerarşisi |

Bu ekranlar için ortak bileşen envanteri hazır olduğundan (Screen, EkranBasligi, BosDurum, GradientButton, hata sınırları, tokenlar) sonraki adımlar ekran bazlı düzen çalışmasıyla sınırlıdır; yeni altyapı gerekmez.

## 4. Erişilebilirlik ve RTL

- (?) düğmesi: 44 px üzeri dokunma alanı, ekran okuyucu etiketi, ipucu metni.
- Açıklama paneli: `onRequestClose` (Android geri tuşu), `statusBarTranslucent`, güvenli alan alt boşluğu, kaydırılabilir içerik (`maxHeight: 82%`).
- RTL: `YonluIkon` mevcut; yeni bileşenlerde `left/right` yerine `start/end` yerine `marginLeft: 'auto'` gibi yön bağımsız stiller kullanıldı. Arapça sözlük Arapça metinlerle dolduruldu.
- Yeni metinler `numberOfLines` ile sınırlandı; dinamik yazı boyutu için `adjustsFontSizeToFit` mevcut ekranlarda korundu.

## 5. Doğrulama

- `npx tsc --noEmit`: dokunulan tüm dosyalarda **0 hata**.
- Çeviri dosyaları: `ar.json`, `fr.json`, `fil.json` geçerli JSON (Node ile parse edildi), `bilgi` altında 46 anahtar.
- Görsel doğrulama (simülatör/cihaz) bu ortamda yapılamadı → `09_REGRESSION_TESTS.md` içinde "test edilmedi" olarak işaretlendi.
