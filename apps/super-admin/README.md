# Super Admin (Next.js) — plan

Ayrı web uygulaması. Mobil içine full finansal admin konmaz.

## RBAC (mobil + SQL)

- `profiles.is_admin` — yalnızca `service_role` / migration seed yazar
- Trigger: `profiles_is_admin_koru`
- RPC: `ben_admin_miyim()`
- Mobil hub: `/admin` (özet + sertifikasyon / platform linkleri)
- Seed admin: `sonertoprak97@gmail.com` (015_admin_yetkisi.sql)

## Web panel kapsamı (sonraki sprint)

1. Feature flags / kill switches CRUD
2. Withdrawal onay kuyruğu
3. Agency coin transfer audit
4. Moderation queue (`user_reports`)
5. Notification outbox monitor + push worker tetikleme
6. Sertifikasyon checklist override

Stack önerisi: Next.js App Router + Supabase SSR + service role yalnızca server actions.

Doküman: `docs/mimari/03-rls-rbac.md`
