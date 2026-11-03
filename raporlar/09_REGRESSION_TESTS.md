# 09 — Regresyon Test Sonuçları

> **Uyarı:** Bu ortamda iOS/Android çalıştırıcısı, EAS oturumu ve gerçek kullanıcı hesabı yoktur.
> Aşağıdaki işlevlerin hiçbiri cihaz üzerinde **çalıştırılarak** doğrulanmamıştır.
> "Statik" sütunu yalnızca kodun varlığını/bağlantısını doğrular; işlevsel başarı anlamına gelmez.
> Statüler: ✅ statik doğrulandı · ⚠️ kısmi · ❌ test edilmedi

---

## 1. Derleme ve tip kontrolü

| Test | Beklenen | Gerçek | Durum |
| --- | --- | --- | --- |
| Kök tip kontrolü | Yeni hata yok | 118 hata (hepsi önceden var; dokunulan dosyalarda 0) | ✅ |
| Admin tip kontrolü | Yeni hata yok | Aynı ortak havuz, yeni hata yok | ✅ |
| Metro bundle | Başarılı | Çalıştırılmadı | ❌ |
| iOS build (EAS) | Başarılı | Çalıştırılmadı (kimlik/macOS yok) | ❌ |
| Android AAB (EAS) | Başarılı | Çalıştırılmadı | ❌ |

## 2. Kimlik ve hesap

| # | Özellik | Statik kanıt | Çalıştırma | Durum |
| --- | --- | --- | --- | --- |
| 1 | Kullanıcı kaydı | `app/(auth)/register.tsx` | — | ❌ |
| 2 | Giriş | `app/(auth)/login.tsx` | — | ❌ |
| 3 | Oturum yenileme | `src/contexts/AuthContext.tsx` | — | ❌ |
| 4 | Şifre sıfırlama | `app/(auth)/forgot-password.tsx`, `reset-password.tsx` | — | ❌ |
| 5 | Hesap silme | `app/hesap-sil`, `supabase/functions/hesap-sil` | — | ❌ |
| 6 | Gizlilik ayarları | `app/ayarlar/gizlilik.tsx` | — | ❌ |
| 7 | Dil değiştirme | `app/ayarlar/dil.tsx`, 7 sözlük | JSON/TS parse | ⚠️ |

## 3. Sosyal akış

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 8 | Gönderi akışı | `app/(tabs)/durum.tsx` | ❌ |
| 9 | Gönderi oluşturma | `app/durum/olustur.tsx` | ❌ |
| 10 | Fotoğraf paylaşımı | `expo-image-picker`, `DurumKart` | ❌ |
| 11 | Video paylaşımı | `expo-video`, `compressor` | ❌ |
| 12 | Beğeni / yorum | `DurumKart` etkileşimleri | ❌ |
| 13 | Takip sistemi | `src/moduller/takip` | ❌ |
| 14 | Profil görüntüleme/düzenleme | `app/(tabs)/profile.tsx`, `app/profil-duzenle` | ❌ |
| 15 | Keşfet + ülke filtresi | `app/kesfet.tsx`, `src/moduller/ulke` | ❌ |
| 16 | Mesajlaşma | `app/(tabs)/messages.tsx`, `app/mesaj/[id].tsx` | ❌ |
| 17 | Bildirimler | `app/bildirimler`, `notification-push` | ❌ |

## 4. Sesli oda

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 18 | Oda listesi | `app/(tabs)/rooms.tsx` | ❌ |
| 19 | Odaya katılma / ayrılma | `app/room/[id].tsx`, `AktifSesOdasiOturumu` | ❌ |
| 20 | Mikrofon aç/kapat | `src/moduller/ses-odalari` | ❌ |
| 21 | Koltuk / konuşmacı durumu | `OdaSahne*`, koltuk bileşenleri | ❌ |
| 22 | Oda içi hediye | `useOdaHediyeCanlisi` | ❌ |
| 23 | Yeniden bağlanma | LiveKit reconnect yolları | ❌ |

## 5. Canlı yayın ve PK

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 24 | Yayın keşfi | `app/canli/index.tsx` | ❌ |
| 25 | Yayın izleme | `app/canli/[id].tsx` | ❌ |
| 26 | Yayına girme hatası/yükleme durumu | Hata sınırları + `BosDurum` | ❌ |
| 27 | Yayın içi hediye | hediye modülü | ❌ |
| 28 | PK akışı | `app/pk/index.tsx`, PK bileşenleri | ❌ |

