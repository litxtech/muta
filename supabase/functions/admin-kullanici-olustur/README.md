# admin-kullanici-olustur

Admin-only: create auth user + profile patch + audit log.

```
npx supabase functions deploy admin-kullanici-olustur
```

Body:

```json
{
  "email": "user@example.com",
  "password": "secret12",
  "display_name": "Ad",
  "username": "adsoyad",
  "phone_e164": "+905xxxxxxxxx"
}
```
