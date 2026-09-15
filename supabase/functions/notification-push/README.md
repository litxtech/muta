# notification-push

`notification_outbox` kuyrugundaki `pending` kayitlari Expo Push API ile gonderir.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` (otomatik)
- Opsiyonel: `PUSH_WORKER_SECRET` — `X-Worker-Secret` header

## Cagri

```bash
curl -X POST "https://vdkqrqtrftzhbtquzked.supabase.co/functions/v1/notification-push" \
  -H "Authorization: Bearer $SUPABASE_ANON_OR_SERVICE" \
  -H "X-Worker-Secret: $PUSH_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}'
```

Cron (ornek): her 1 dk scheduler → bu endpoint.
