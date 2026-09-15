# share-redirect

Public install / invite redirect for Tamuso share links.

## Usage

```
GET /functions/v1/share-redirect?c=DAVETKODU
GET /functions/v1/share-redirect?c=DAVETKODU&landing=1
```

- Mobile UA → 302 to App Store / Play (from `app_share_links`)
- Desktop / `landing=1` → HTML download page

Deploy:

```
npx supabase functions deploy share-redirect --no-verify-jwt
```

Admin edits store URLs in-app: Yönetim → Paylaşım linkleri.
