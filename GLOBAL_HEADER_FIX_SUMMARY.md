# GLOBAL HEADER FIX SUMMARY — Tamuso V3

> Tarih: 2026-11-04 · Build alınmadı · Test çalıştırılmadı · Cihazda görsel doğrulama yapılmadı
> Ayrıntılı ekran envanteri: `GLOBAL_HEADER_AUDIT.md`

## Kök neden

Header'lar CSS değerleri yüzünden bozulmuyordu. **Ortak header'ın stilleri çalışma anında hiç oluşturulmuyordu.**

- Proje Babel eklentisi (`src/tasarim-sistemi/tema/babel-plugin-tamuso-tema.js`), her `StyleSheet.create({...})` çağrısını tema fabrikasına (`StyleSheet.create(() => ({...}))`) çeviriyordu.
- Bu fabrikayı anlayan tek şey, kök `app/_layout.tsx` içinde import edilen `StilYama` çalışma anı yamasıydı.
- Expo Router route ağacını kurarken grup layout'larını kök layout'tan **önce** yüklüyor. Metro anahtarları sıralıyor ve `./(tabs)/_layout.tsx` < `./_layout.tsx`.
- `(tabs)/_layout` → `ModulHataSiniri` → `HataKurtarmaEkrani` → `EkranBasligi` → `OzellikBilgiDugmesi` zinciri yama kurulmadan değerlendiriliyordu.
- Yamasız React Native 0.86 `StyleSheet.create(fn)` fonksiyonu aynen döndürüyor; `styles.satir`, `styles.title`, `styles.sag` … hepsi `undefined` kalıyordu.

Sonuç olarak 99 ekranın kullandığı ortak header React Native'in varsayılan `column` akışına düştü. Geri butonu, başlık, alt başlık ve hamburger menü alt alta dizildi; kenar boşluğu, 44 pt dokunma alanı, yazı boyutu ve tema rengi kayboldu (koyu zeminde koyu yazı). Aynı nedenle başlıklardaki (?) bilgi düğmesi ve modül hata ekranları da stilsiz çiziliyordu.

Önceki düzeltme girişimleri bu stil değerlerini değiştirdi. Değerler hiç uygulanmadığı için sonuç değişmedi.

## Düzeltilen ortak bileşenler

| Dosya | Değişiklik |
|---|---|
| `src/tasarim-sistemi/tema/babel-plugin-tamuso-tema.js` | `StyleSheet.create(x)` artık `require('<göreli>/TemaliStil').temaliStil(() => x)` olarak derleniyor. Her modül, yamanın kurulup kurulmadığından ve route yükleme sırasından bağımsız olarak temalı stil alıyor. Elle yazılmış `StyleSheet.create(fn)` çağrıları da aynı yoldan geçiyor. |
| `src/tasarim-sistemi/tema/StilYama.ts` | Davranış değişmedi; yamanın artık yalnızca yedek olduğunu ve neden ona güvenilmediğini belirten yorum güncellendi. |
| `src/tasarim-sistemi/BoslukVeYaricapTokenlari.ts` | `HeaderTokenlari.minHeight` 44 → 48, `paddingBottom` 12 → 8. Başlık + alt başlık bloğu (26 + 2 + 18) tek satıra sığıyor; header yaklaşık 60 pt oluyor ve sekme rayıyla arasındaki fazla boşluk kalkıyor. |
| `src/components/EkranBasligi.tsx` | Yapısal değişiklik gerekmedi. Mevcut `[sol] [başlık + alt başlık] [sağ]` satırı artık gerçekten uygulanıyor. |

Doğrulama: `EkranBasligi.tsx` ve `app/ajans/[id]/index.tsx` tek tek Babel ile dönüştürüldü. Çıktıda `const styles = require(".../TemaliStil").temaliStil(() => ({` üretildiği görüldü.

## Toprak Ajans (Ajans özeti) sonucu

`app/ajans/[id]/index.tsx` zaten şu çağrıyı yapıyor:

```tsx
<EkranBasligi
  title={a?.name?.trim() || t('ajans.ozetBolum')}
  subtitle={a?.name?.trim() ? t('ajans.ozetBolum') : undefined}
  border
  onBack={() => guvenliGeriDon('/(tabs)/profile')}
  right={<AjansMenuDugmesi onPress={() => setMenuAcik(true)} />}
/>
```

Stiller uygulandığında yerleşim şöyle: `[←]  Toprak Ajans / Özet  [☰]`. Geri butonu solda (44 pt), başlık 20 pt ve tek satır (`ellipsizeMode="tail"`), "Özet" 13 pt alt metin, hamburger sağda; hepsi aynı satır container'ında. Ekran dosyasında değişiklik gerekmedi. `AjansAltEkranKabuk` kullanan 20 ajans alt sayfası da aynı sonucu alıyor.

## Düzeltilen navigasyon bağlantıları

Navigasyon davranışı değiştirilmedi. Geri (`guvenliGeriDon`), hamburger (`AjansCekmeceMenu`), sekmeler, deep link'ler ve ekran parametreleri aynı. Yeni kütüphane eklenmedi, routing yeniden yazılmadı. Kök neden navigasyonda değil, stil sisteminin yükleme sırasındaydı.

## Safe area düzeltmeleri

