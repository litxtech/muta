# admin-kullanici-sifre-degistir

Admin-only: update target user's auth password + audit log.

```
npx supabase functions deploy admin-kullanici-sifre-degistir
```

Body:

```json
{
  "user_id": "uuid",
  "password": "secret12"
}
```
