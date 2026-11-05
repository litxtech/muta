# GLOBAL HEADER AUDIT — Tamuso V3

> Tarih: 2026-11-04 · Yöntem: statik kod incelemesi (build alınmadı, test çalıştırılmadı, cihazda görsel doğrulama yapılmadı)
> Kapsam: `app/` altındaki 137 route dosyası (layout'lar hariç) + ortak header / sarmalayıcı bileşenleri
> Bu rapor eski `HEADER_AUDIT.md` dosyasının yerini alır. Eski rapordaki `admin/*` rotaları artık `app/` altında yok.

---

## 1. Gerçekte kullanılan navigasyon altyapısı

| Katman | Durum |
|---|---|
| Router | Expo Router 57 (`main: expo-router/entry`), React Native 0.86.3 |
| Kök Stack (`app/_layout.tsx`) | `headerShown: false` — native header yok |
| `(tabs)/_layout.tsx` | `Tabs`, `headerShown: false`, `tabBar={() => null}`; tab bar kökte `YuzenTabBar` |
| `(auth)/_layout.tsx`, `tanitim/_layout.tsx` | `Stack`, `headerShown: false` |
| Drawer Navigator | Yok. Ajans hamburger menüsü Modal tabanlı `AjansCekmeceMenu` |
| Safe area | `SafeAreaProvider` Expo Router kökünde; ekranlarda tek kaynak `Screen` (`SafeAreaView` + `edges`) |
| Ortak header | `src/components/EkranBasligi.tsx` (`EkranBasligi` → `TamusoScreenHeader`) |
| Tema | `babel-plugin-tamuso-tema.js` + `TemaliStil.ts` (`StyleSheet` stilleri temaya göre çözülür) |

## 2. Görevde sorulan 15 sorunun yanıtları

| # | Soru | Bulgu |
|---|---|---|
| 1 | Navigation header ile custom header aynı anda mı? | Hayır. Bütün navigator'larda `headerShown: false`. |
| 2 | Aynı ekranda iki header mı? | Hayır. Bazı ekranlarda yükleme / hata / normal dallarında ayrı `EkranBasligi` var, ama aynı anda tek header çiziliyor. |
| 3 | Geri butonu ile başlık farklı kaynaktan mı? | Hayır. İkisi de `TamusoScreenHeader` içinde, aynı satır container'ında. |
| 4 | Hamburger bağımsız container'da mı? | Kodda hayır (`right` slotunda). **Ekranda evet**, çünkü slot stilleri hiç uygulanmıyordu (bkz. §3). |
| 5 | Parent yanlış `flexDirection` mı? | Kodda `row`. Çalışma anında stil `undefined` olduğu için varsayılan `column` uygulanıyordu. **Görülen hatanın doğrudan nedeni.** |
| 6 | `flexWrap` alt satıra mı düşürüyor? | Hayır, header'da `flexWrap` yok. |
| 7 | `justifyContent` / `alignItems` yanlış mı? | Kodda doğru; çalışma anında uygulanmıyordu (bkz. §3). |
| 8 | Başlık ScrollView içinde mi? | Hayır. `durum/olustur` ve `durum/duzenle` için çıkan işaret yanlış pozitif (`useRef<ScrollView>`). |
| 9 | Safe area iki kez mi? | Ortak header'da hayır. Bir yerde evet: `TamusoWebViewScreen` hata dalı (düzeltildi). |
| 10 | Sabit `marginTop` / `paddingTop` / absolute çakışması? | Header'da yok. İçerikteki negatif margin'ler avatar bindirme amaçlı, header'ı telafi etmiyor. |
| 11 | Global tema header metnini bozuyor mu? | **Evet, dolaylı olarak.** Tema stil sistemi yükleme sırasına bağlıydı; header stilsiz kalınca metin rengi temaya bağlanmıyordu (koyu zeminde koyu yazı). |
| 12 | z-index / pointerEvents hatası? | Kodda yok (header `zIndex: 2`, dekor `pointerEvents="none"`). Ancak `zIndex` de uygulanmayan stiller arasındaydı. |
| 13 | Dekoratif arka plan layout'u etkiliyor mu? | `AjansAtmosfer` mutlak konumlu ve akış dışı; layout'u etkilemiyor. Görsel karışıklık stilsiz header'dan geliyordu. |
| 14 | Ortak header stili eziliyor mu? | Ezilmiyordu; **hiç oluşturulamıyordu** (bkz. §3). |
| 15 | Header alanı ile içerik başlangıcı uyumsuz mu? | Stilsiz header'da evet (minHeight / padding yok, öğeler alt alta). Kök düzeltmeyle giderildi. |

## 3. Belirlenen mimari sorun (kök neden)

1. `babel-plugin-tamuso-tema.js`, derleme anında her `StyleSheet.create({...})` çağrısını `StyleSheet.create(() => ({...}))` biçimine çeviriyordu.
2. Fonksiyon argümanını tanıyan tek şey, çalışma anındaki `stilYamasiniUygula()` yamasıydı. Bu yama `app/_layout.tsx` içindeki `import '../src/tasarim-sistemi/tema/StilYama'` ile kuruluyordu.
3. Expo Router route ağacını kurarken her `_layout` dosyasını hemen yükler (`node_modules/expo-router/build/getRoutesCore.js:358` → `getLayoutNode` → `:652 node.loadRoute()`). Metro `require.context` anahtarlarını sıralar (`metro/src/lib/contextModuleTemplates.js:40`). `(` karakteri `_` karakterinden önce geldiği için `./(tabs)/_layout.tsx`, `./_layout.tsx`'ten **önce** yüklenir.
4. `(tabs)/_layout.tsx` şu zinciri yükler: `ModulHataSiniri` → `HataKurtarmaEkrani` → **`EkranBasligi`** → **`OzellikBilgiDugmesi`**. Bu dört modül yama kurulmadan değerlendirilir.
5. Yamasız React Native 0.86 `StyleSheet.create(obj)` argümanı aynen döndürür (`StyleSheetExports.js:182-193`). Böylece `styles` bir fonksiyon olur ve `styles.satir`, `styles.hit`, `styles.title`, `styles.sag` … hepsi `undefined` kalır. Modül önbelleği nedeniyle bu durum uygulama kapanana kadar sürer.
6. Sonuç: ortak header'ın satır düzeni, kenar boşluğu, 44 pt dokunma alanı, yazı boyutu ve tema rengi hiçbir ekranda uygulanmıyordu. React Native varsayılanı olan `column` akışında geri butonu, başlık, alt başlık ve sağ aksiyon alt alta diziliyordu. Toprak Ajans ekranındaki görüntünün birebir karşılığı budur.

Önceki düzeltme girişimleri `EkranBasligi` stil değerlerini değiştirdi. O stiller çalışma anında hiç oluşturulmadığı için hiçbir etkileri olmadı.

## 4. Ortak header ve sarmalayıcı bileşenler

| Bileşen | Kullanan rotalar | Durum |
|---|---|---|
| `src/components/EkranBasligi.tsx` (`EkranBasligi`, `TamusoScreenHeader`) | 99 rota (doğrudan veya sarmalayıcı ile) | Kök neden düzeltmesiyle stiller uygulanıyor |
| `src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk.tsx` | `ajans/[id]/*` alt sayfaları (20) | Aynı ortak header'ı kullanıyor; ek değişiklik gerekmedi |
| `TakipListeEkrani`, `TakipIstekleriEkrani`, `OrtakTakipcilerEkrani` | `takip/*` | Ortak header |
| `KisilerKesifEkrani` | `kisiler/index` | Ortak header |
| `TamusoVerifyAkisi` | `kyc/index`, `cuzdan/yayinci-kazanclari/kimlik-dogrula` | Ortak header |
| `src/ekranlar/ai-muzik/*` | `ai-muzik/*` | Ortak header |
| `src/bilesenler/bilgi/OzellikBilgiDugmesi.tsx` | Başlıklardaki (?) düğmesi ve bilgi kartı | Erken yüklenen dört modülden biri; kök düzeltmeyle stiller uygulanıyor |
| `src/ortak/hata-sinirlari/ModulHataSiniri.tsx`, `HataKurtarmaEkrani.tsx` | Bütün modül hata sınırları | Erken yüklenen dört modülden ikisi; hata ekranları da stilsizdi, kök düzeltmeyle giderildi |
| `KesfetMarkaBasligi`, `CanliYayinMarkaBasligi`, `OdalarMarkaBasligi`, `MesajMarkaBasligi`, `OdaOlusturMarkaBasligi` | Keşfet, canlı yayın keşfi, odalar, mesajlar, oluştur | Yerleşim doğru; metinlere satır sınırı eklendi |
| `ProfilXBaslik` | `(tabs)/profile`, `kullanici/[id]` | Kapak üstü overlay; `edges=[]` + `insets.top` tek kaynak; değişiklik gerekmedi |
| `(tabs)/wallet.tsx` `baslikBar` | Cüzdanım | Yerleşim doğru; (?) düğmesi kök düzeltmeyle |
| `app/mesaj/[id].tsx` `topBar` | Sohbet detayı | Düğmelere `flexShrink: 0`, durum satırına satır sınırı |
| `TamusoWebViewHeader` / `TamusoWebViewScreen` | `webview` | Hata dalındaki çift üst inset kaldırıldı |

## 5. Route matrisi

Sınıf dağılımı (toplam 137): ortak header 99 · marka başlığı 7 · diğer özel header 3 (cüzdan, sohbet, webview) · immersive (koruma sınırı) 10 · web tanıtım / blog 9 · yönlendirme 3 · header'sız / tam ekran 6.

| Rota (`app/…`) | Header bileşeni | Screen edges | Belirlenen sorun | Düzeltme |
|---|---|---|---|---|
| `(auth)/dogrula-kod.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `(auth)/forgot-password.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `(auth)/login.tsx` | — | — | Tam ekran giriş sahnesi; kendi `insets.top` (tek kaynak) | Dokunulmadı |
| `(auth)/register.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `(auth)/reset-password.tsx` | — | varsayilan(top,bottom) | Header’sız form | Gerekmez |
| `(tabs)/cihazlar.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `(tabs)/create.tsx` | OdaOlusturMarkaBasligi | [top] | Yerleşim doğru (row); başlık/alt metinde satır sınırı yoktu | Düzeltildi; OdaOlusturMarkaBasligi.tsx — başlık/alt metin satır sınırı |
| `(tabs)/durum.tsx` | — | [top] | Header’sız sekme (bölüm başlıkları içerikte) | Gerekmez |
| `(tabs)/index.tsx` | Ana sayfa marka alanı | [] | `edges=[]` + kendi inset (tek kaynak); çakışma yok | Gerekmez |
| `(tabs)/messages.tsx` | MesajMarkaBasligi | [top] | Yerleşim doğru (row); başlık/alt metinde satır sınırı yoktu | Düzeltildi; MesajMarkaBasligi.tsx — başlık/alt metin satır sınırı |
| `(tabs)/profile.tsx` | ProfilXBaslik | [] | Yerleşim doğru (row); içindeki (?) düğmesi stilsizdi | (?) düğmesi kök düzeltmeyle |
| `(tabs)/rooms.tsx` | OdalarMarkaBasligi | [top] | Yerleşim doğru (row); içindeki (?) düğmesi stilsizdi | (?) düğmesi kök düzeltmeyle; OdalarMarkaBasligi.tsx — fısıltı/slogan satır sınırı |
| `(tabs)/wallet.tsx` | Özel `baslikBar` (+ OzellikBilgiDugmesi) | [top] | Yerleşim doğru (row); başlıktaki (?) düğmesi stilsizdi | Kök düzeltmeyle otomatik |
| `ai-muzik/[id].tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ai-muzik/index.tsx` | EkranBasligi | varsayilan(top,bottom) [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ai-muzik/islemler.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ai-muzik/kutuphane.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ai-muzik/pasaport/[id].tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/analitik.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/ayarlar.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/basvurular.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/canli.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/cuzdan.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/davetler.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/destek.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/dogrulama.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/duyurular.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/ekipler.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/etkinlikler.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/gorevler.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/gorusmeler/index.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/gorusmeler/olustur.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/guvenlik.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/islemler.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/program.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/sertifika.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/uyeler/[userId].tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/[id]/uyeler/index.tsx` | AjansAltEkranKabuk>EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/gorusme/[id]/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/gorusme/[id]/oda.tsx` | — | [top,bottom] | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `ajans/gorusmelerim.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/katil.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/profil/[id]/index.tsx` | Kapak üstü overlay | [] | Kapak tam ekran; `edges=[]` + `insets.top` (tek kaynak) | Gerekmez |
| `ajans/profil/[id]/uyeler.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/uye/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ajans/yonetim/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `announcements/[id].tsx` | — | — | Yönlendirme / arayüzsüz rota | Gerekmez |
| `asistan/index.tsx` | EkranBasligi | [top,bottom] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `auth/callback.tsx` | — | — | Yönlendirme / arayüzsüz rota | Gerekmez |
| `ayarlar/dil.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/gizlilik.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/gorunum.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/hakkinda.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/iletisim-teknolojileri.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/kisiler-aramalar.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/satin-alma-gecmisi.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/unvanlarim.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ayarlar/veri-cevrimdisi.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `bildir/index.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `bildirim-ayarlari/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `bildirimler/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `blog/[...yol].tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `blog/index.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `canli/[id].tsx` | — | [] [top] | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `canli/index.tsx` | CanliYayinMarkaBasligi | [] [top] | Yerleşim doğru (row); içindeki (?) düğmesi stilsizdi | (?) düğmesi kök düzeltmeyle; CanliYayinMarkaBasligi.tsx — fısıltı/slogan satır sınırı |
| `cuzdan/coin-yukle.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/hareketler.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/hediye-gecmisi.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/yayinci-kazanclari/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/yayinci-kazanclari/itiraz.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/yayinci-kazanclari/kimlik-dogrula.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/yayinci-kazanclari/odeme-hesabi.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `cuzdan/yayinci-kazanclari/odeme-profili.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `destek/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `durum/[id].tsx` | — | [] | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `durum/duzenle.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `durum/olustur.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `duyuru/[id].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `duyuru/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `engellenen-kullanicilar/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `fikirler/[id].tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `fikirler/benim.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `fikirler/index.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `fikirler/olustur.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `gorusme/[id].tsx` | — | — | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `guvenlik/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `hesap-sil/index.tsx` | EkranBasligi | [top] [top,bottom] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `hikaye/[userId].tsx` | — | varsayilan(top,bottom) [] | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `hikaye/arsiv.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `hikaye/olustur.tsx` | HikayeBesteciEkrani (tam ekran) | — | Tam ekran besteci | Dokunulmadı |
| `host/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `index.tsx` | — | — | Yönlendirme / arayüzsüz rota | Gerekmez |
| `islem-hacmi/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `kesfet.tsx` | KesfetMarkaBasligi | [top] | Yerleşim doğru (row); içindeki (?) düğmesi stilsizdi | (?) düğmesi kök düzeltmeyle; KesfetMarkaBasligi.tsx — fısıltı/slogan satır sınırı |
| `kisiler/index.tsx` | EkranBasligi + TamusoScreenHeader | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `kullanici/[id].tsx` | ProfilXBaslik | [] | Yerleşim doğru (row); içindeki (?) düğmesi stilsizdi | (?) düğmesi kök düzeltmeyle |
| `kyc/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `lobi/[id].tsx` | — | — | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `mesaj/[id].tsx` | Özel sohbet `topBar` | [top,bottom] [top] | Yerleşim doğru; uzun adlarda düğmeler sıkışabiliyordu, durum satırı sınırsızdı | Düzeltildi; app/mesaj/[id].tsx — geri/arama düğmeleri flexShrink:0, durum satırı numberOfLines |
| `oyun/fruit-wheel-gecmis.tsx` | — | — | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `oyun/fruit-wheel-kurallar.tsx` | — | — | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `oyun/fruit-wheel.tsx` | — | — | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `paylas/[kod].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `paylasim/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `pk/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `platform/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `politika/[kod].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `politika/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `profil-ayarlar/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `profil-duzenle/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `raporlarim/[id].tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `raporlarim/index.tsx` | EkranBasligi | varsayilan(top,bottom) | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `room/[id].tsx` | — | [top] varsayilan(top,bottom) [] | Canlı / oda / oyun sahnesi — koruma sınırı | Dokunulmadı |
| `sehir/[id].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `sehir/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `sehir/lig.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `sehir/savas.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `sehir/secim/[id].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `sehir/secim/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `siralamalar/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `takip/istekler.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `takip/ortak.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `takip/takip-edilenler.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `takip/takipciler.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `tanitim/coinler.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/hakkinda.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/index.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/isbirligi.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/meyve.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/ozellikler.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `tanitim/yatirim.tsx` | — | — | Web tanıtım / blog — kendi inset yönetimi, uygulama header’ı yok | Dokunulmadı |
| `ulke/[code].tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `ulke/index.tsx` | EkranBasligi | [top] | Ortak header stilsiz çiziliyordu: tüm öğeler alt alta, kenar boşluğu yok, metin rengi temasız | Kök neden düzeltmesiyle otomatik (Babel → temaliStil); ek ekran yaması yok |
| `webview.tsx` | TamusoWebViewHeader | — | Hata dalında `<Screen>` + `paddingTop: insets.top + 24` → çift üst boşluk | Düzeltildi; src/banner/webview/TamusoWebViewScreen.tsx — hata dalında çift üst inset kaldırıldı |

## 6. Kalan riskler

- **Cihazda doğrulanmadı.** Görev gereği build alınmadı, test çalıştırılmadı. iPhone Dynamic Island, Android status bar, RTL (Arapça) ve uzun çevirilerdeki görünüm cihazda kontrol edilmeli. Önerilen ilk kontrol: Profil → Ajansım → Toprak Ajans (Özet), açık ve koyu temada.
- **Dağıtım.** Projede `expo-updates` yok. Düzeltme kullanıcılara yalnızca yeni bir iOS / Android build'iyle ulaşır; mevcut kurulu build'ler eski bundle'ı göstermeye devam eder.
- **Metro önbelleği.** Expo'nun Babel önbellek anahtarı `babel.config.js` ve onun referans verdiği eklenti dosyasını hash'liyor; değişiklik önbelleği kendiliğinden geçersiz kılmalı. Yerel geliştirmede eski görünüm sürerse `npx expo start -c` ile başlatın. EAS build'leri temiz ortamda derlenir.
- **Davranış eşdeğerliği.** Daha önce yamadan geçen bütün modüller zaten `temaliStil` Proxy'si alıyordu. Değişiklikten sonra o modüller aynı nesneyi doğrudan alıyor; yalnızca erken yüklenen dört modülün davranışı değişti (stilsizden stilliye).
- **Marka başlıklarındaki geri düğmeleri** görsel olarak 36–40 pt. `hitSlop={8}` ile dokunma alanı ≥ 52 pt; görsel tasarımı korumak için boyut değiştirilmedi.
- **Dekoratif katman** (`premiumAtmosferLekeleri`) değiştirilmedi. Lekeler mutlak konumlu, `pointerEvents="none"` ve %5–14 opaklıkta; header'ın arkasında kalıyor (`zIndex: 2` artık uygulanıyor). Header düzgün çizildikten sonra hâlâ rahatsız edici bulunursa yalnızca `AjansAtmosfer` için konum veya opaklık ayarlanabilir.
- **TypeScript.** `tsc --noEmit` çıktısındaki mevcut hatalar bu değişikliklerle ilgili değil. Değiştirilen dosyalarda tek kayıt `app/mesaj/[id].tsx:1029` (`mime: string | null`); bu hata önceden vardı ve düzenlenen satırların dışında.
- **Eşzamanlı çalışma.** Envanter çıkarılırken çalışma ağacında başka bir oturum kullanılmayan dosyaları siliyordu. Tablo tarama anındaki ağacı yansıtır.
