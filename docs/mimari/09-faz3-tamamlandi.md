# FAZ 3 — Finans

## SQL
`supabase/migrations/004_faz3_finans.sql`

## Backend
- `send_gift` + idempotency + kill switch + guest block + host_earnings
- `coin_satin_al_onayla` (idempotent IAP/manual credit)
- `kill_switch_aktif_mi` / `ozellik_bayragi_aktif_mi`
- Ledger silinmez; reversal sadece service_role

## Mobil moduller
- `HediyeGonder.ts`
- `CoinSatinAlOnayla.ts`
- `FinansIdempotencyAnahtariOlustur.ts`
- `KillSwitchAktifMiSunucu.ts`
- Cuzdan ledger okuma

## Kurallar
- Gift fiyatı client'tan gelmez
- Balance negatif olamaz
- Duplicate IAP / idempotency engelli
- Kill switch: gift + coin purchase

## Sonraki: FAZ 4
Profile stats, Follow, Home/Explore, Messaging, Notification foundation
