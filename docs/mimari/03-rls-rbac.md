# RLS ve RBAC

## Mobil (Supabase RLS)

Client `anon` / authenticated JWT ile erisir.  
`service_role` sadece Edge Functions / Super Admin backend.

### Ornek politikalar (hedef)

| Tablo | SELECT | INSERT/UPDATE | Not |
|-------|--------|---------------|-----|
| profiles | authenticated | own row | Public profil alanlari |
| wallets | own | yok (RPC) | Balance client yazamaz |
| wallet_ledger | own | yok | Immutable |
| gifts | active catalog | admin only | Fiyat client'tan gelmez |
| rooms | live/public | own host | |
| city_votes | own | own once | UNIQUE(election, user) |
| messages | participants | participant | |
| admin_* | yok (mobil) | yok | Web Super Admin |

## Web Super Admin RBAC

Roller:
- SUPER_ADMIN
- ADMIN
- FINANCE_ADMIN
- MODERATOR
- GIFT_MANAGER
- AGENCY_MANAGER
- SUPPORT

Granular permission ornekleri:
- `gift.create`, `gift.update`
- `coin.adjust`, `coin.transfer`
- `agency.approve`, `host.approve`
- `withdrawal.approve`
- `election.create`, `city.manage`
- `policy.publish`, `user.ban`

Buyuk finans islemlerinde Dual Approval (Four Eyes) opsiyonu.

## Yetki dogrulama

Owner / Moderator / City Leader / Agency role **backend** dogrular.  
Mobil `isAdmin` / `isHost` gonderisi authoritative degildir.
