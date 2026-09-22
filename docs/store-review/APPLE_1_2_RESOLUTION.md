# Apple Guideline 1.2 — Red + ne yapılacak

## Neden yine reddedildi?

Apple’ın metni **şablon**dur: her UGC uygulamasında “anonymous” yazar.
Gerçekte incelemeci şunlardan birini (veya birkaçını) görmüştür:

1. **Misafir girişi** (`Misafir olarak devam et` → `guest_…` kullanıcı adı)  
   Bu Apple’a “anonim içerik” gibi görünür — **en sık kök neden**.
2. **App Store Connect yaş rating** 17+/18+ ve UGC kutuları işaretli değil.
3. Report / block / contact / delete **5 dakikada bulunamadı** (demo hesap + Review Notes zayıf).
4. Eski binary (1.2.3) hâlâ misafir açıkken yüklendi.

Kodda özelliklerin çoğu vardı; **production’da misafir açık** olduğu için şablon tetiklendi.

## Bu turda kodda yapılanlar

- Production’da **Misafir olarak devam et** butonu kaldırıldı.
- `MisafirOlarakDevamEt` production’da sert engel.
- Kayıtta **doğum tarihi zorunlu** (18+).
- Giriş ekranında `support@litxtech.com` görünür.

**Yeni iOS build zorunlu** — eski 1.2.3 binary’si hâlâ misafir gösterir.

## App Store Connect (metadata) — build’den önce kontrol et

1. **Age Rating** → 17+ (Frequent/Intense: User-Generated Content, Messaging, Unrestricted Web).
2. **App Privacy** UGC / iletişim bilgisi doğru.
3. **App Review Information**  
   - Demo hesap (e-posta + şifre) doldur.  
   - Notes’a aşağıdaki metni yapıştır.

## Resolution Center — Apple’a cevap (English, paste)

```
Hello App Review,

Thank you for the feedback on Guideline 1.2.

Clarification: Tamuso does NOT support anonymous posting. Every post, comment,
message, voice-room chat, and live interaction is tied to a registered account
with a unique username and profile. There is no anonymous posting mode.

What changed in this submission:
• Guest / “continue as guest” is removed from the production iOS build (it was
  incorrectly treated as anonymous identity). All users must sign up or sign in.
• Registration requires 18+ declaration, Terms / Community Rules acceptance,
  and date of birth (18+ gate).
• Objectionable-content filtering runs server-side on create.
• Users can Report and Block from content menus and profile cards.
• Users can delete their own posts immediately from the Durum (Status) menu.
• Reports enter our moderation queue with a 24-hour SLA; we remove content and
  can warn / suspend / ban the offending user.
• In-app contact: support@litxtech.com (login screen + Settings / Safety).

How to verify with the demo account:
1) Sign in with the provided credentials (do not use guest).
2) Settings → Tercihler → Yardım → Topluluk kuralları / Politikalar / Bize ulaşın.
3) Durum tab → open any post → ••• → Bildir (report) or Sil (own post).
4) Open a user profile → Bildir / Engelle (report / block).
5) Engellenen hesaplar: Settings → Engellenen hesaplar.

Age Rating in App Store Connect is set to 17+ with User-Generated Content
declared. Please re-review this build.

Best regards,
Litxtech / Tamuso
```

## Review Notes (App Review Information → Notes)

Önceki 1.2 notunu kullan; **ilk satıra ekle:**

```
IMPORTANT: Guest / anonymous login is DISABLED in this production build.
Please sign in with the demo account credentials below. All UGC requires a
registered username — there is no anonymous posting.
```

## Check-list (göndermeden önce)

- [ ] Yeni production iOS build (misafirsiz)
- [ ] ASC Age Rating 17+ + UGC işaretli
- [ ] Demo hesap çalışıyor (kayıtlı, misafir değil)
- [ ] Review Notes + Resolution Center cevabı yapıştırıldı
- [ ] Cihazda: Bildir / Engelle / Sil / support@ e-posta 2 dakikada bulunuyor
