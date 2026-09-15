# Özellik gap checklist (orijinal plan ↔ durum)

Kaynak: 2026-09-09 “CURSOR İÇİN TAM ANA PROJE PLANI” + `docs/mimari/06-fazlar.md`.  
Güncelleme: 2026-09-12 (LiveKit primary; Agora kaldırıldı).

Durum: **DONE** | **PARTIAL** | **MISSING** | **OPS** (3rd-party / store)

## Platform kimliği
| Özellik | Durum | Not |
|---------|--------|-----|
| Canlı yayın | PARTIAL | UI+SQL+LiveKit; native build şart |
| Ses odaları + layout engine | PARTIAL | Layout kodları var; görsel derinliği sınırlı |
| Creator / Host | DONE | `/host`, başvurular, elmas |
| Ajans | DONE | `/ajans`, komisyon, transfer |
| Şehir odaları / lider / oy / lig / savaş | PARTIAL | Hub+SQL; seed/admin içerik |
| PK | PARTIAL | İzleme DONE; **başlatma + hediye→skor** 051 ile eklendi |
| Coin / hediye / diamond | DONE | RPC authoritative |
| VIP / Gifter / Recharge / Charm | PARTIAL | Seviye + sıralama UI ince |
| DM + oda sohbeti | DONE | Ayrı modüller |
| Takip | DONE | |
| Etkinlik / görev / rozet | PARTIAL | Platform hub; bayraklara bağlı |
| Leaderboard | DONE | `/siralamalar` |
| Duyuru / politika / çocuk güvenliği | DONE | |
| Push | PARTIAL | Outbox+EF; FCM/APNs OPS |
| Moderasyon | DONE | Oda + rapor |
| Fraud / Risk Engine (ağır) | PARTIAL | Mobil sinyal; backend engine yok |
| Super Admin (Next.js) | MISSING | `apps/super-admin` plan |
| Agency Portal (web) | MISSING | |

## RTC
| Özellik | Durum |
|---------|--------|
| LiveKit Cloud token | DONE (`livekit-token`) |
| Native LiveKit RN | PARTIAL — paketler eklendi, **yeni EAS build** gerekir |
| Agora | Kaldırıldı (bilinçli) |
| 1:1 ses/görüntü | PARTIAL — LiveKit path |

## Ses odası plan maddeleri
| Madde | Durum |
|-------|--------|
| Lobi ayrı | DONE |
| Mikrofon isteği gönder | DONE |
| Mikrofon kabul/red + koltuk | DONE (051 + UI) |
| Owner moderasyon | DONE |
| Active speaker halo | PARTIAL |
| Kapasite admin tiers | DONE (SQL) |
| Room theme unlock | PARTIAL |

## Finans / store
| Madde | Durum |
|-------|--------|
| IAP iskeleti | PARTIAL |
| Stripe iskeleti | PARTIAL (`stripe_enabled` kapalı) |
| Gerçek store ürünleri | OPS |
| Çekim | DONE (bayraklı) |

## Bu turda kapatılan kod boşlukları
1. `051_pk_mic_tamamlama.sql` — mic yanıt, PK başlat/bitir, gift→PK skor  
2. Host mikrofon istek paneli  
3. Oda + canlıdan PK başlat  
4. LiveKit birincil (Agora binary yok)

## Sıradaki (öncelik)
1. EAS iOS+Android development build (LiveKit native)  
2. `google-services.json` + iOS Push Yes  
3. LiveKit secrets smoke (oda / 1:1 / canlı) — secrets 2026-09-12 set edildi  
4. Super Admin web (çekim, bayrak, rapor)  
5. Hediye CDN kataloğu genişletme  
6. Room layout görsel varyantları  

## Build öncesi doğrulama (2026-09-12)
- [x] Expo SDK patch paketleri (`expo install --fix`) — doctor 21/21  
- [x] LiveKit RN + WebRTC + expo plugin  
- [x] `@shopify/flash-list` (plan maddesi)  
- [x] Migrations `001`–`053` remote sync  
- [x] Edge functions deploy  
- [x] LiveKit secrets (`LIVEKIT_URL/API_KEY/API_SECRET`)  
- [x] Core feature flags ON (`053`)  
- [ ] Native EAS build (henüz)  
- [ ] FCM `google-services.json` (yok)  
