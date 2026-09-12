# FAZ 2 — Kimlik ve Guvenlik Temeli

## SQL
`supabase/migrations/003_faz2_kimlik_guvenlik.sql`

## Dashboard (zorunlu)
1. Authentication → Providers → **Anonymous** = ON (misafir UUID korumasi)
2. Email provider + SMTP (FAZ 1 SETUP.md)

## Kod
- SecureStore oturum: `GuvenliOturumDepolama.ts`
- Misafir: `MisafirOlarakDevamEt` + `HesabiTamamlaKarti`
- Public ID: profiles.public_user_id
- Cihaz oturumlari: `cihazlar` ekrani + RPC
- Guvenlik sinyali: `GuvenlikOlayiKaydet` (hafif)

## Misafir yapamaz
mesaj, hediye, coin, takip, yorum, mikrofon, canli, oda, ajans, oy, cekim
→ upgrade karti

## Sonraki: FAZ 3
IAP, ledger hardening, gift settlement idempotency, kill switch enforcement
