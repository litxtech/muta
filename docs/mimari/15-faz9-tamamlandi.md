# FAZ 9 — Platform operasyon

## SQL
`supabase/migrations/010_faz9_platform_operasyon.sql`

Dashboard SQL Editor'de calistir. Bayraklar:

```sql
update public.feature_flags
set enabled = true
where key in (
  'events_enabled',
  'missions_enabled',
  'announcements_enabled',
  'policies_enabled',
  'moderation_enabled',
  'analytics_enabled'
);
```

## Icerik
- `platform_events`, `missions` / `user_mission_progress`, `badges` / `user_badges`
- Duyuru ≠ politika: `announcements` + receipts vs `policies` / versions / acceptances
- Oda moderasyon: `oda_moderasyon_uygula` (mute/kick/ban) + `room_bans`
- `user_reports` → `guvenlik_olayi_kaydet`
- Analytics enqueue: `analytics_olay_ekle` (fault-isolated no-op)
- Push center thin: `bildirim_kuyruga_ekle_dev` → `notification_outbox`
- Kill: `kill_moderation`

## Moduller
- `etkinlikler/`, `gorevler/`, `duyurular/`, `politikalar/`, `moderasyon/`
- `bildirimler/okuma/BildirimKuyrugumuGetir.ts`
- `guvenlik/okuma` + `analytics/AnalyticsOlayEkle.ts`

## Ekranlar
- `/platform` — events + missions hub
- `/duyuru`, `/politika`, `/guvenlik`, `/bildirimler`

## Ek: Oda sohbeti
`012_oda_sohbet.sql` — `room_chat_messages` + `oda_sohbet_mesaji_gonder`  
Oda ekranında chat paneli; host kalkanı → mute/kick/ban.

## Notlar
- Super Admin RBAC / APNs worker / risk engine bu fazda yok (admin follow-up)
- Misafir: gorev odulu / rapor `oy_kullan` kapisi
- Analytics hatasi kullanici akisini bozmaz

## Sonraki: Production / ops
EAS preview, LiveKit gercek oda, IAP sandbox — bkz. [16-faz10-tamamlandi.md](16-faz10-tamamlandi.md)