- `src/banner/webview/TamusoWebViewScreen.tsx`: geçersiz URL ve "WebView yok" dallarında `<Screen>` üst inset'i uygularken içerik ayrıca `paddingTop: insets.top + 24` alıyordu (çift üst boşluk). Satır içi override kaldırıldı; `errorWrap` içindeki `padding: 24` kalıyor.
- Bütün `app/` ve `src/` `.tsx` dosyaları, üst kenarı kapsayan bir `Screen` / `SafeAreaView` ile birlikte `insets.top` boşluğu için tarandı. Başka çift inset bulunmadı.
- Ortak header safe area uygulamıyor; üst inset'in tek sahibi `Screen edges={['top']}`. Tam ekran kapak ekranları (`edges=[]` + `insets.top`) tek kaynaklı.

## Başlık hizalama ve taşma düzeltmeleri

- Ortak header: hizalama ve `numberOfLines` / `ellipsizeMode` kodda zaten vardı; kök düzeltmeyle uygulanıyor. Başlık `flexShrink: 1, minWidth: 0`, sağ slot `maxWidth: '46%'`, düğmeler `flexShrink: 0`. Uzun ajans / kullanıcı adları ve çeviriler düğmelerin alanını daraltmıyor. RTL'de `flexDirection: 'row'` ve `YonluIkon` otomatik aynalanıyor.
- `KesfetMarkaBasligi`, `CanliYayinMarkaBasligi`, `OdalarMarkaBasligi`: fısıltı satırı 1, slogan 2 satırla sınırlandı.
- `MesajMarkaBasligi`: fısıltı 1, başlık 1 (`tail`), alt metin 2, "aktif sohbet" satırı 1.
- `OdaOlusturMarkaBasligi`: fısıltı 1, başlık 2, özet 2; geri düğmesi `flexShrink: 0`.
- `app/mesaj/[id].tsx` sohbet üst çubuğu: geri ve arama düğmeleri `flexShrink: 0`, durum satırları `numberOfLines` ile sınırlı. Arama mantığına dokunulmadı.

## Açık / koyu tema kontrastı

Header metin ve ikon renkleri `RenkTokenlari.text` / `textMuted` token'larından geliyor. Stiller artık `temaliStil` üzerinden oluşturulduğu için aktif temaya göre çözülüyor: koyu temada açık yazı, açık temada koyu yazı. Stilsiz header'daki varsayılan siyah metin sorunu ortadan kalktı.

## Dekoratif katman düzenlemeleri

`AjansAtmosfer` incelendi; değişiklik gerekmedi:

- Katman `StyleSheet.absoluteFill` + `pointerEvents="none"`; layout akışına girmiyor, header yüksekliğini değiştirmiyor, ScrollView'u itmiyor, dokunmaları engellemiyor.
- Header'dan önce çiziliyor ve header `zIndex: 2` taşıyor. Bu stil de erken yüklenen modüldeydi; artık uygulanıyor.
- Büyük pembe / mor leke %5–14 opaklıkta bir arka plan parlaması. Ekran görüntüsündeki karmaşa, stilsiz header öğelerinin bu lekenin üzerine dağılmasından kaynaklanıyordu.

## Değiştirilen dosyalar

- `src/tasarim-sistemi/tema/babel-plugin-tamuso-tema.js`
- `src/tasarim-sistemi/tema/StilYama.ts` (yalnızca yorum)
- `src/tasarim-sistemi/BoslukVeYaricapTokenlari.ts`
- `src/banner/webview/TamusoWebViewScreen.tsx`
- `src/moduller/kesfet/bilesenler/KesfetMarkaBasligi.tsx`
- `src/moduller/canli-yayin/bilesenler/CanliYayinMarkaBasligi.tsx`
- `src/moduller/odalar/bilesenler/OdalarMarkaBasligi.tsx`
- `src/moduller/mesajlasma/bilesenler/MesajMarkaBasligi.tsx`
- `src/moduller/oda-olusturma/bilesenler/OdaOlusturMarkaBasligi.tsx`
- `app/mesaj/[id].tsx` (yalnızca üst çubuk metin / düğme kısıtları)
- `GLOBAL_HEADER_AUDIT.md`, `GLOBAL_HEADER_FIX_SUMMARY.md` (yeni)

Dokunulmayanlar: LiveKit, Agora, canlı yayın / sesli oda / görüşme sahneleri, PK, Meyve oyunu, coin / cüzdan / IAP mantığı, Supabase şeması, hesaplar, web admin.

## Ne çalıştırıldı, ne çalıştırılmadı

| İşlem | Durum |
|---|---|
| Statik import kapanışı taraması (`(tabs)/_layout` → `EkranBasligi` zinciri) | Çalıştırıldı |
| Tek dosyalık Babel dönüşüm kontrolü (`EkranBasligi.tsx`, `ajans/[id]/index.tsx`) | Çalıştırıldı, beklenen çıktı alındı |
| Route / safe-area envanter taraması | Çalıştırıldı |
| `tsc --noEmit` | Çalıştırıldı. Değiştirilen dosyalarda yeni hata yok; `app/mesaj/[id].tsx:1029` önceden vardı ve ilgisiz |
| Build (EAS / yerel) | **Çalıştırılmadı** |
| Birim / e2e test | **Çalıştırılmadı** |
| Cihaz / simülatör görsel kontrol | **Yapılmadı** |

Düzeltme kullanıcılara yeni bir iOS / Android build'iyle ulaşır (projede `expo-updates` yok). Yerel geliştirmede eski görünüm sürerse `npx expo start -c` kullanın.
