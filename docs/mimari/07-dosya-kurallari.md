# Dosya Kurallari

## Zorunlu

- Dosya/klasor isimleri **Turkce ASCII** (s, i, g, u, o, c — ozel karakter yok)
- Isme bakinca islev anlasilsin
- Bir dosya = bir bagimsiz sorumluluk
- God Component / Service / Hook / Store yasak
- `utils.ts`, `helpers.ts`, `common.ts`, `manager.ts`, `functions.ts`, `service.ts`, `misc.ts`, `actions.ts` yasak

## Ornek isimler

- `HediyeGonder.ts`
- `HediyeBakiyesiniKontrolEt.ts`
- `MikrofonAc.ts`
- `OyTekrariKontrolu.ts`
- `SehirLideriYetkiKontrolu.ts`
- `APNsBildirimServisi.ts` (backend)

## Ayirma

Ayri dosya: UI, hook, API, dogrulama, yetki, business action, hesaplama, event, realtime, finans, guvenlik.  
Ayni sorumlulugun 3–5 satirlik private yardimcisini gereksiz ayirma.

## Screen kurali

Screen dosyasi **composition** yapar.  
Icermez: network, finans, permission, LiveKit internal, complex state orchestration.
