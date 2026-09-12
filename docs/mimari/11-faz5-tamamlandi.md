# FAZ 5 — LiveKit / Oda / Live / PK

## SQL
`supabase/migrations/006_faz5_livekit_oda_pk.sql`

## Moduller
- `livekit/` — token (secret yok), baglanti, ses seviyesi izolasyonu
- `ses-odalari/duzen` — Layout Engine (Floating Glass, Aurora, Orbit...)
- `oda-lobisi/` — AYRI lobi (oda icine yazilmaz)
- `canli-yayin/` — live sessions
- `pk/skor` — skor sadece backend okuma

## Ekranlar
- `/lobi/[id]` → sonra `/room/[id]`
- `/canli` Live
- `/pk` PK Now
- Room: Layout Engine + mock/real LiveKit + hediye fault isolation

## Env (opsiyonel gercek LiveKit)
```
EXPO_PUBLIC_LIVEKIT_URL=
EXPO_PUBLIC_LIVEKIT_TOKEN_URL=
```

## Sonraki: FAZ 6
Gift catalog genisletme, animasyon CDN/queue, VIP/Gifter/Charm/Recharge, rankings
