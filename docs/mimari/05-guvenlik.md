# Guvenlik Mimarisi

## Temel kural

Mobil client guvenilir degildir.  
Authoritative olmayan: isAdmin, coinBalance, giftPrice, vipLevel, agencyRole, cityLeader, commission.

## Secrets (asla mobilde / git'te yok)

- APNs private key
- FCM service credentials
- Supabase service_role
- LiveKit secret
- Diger server secrets

LiveKit: backend kisa sureli token uretir.

## Security Event Engine (backend)

Event → Risk Analyzer → Rules → Allow / Challenge / Hold / Freeze / Alert

Risk skoru 0–100: Safe / Low / Medium / High / Critical

Izlenen ornekler:
- Brute force, credential stuffing
- Double spend, forged gift price, gift replay
- Agency transfer abuse, withdrawal abuse
- Election fraud (device clustering, bot voting)
- API flood, enumeration

Tek ortak IP otomatik fraud degildir.

## Mobil sorumluluk (hafif)

- Integrity sinyali (Play Integrity / App Attest)
- Device fingerprint (risk input)
- Root/jailbreak = risk sinyali, otomatik ban degil
- Agir tarama backend'de (performans)

## Rate limit

Login, OTP, message, follow, gift, report, transfer, withdrawal, vote, live token, room create.

## Idempotency + replay

Request ID, timestamp, nonce, idempotency key:  
Coin Purchase, Gift, Agency Transfer, Withdrawal, Bonus, Commission.

## Notification Gateway

Moduller APNs/FCM'ye dogrudan baglanmaz.  
Gateway platforma gore secer. Push, ana islemi bekletmez (queue).

## Child safety

Age gate, minor report, adult-minor risk, moderation, block, human escalation.  
Tek checkbox degildir.
