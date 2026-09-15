# Supabase CLI — dogru kullanim

`npx supabase db push` / `supabase functions deploy` **kullanma**.
Bunlar tarayici `supabase login` token'i ile gider; org yetkisi yoksa **401/403** verir.

## Dogru komutlar (proje token)

```bash
npm run db:push
npm run functions:deploy
```

Bunlar `.env.supabase.local` icindeki `SUPABASE_ACCESS_TOKEN` (project/PAT) ile calisir.

## Hata alirsan

1. `.env.supabase.local` var mi? `SUPABASE_ACCESS_TOKEN=` dolu mu?
2. Proje linked mi: `npm run supabase:link`
3. Token suresi dolduysa Dashboard → Account → Access Tokens yenile

## Asla

```bash
npx supabase db push          # 403 riski
supabase functions deploy     # 401 riski
```
