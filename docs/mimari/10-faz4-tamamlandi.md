# FAZ 4 — Sosyal cekirdek

## SQL
`supabase/migrations/005_faz4_sosyal.sql`

## Icerik
- `user_profile_stats` (denormalized — profilde SUM yok)
- `follows` + RPC `takip_et` / `takibi_birak`
- DM: threads, members, `mesaj_gonder`, `ozel_sohbet_ac_veya_getir`
- `device_push_tokens` + Notification Gateway kayit
- `explore_categories` (dinamik)
- `notification_outbox` (push ana islemi bekletmez)

## UI
- Home: Live / Voice / Trending / flag bolumleri (dating karti yok)
- Explore: `/kesfet`
- Messages: konu listesi + `/mesaj/[id]`
- Profil: takipci / charm / gift stats

## Sonraki: FAZ 5
LiveKit, Voice Rooms Layout Engine, Lobby, Live, PK
