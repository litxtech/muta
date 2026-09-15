# admin-gunluk-ozet

23:59 (Europe/Istanbul) gunluk yeni kayit ozetini admin hesaplarina bildirir.

Ayrica `notification-push` worker'i tetikler.

## Cagri

```bash
curl -X POST "https://PROJECT.supabase.co/functions/v1/admin-gunluk-ozet" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "X-Worker-Secret: $PUSH_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Manuel test (force):

```bash
curl -X POST "https://PROJECT.supabase.co/functions/v1/admin-gunluk-ozet" \
  -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

## Cron

Supabase Dashboard → Edge Functions → Schedules:

- Cron: `59 * * * *` (her saat :59)
- Fonksiyon kendi TR 23:55–23:59 penceresini kontrol eder

veya migration `035` icindeki `pg_cron` job'u.
