# App Store / Play — PiP & arka plan ses (inceleme notları)

Bu metinleri **App Store Connect → App Review Information → Notes** ve
**Google Play Console → App content / Permissions** alanlarına yapıştır.
Özellik Çin dahil tüm bölgelerde açıktır; backend’de kapatma / ülke kilidi yoktur.

---

## App Store Connect — Review Notes (English, paste as-is)

```
BACKGROUND AUDIO (UIBackgroundModes: audio) — Guideline 2.5.4

Why we need it:
1) Voice rooms (LiveKit): When a user is in a voice room and leaves the room
   screen (e.g. opens another profile) or briefly backgrounds the app, audio
   continues so they remain in the room. A mini “return to room” bar appears
   in-app; they can leave the room with the X button.
2) Voice room Picture-in-Picture (Android): When the user is on the voice room
   screen and presses Home, the app may enter system Picture-in-Picture (small
   floating window) so they can keep listening. They can close PiP / leave the
   room anytime (system X, in-window X, or PiP “Çık” action). Users can disable
   this under Settings → “Küçük ekran (Picture-in-Picture)” (default ON), like
   YouTube. iOS does not support Activity PiP for audio-only rooms; iOS uses
   sticky notification + in-app mini bar instead.
3) Picture-in-Picture for user videos: When watching a Status (Durum) video or
   a Direct Message video full-screen, if the user leaves the app (Home /
   multitasking), iOS/Android may show the system Picture-in-Picture window so
   playback can continue. The user can close PiP anytime with the system close
   control on the PiP window.

How to test voice background audio:
1. Sign in with the provided demo account.
2. Open or create a Voice Room → join as speaker/listener.
3. Leave the room screen (open another tab/profile) OR press Home.
4. Confirm audio continues / room stays connected; return via the mini bar or
   notification if shown.

How to test voice room PiP (Android):
1. Sign in with the demo account on an Android device (dev/prod build with
   expo-pip — not Expo Go).
2. Settings → ensure “Küçük ekran (Picture-in-Picture)” is ON.
3. Join a Voice Room and stay on the room screen → press Home.
4. Confirm a system PiP window appears with room title; audio continues.
5. Tap PiP to return to the room, or close via X / “Çık” to leave the room.
6. Turn the Settings toggle OFF → repeat step 3 → no PiP window; FGS
   notification / background audio still works.

How to test Picture-in-Picture (video):
1. Sign in with the demo account.
2. Open Status (Durum) feed → open a post that contains a VIDEO (or send yourself
   a video in Direct Messages and open it full-screen).
3. While the video is playing, press Home / switch apps.
4. Confirm the system Picture-in-Picture player appears (supported devices /
   OS versions only). Close PiP with the system X — playback stops / PiP exits.
5. PiP is optional UX on top of normal in-app playback; it is not required to
   use core features.

China / region note:
These features are not geo-blocked. We do not disable PiP or background voice
for Mainland China. Availability of system PiP depends on the device and OS
(Apple/Google system APIs), not on a server flag in our app.
NOTE: Voice-room Activity PiP requires a new Android native build after
adding expo-pip.

We do NOT use background audio for silent tracking or unrelated background work.
```

---

## App Store — Privacy / purpose strings (already in app.config.ts)

| Key | Purpose |
|-----|---------|
| Microphone | Voice rooms, live, calls; background keeps room audio when briefly leaving |
| Camera | Profile, chat photos, live video, KYC selfie |
| Bluetooth | Headsets in rooms/calls |
| Background Modes: audio | Voice room continuity + video PiP |
| Background Modes: remote-notification | Push |

---

## Google Play — Permission / feature declarations

**Foreground service (microphone / media playback)**  
Used to keep voice-room audio alive when the app is backgrounded, and for
optional Picture-in-Picture / media playback of user-shared videos.

**Suggested short description (Play Console):**

```
Microphone & foreground service: Used for voice rooms and live audio so
participants can keep talking if they briefly leave the app. Users can leave
the room at any time.

Picture-in-Picture / media playback: When watching a user-shared Status or
chat video, the system may show a small floating player if the user leaves the
app. The user can close that player anytime.
```

**Data safety:** Mark microphone as collected/processed for App functionality
(voice chat). Do not claim “background location”. Video PiP does not upload
extra data; it only plays media the user already opened.

---

## Çin App Store red riski (hatırlatma)

Sık red nedeni: Info.plist’te `audio` background mode var ama incelemeci
özelliği bulamıyor (Guideline **2.5.4**), veya açıklamada vaat edilen özellik
o bölgede kapalı / kırık.

Bu uygulamada:
- Ses odası arka plan sesi **açık ve test edilebilir**
- Ses odası Android Activity PiP **ayar anahtarı ile** (varsayılan açık); yeni
  native Android build gerekir (`expo-pip`)
- Video PiP **cihaz destekliyorsa** sistem penceresi; uygulama içinde ülke kilidi yok
- Özelliği “her cihazda garantili” diye pazarlama metninde yazma — “desteklenen
  cihazlarda sistem küçük ekran (Picture-in-Picture)” de

---

## Kullanıcıya görünen kısa özellik metni (TR / mağaza açıklaması)

**TR:**  
Durum veya mesaj videosunu izlerken uygulamadan çıkarsan, desteklenen
cihazlarda sistem küçük ekran (Picture-in-Picture) açılabilir; videoyu izlemeye
devam edebilirsin. Küçük ekranı istediğin zaman sistemdeki kapat (X) ile
kapatabilirsin. Ses odalarında (Android) oda ekranındayken uygulamadan çıkınca
köşede küçük pencere açılabilir; Ayarlar’dan “Küçük ekran (Picture-in-Picture)”
ile kapatabilirsin. Ses odalarında odadan kısa süre ayrilsan bile ses devam
edebilir; odadan tamamen çıkmak için mini şerit / PiP içindeki çıkışı kullan.

**EN (store listing feature bullet):**  
Picture-in-Picture for Status and chat videos on supported devices when you
leave the app; close anytime via the system PiP controls. On Android, voice
rooms can open a system PiP window from the room screen (toggle in Settings).
Voice rooms can keep audio active if you briefly leave; exit anytime from the
mini bar or PiP controls.
