# Modul Sinirlari

Her klasör bağımsız bir bounded context'tir.  
Bir modül başka modülün **iç dosyalarına** doğrudan erişmez; yalnızca o modulün **public sozlesmesi** üzerinden bağlanır.

## Ana moduller

| Klasor | Sorumluluk | Icermez |
|--------|------------|---------|
| `kimlik-dogrulama` | Login, session, sifre, active sessions | Profil UI, wallet |
| `misafir-hesabi` | Guest identity, upgrade karti | Full auth |
| `kullanici-profili` | Profil, stats, privacy, prestige | Wallet settlement |
| `ana-sayfa` | Home composition | Feed algorithm detayi |
| `kesfet` | Explore filtre/kategori | Room business |
| `ses-odalari` | Room UI composition + LiveKit baglantisi | Lobby, gift, PK, chat, moderation logic |
| `oda-lobisi` | Odaya giris oncesi | Room ic business |
| `canli-yayin` | Live stream screens | Gift settlement |
| `livekit` | Token, baglanti, track izolasyonu | Gift/PK |
| `pk` | PK akislari (server score) | Room layout |
| `mesajlasma` | DM | Oda sohbeti |
| `oda-sohbeti` | Room chat | DM |
| `hediyeler` | Katalog, gonderim, animasyon queue | Wallet ledger yazimi (RPC cagirir) |
| `cuzdan` | Bakiye gosterimi, ledger okuma | Gift price |
| `iap` | StoreKit/Play verify | Gift UI |
| `vip` / `seviyeler` | Prestige | Finans settlement |
| `ajanslar` / `hostlar` | Agency/host | Platform ban |
| `sehirler` + lig/savas/secim | City platform | Finans admin |
| `etkinlikler` / `gorevler` / `liderlik-siralamalari` | Engagement | Tier 1 finans |
| `duyurular` / `politikalar` | Announcement vs Consent ayri | Birbirinin yerine gecmez |
| `bildirimler` | Notification Gateway istemcisi | APNs/FCM secret |
| `moderasyon` | Kick/ban/mute room | Platform-wide ban (admin) |
| `guvenlik` | Risk sinyali (hafif mobil) | Agir risk engine (backend) |
| `ayarlar` | User settings | Admin RBAC |
| `ozellik-bayraklari` | Feature flags + kill switch | Business logic |
| `varlik-yonetimi` | CDN asset metadata | Upload malware scan (backend) |

## Fault isolation

- Hediye hatasi → LiveKit sesi kesilmez
- Chat hatasi → oda kapanmaz
- Leaderboard hatasi → gift durmaz
- Analytics hatasi → kullanici islemi tamamlanir

## Ses odasi kirmizi cizgi

`ses-odalari` icinde **yasak**:
- Lobby business
- Gift business
- PK business
- Chat business
- Moderation business
- Leaderboard business

Bunlar kendi modullerinden typed contract / hook / event ile baglanir.
