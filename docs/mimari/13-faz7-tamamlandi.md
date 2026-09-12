# FAZ 7 — Ajans / Host / Cekim

## SQL
`supabase/migrations/008_faz7_ajans_host.sql`

Dashboard SQL Editor'de calistir. Sonra bayraklari ac:

```sql
update public.feature_flags
set enabled = true
where key in ('agency_enabled', 'withdrawals_enabled');
```

## Icerik
- Ajans basvuru / onay / `agencies` + levels
- Host basvuru (bagimsiz / ajansa katil) + `host_profiles` / targets
- Commission snapshot (`agency_commission_rates` + hediye trigger)
- Ajans cuzdani + `ajans_coin_transfer` (limitli)
- Host elmas cekimi: `cekim_talebi_olustur` + `withdrawal_requests`
- Kill: `kill_withdrawal`; bayrak: `agency_enabled`, `withdrawals_enabled`
- Dev: `host_bagimsiz_aktif_et` (prod'da kisitla)

## Moduller
- `src/moduller/ajanslar/`
- `src/moduller/hostlar/`
- `src/moduller/cuzdan/cekim/`

## Ekranlar
- `/ajans` — basvuru + populer/sahip olunan ajanslar
- `/host` — bagimsiz host / invite ile katilim
- Cuzdan — elmas cekim talebi + son talepler

## Notlar
- Misafir: ajans/host/cekim engelli (client + RPC)
- Komisyon oranlari hediye aninda snapshot; sonradan degismez
- Top Gifter ≠ Top Recharge ayrimi FAZ 6'da kalir; ajans board FAZ 8+

## Sonraki: FAZ 8 — tamamlandi
Bkz. [14-faz8-tamamlandi.md](14-faz8-tamamlandi.md)