## 6. Ekonomi

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 29 | Cüzdanım bakiyeleri | `app/(tabs)/wallet.tsx` | ❌ |
| 30 | Coin paketleri | `app/cuzdan/coin-yukle.tsx` | ❌ |
| 31 | Apple IAP | `expo-iap`, `iap-receipt-verify` | ❌ |
| 32 | Google Play Billing | aynı modül | ❌ |
| 33 | Hareket geçmişi | `app/cuzdan/hareketler.tsx` | ❌ |
| 34 | Hediye geçmişi | `app/cuzdan/hediye-gecmisi.tsx` | ❌ |
| 35 | Yayıncı kazançları | `app/cuzdan/yayinci-kazanclari/*` | ❌ |

## 7. Meyve Çarkı (tek oyun)

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 36 | Oyun ekranı açılışı | `app/oyun/fruit-wheel.tsx` → `FruitWheelEkrani` | ❌ |
| 37 | Tur durumu / geri sayım | `fruit_wheel_sync`, `KalanSure` | ❌ |
| 38 | Seçim ekleme/çıkarma | `FruitWheelSecim.ts` | ❌ |
| 39 | Onay + sunucu sonucu | `fruit_wheel_confirm` | ❌ |
| 40 | Oyun geçmişi | `app/oyun/fruit-wheel-gecmis.tsx` | ❌ |
| 41 | Kurallar ekranı | `app/oyun/fruit-wheel-kurallar.tsx` | ❌ |
| 42 | Ses efektleri | `FruitWheelAudio` → yeni `fw-*.wav` yolları | ⚠️ dosyalar mevcut, çalma test edilmedi |
| 43 | Oyun coin ayrımı | `cuzdan_oyun_cuzdani` | ❌ |

## 8. Moderasyon

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 44 | Şikâyet | `app/raporlarim` | ❌ |
| 45 | Engelleme | `app/engellenen-kullanicilar` | ❌ |
| 46 | Yayın/oda kapatma (admin) | admin modülü | ❌ |

## 9. Açıklama panelleri (bu çalışmanın yeni yüzeyi)

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 47 | (?) düğmesi görünürlüğü | 11 ekrana yerleştirildi | ⚠️ tip kontrolü geçti, görsel doğrulama yok |
| 48 | Panel açılma/kapanma | `OzellikBilgiDugmesi.tsx` | ❌ |
| 49 | 7 dilde metin | `bilgi` anahtarları × 7 dosya (46 anahtar) | ✅ dosya düzeyinde |
| 50 | RTL (Arapça) yerleşimi | `ar.json` dolu, yön bağımsız stiller | ❌ |

## 10. Web admin paneli

| # | Özellik | Statik kanıt | Durum |
| --- | --- | --- | --- |
| 51 | Personel girişi | `apps/super-admin/app/giris.tsx`, `AdminOturumKapisi` | ❌ |
| 52 | Kullanıcı yönetimi | `apps/super-admin/app/admin/*` | ❌ |
| 53 | Moderasyon / şikâyet | admin modülü | ❌ |
| 54 | Finansal raporlar | `app/islem-hacmi`, kazanç ekranları | ❌ |
| 55 | Oyun paneli (yalnızca Meyve Çarkı, salt okunur) | `apps/super-admin/app/admin/fruit-wheel.tsx` | ⚠️ kod düzeyinde doğrulandı |
| 56 | Kaldırılan oyun/Stüdyo ekranları yok | `tsc` + dosya yok | ✅ |

## 11. Sonuç

- **Statik olarak doğrulanan:** tip kontrolü (yeni hata yok), çeviri dosyalarının geçerliliği, kaldırılan ekranların ve assetlerin yokluğu, (?) düğmesinin bağlandığı 11 ekran.
- **Test edilmemiş:** 50 işlevsel senaryonun tamamı. Bunlar "başarılı" olarak işaretlenmemiştir.
- Sıradaki adım: `12_FINAL_RELEASE_CHECKLIST.md` §2'deki cihaz test matrisinin doldurulması.
