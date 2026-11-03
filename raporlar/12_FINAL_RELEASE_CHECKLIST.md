# 12 — Yeni Sürüm Gönderim Öncesi Kontrol Listesi

Her madde işaretlenmeden build gönderilmemelidir. `[ ]` = yapılacak, `[x]` = bu çalışmada tamamlandı.

---

## 1. Zorunlu derleme ve binary denetimi (bu ortamda yapılamadı)

- [ ] `npx tsc --noEmit` — bilinen 118 hata dışında yeni hata yok
- [ ] `npx expo-doctor` — uyarı yok
- [ ] `eas build --platform ios --profile production`
- [ ] `eas build --platform android --profile production`
- [ ] iOS: "Setup Push Notifications?" → **Yes** (workspace kuralı)
- [ ] `.ipa` içinde `zeus|nox|kaskad|fair|astral|storm|sis|dede|slot|studio` taraması → **0**
- [ ] `.aab` içinde aynı tarama → **0**
- [ ] `.ipa` içinde `PrivacyInfo.xcprivacy` var
- [ ] `Info.plist` içinde `UIBackgroundModes`, `aps-environment`, `CFBundleLocalizations` (7 dil) doğru
- [ ] Android manifest'te `USE_FULL_SCREEN_INTENT` beyanı Play Console'da yapıldı
- [ ] Paket boyutu önceki sürümle karşılaştırıldı (beklenen: ~38 MB asset azalması)

## 2. Cihaz test matrisi (Faz 18)

Her satır en az bir fiziksel iOS ve bir Android cihazda denenmeli:

- [ ] Kayıt / giriş / oturum yenileme / şifre sıfırlama
- [ ] Profil görüntüleme, düzenleme, takip/takipten çıkma
- [ ] Gönderi oluşturma (fotoğraf + video) → akışta görünme → beğeni/yorum
- [ ] Keşfet + ülke filtresi + arama
- [ ] Mesajlaşma (metin + medya), okunmamış sayacı, klavye davranışı
- [ ] Bildirim izni + push teslimi
- [ ] Sesli oda: katılma, mikrofon, koltuk, hediye, çıkış
- [ ] Sesli oda: bağlantı kopması → yeniden bağlanma
- [ ] Canlı yayın: izleme, yorum, hediye, çıkış
- [ ] PK: skor, süre, sonuç
- [ ] Cüzdanım: bakiye, coin paketleri, Apple IAP satın alma, geri yükleme
- [ ] Google Play Billing satın alma
- [ ] Hareketler / hediye geçmişi / yayıncı kazancı
- [ ] Meyve Çarkı: tur, seçim, onay, sonuç, geçmiş, sesler, kurallar
- [ ] Meyve Çarkı: oyun coini yetmezse satın alınan coin onayı
- [ ] Şikâyet, engelleme, moderasyon
- [ ] Hesap silme, gizlilik ayarları
- [ ] Dil değiştirme (7 dil) + Arapça RTL
- [ ] (?) panelleri: 10 konu, 7 dil, taşma yok
- [ ] Web admin: personel girişi, kullanıcı/moderasyon/finans, Meyve Çarkı salt okunur panel

## 3. Veritabanı

- [x] `20261103090000_appstore_uyum_kapatma.sql` yazıldı
- [ ] Migration **staging**'de çalıştırıldı
- [ ] `select key, enabled from feature_flags where key like '%oyun%'` → yalnızca `fruit_wheel` açık
- [ ] `select game_code, is_enabled, mode from game_control_configs` → yalnızca `fruit_wheel` etkin
- [ ] `select proname from pg_proc ...` → `force_next`, `game_cikis_*`, `game_admin_math_*` yetkisiz
- [ ] `creator_studio_*` tabloları `ARSIV` yorumlu, `anon` erişimi yok
- [ ] Kullanıcı bakiyeleri / ledger satır sayısı migration öncesi ile aynı (veri kaybı yok kanıtı)
- [ ] RLS politikaları `supabase db lint` ile temiz

## 4. Uygulama içi belgeleme (tamamlandı)

- [x] 10 konu için (?) paneli bileşeni
- [x] 7 dilde metin (tr, en, es, pt, ar, fr, fil)
- [x] 11 ekrana yerleştirme (başlık, cüzdan, oda, yayın, keşfet, PK, profil, akış, coin, hediye)
- [x] Erişilebilirlik etiketleri ve 44 px dokunma alanı
- [ ] Görsel doğrulama (cihaz) — Faz 18'e bağlı

## 5. App Store Connect

- [ ] Uygulama tanıtım metni yalnızca mevcut özellikleri anlatıyor (oyun listesi = 1 oyun)
- [ ] Ekran görüntüleri yalnızca mevcut ekranları gösteriyor, kaldırılmış oyun görseli yok
- [ ] Yaş derecelendirmesi: kullanıcı etkileşimi + kullanıcı içeriği + sanal öğe satın alma işaretlendi
- [ ] "App Review Information" → 11. rapordaki yanıtlar
- [ ] Demo hesap bilgileri girildi (giriş gerektiren tüm özellikler için)
- [ ] 4.3/4.2.6 yanıtı ve `11_APPLE_REVIEW_RESPONSES.md` ekleri yüklendi
- [ ] TestFlight beta kanıtları (kanıt eksikti) tamamlandı
- [ ] Gizlilik politikası URL'leri erişilebilir: `litxtech.com/privacy`, `/terms`, `/child-safety`

## 6. Kalan teknik borç (gönderimi engellemez, kayda geçti)

- [ ] `StyleSheet.absoluteFillObject` → `absoluteFill` (18 tip hatası)
- [ ] `CameraType.Back` → `CameraType.back`
- [ ] `TamusoCallKitBridge` eksik `./tipler` modülü
- [ ] `web-tanitim/siteMetin.ts` dil birleşimi tip hatası
- [ ] `ImagePickerHazirMi.ts` kamera tipi
- [ ] `services/api.ts` oda tip dönüşümü
- [ ] `scripts/oyun-cuzdan-sql-tests.ts` sadeleştirme
- [ ] Agora kaldırma kararı (cihaz testinden sonra)
- [ ] WebView alan adı beyaz listesi
- [ ] Edge Function rate limiting

## 7. Geri alma planı

| Durum | İşlem |
| --- | --- |
| Migration sorun çıkardı | `grant` ile yetkileri geri ver; veri silinmediği için kayıp yok |
| İstemci regresyonu | `git revert` / `git checkout 51c24af` (checkpoint) |
| Oyun kaldırma geri alınacaksa | Assetler ve edge function'lar git geçmişinde; ancak App Store 2.5.19 riski geri gelir — bilinçli ürün kararı gerekir |

## 8. Gönderim onayı

Aşağıdakiler tamamlanmadan build gönderilmemeli:

1. §1 derleme ve binary taraması
2. §2 cihaz test matrisi
3. §3 staging migration doğrulaması
4. §5 App Store Connect metinleri

Bu çalışma sonunda **1–3 tamamlanmadı** (ortam sınırı), **4–6 kod düzeyinde tamamlandı**. Raporlar bu farkı gizlemez.
