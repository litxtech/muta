# FAZ 8 — Sehir platformu

## SQL
`supabase/migrations/009_faz8_sehir.sql`

Dashboard SQL Editor'de calistir. Bayraklar:

```sql
update public.feature_flags
set enabled = true
where key in (
  'city_league_enabled',
  'city_battles_enabled',
  'city_elections_enabled'
);
```

## Icerik
- `geo_countries` / `geo_regions` / `geo_cities` (hard-code yok; seed ornek)
- `official_city_rooms` + `user_supported_cities`
- `city_roles` (leader / vice_leader — tek aktif partial unique)
- Lig: `city_league_seasons` + `city_league_standings` + `city_power_events`
- Savas: `city_battles` + `sehir_savas_skor_ekle`
- Secim: `city_elections` / `city_candidates` / `city_votes`
  - UNIQUE(election_id, user_id) — tek oy
- RPC: `sehir_destekle`, `sehir_aday_basvurusu`, `sehir_oyu_kullan`
- Dev: `sehir_secim_olustur_dev`, `sehir_secimi_oylamaya_ac_dev`

## Moduller
- `sehirler/` — liste, destek, resmi odalar
- `sehir-ligi/` — sezon siralamasi
- `sehir-savaslari/` — aktif savaslar
- `sehir-secimleri/` — aday + oy

## Ekranlar
- `/sehir` — hub
- `/sehir/lig`
- `/sehir/savas`
- `/sehir/secim`

## Notlar
- Misafir oy/destek engelli (`oy_kullan`)
- Leaderboard hatasi finans/hediye kesmez (fault isolation)
- LiveKit deploy ayri (secret + dogru Supabase hesabi gerekir)

## Sonraki: FAZ 9 ✅
Bkz. [15-faz9-tamamlandi.md](15-faz9-tamamlandi.md)

## Sonraki: FAZ 10
Load / security / reconciliation, LiveKit + gift stress
