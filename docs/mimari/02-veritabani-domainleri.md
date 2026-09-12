# Veritabani Domainleri

PostgreSQL (Supabase). Domainler logical schema veya tablo prefix ile ayrilir.  
Kritik kararlar **RPC / Edge Function** ile server-authoritative.

## Domain haritasi

### kimlik
- `auth.users` (Supabase)
- `profiles`
- `public_user_ids` (kalici Public ID, immutable)
- `guest_identities`
- `device_sessions`
- `user_consents`

### finans (Tier 1)
- `wallets` (coins) — host earnings ayri
- `host_earnings` (diamonds)
- `wallet_ledger` (immutable)
- `host_earnings_ledger`
- `coin_packages`
- `coin_purchases` (IAP, idempotent)
- `gift_transactions`
- `agency_distribution_balances`
- `agency_transfers`
- `withdrawal_requests`
- `reconciliation_runs`

### hediye
- `gifts` (dinamik katalog, hard-code yok)
- `gift_categories`
- `gift_assets` (CDN)
- `gift_rarities`
- `gift_collections`
- `gift_evolutions` (ileride)

### sosyal
- `follows`
- `blocks`
- `reports`
- `direct_messages`
- `message_threads`

### oda / canli
- `rooms`
- `room_seats` / `room_mic_slots`
- `room_members`
- `room_layouts` / `room_themes`
- `room_capacity_tiers` (admin config)
- `live_sessions`
- `pk_matches` / `pk_scores` (backend authoritative)

### ajans / host
- `agencies`
- `agency_applications`
- `host_applications`
- `host_metrics`
- `host_targets`
- `agency_commissions` (snapshot on tx)

### sehir
- `geo_countries` / `geo_regions` / `geo_cities` (hard-code yok)
- `official_city_rooms`
- `user_supported_cities`
- `city_league_seasons`
- `city_power_events`
- `city_battles`
- `city_roles`
- `city_elections` / `city_candidates` / `city_votes` (unique constraint)

### engagement
- `events` / `missions` / `badges` / `user_badges`
- `leaderboard_snapshots`
- `announcements` / `announcement_receipts`
- `policies` / `policy_versions` / `policy_acceptances`

### guvenlik / admin
- `feature_flags` / `kill_switches`
- `security_events`
- `admin_roles` / `admin_permissions`
- `admin_audit_logs`
- `device_push_tokens`
- `notification_queue`

## Mevcut SQL

`supabase/migrations/001_initial_schema.sql` — profiles, wallets, gifts, rooms, send_gift.  
Sonraki migration'lar domain bazli numaralanir: `002_public_id.sql`, `003_feature_flags.sql`, ...

## Kurallar

- Gift price client'tan gelmez
- Balance negatif olamaz
- Ledger satiri silinmez; duzeltme = reversal
- Election vote: DB unique constraint
- Commission: transaction snapshot
