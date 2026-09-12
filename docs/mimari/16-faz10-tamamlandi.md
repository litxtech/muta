# FAZ 10 — Sertifikasyon

## SQL
`supabase/migrations/011_faz10_sertifikasyon.sql`

Dashboard SQL Editor'de calistir. Bayraklar:

```sql
update public.feature_flags
set enabled = true
where key in (
  'certification_hub_enabled',
  'graceful_degradation_enabled',
  'stress_tools_enabled'
);
-- Dusuk cihaz testi icin:
-- update public.feature_flags set enabled = true where key = 'low_end_mode_enabled';
```

Mutabakat (service_role / SQL Editor service):

```sql
select public.mutabakat_paketi_calistir();
```

## Icerik
- `certification_checks` checklist (load / security / reconciliation / livekit / gift / network / android)
- Mutabakat: `host_elmas_mutabakat_calistir` + `mutabakat_paketi_calistir` (wallet + host)
- `platform_saglik_ozeti` — bayrak / kill / son reconciliation (bakiye yok)
- `yuk_sinyali_kaydet` — load_signal security event (rate limited)
- Kill: `kill_heavy_animations`, `kill_livekit_reconnect`

## Moduller
- `ag-baglantisi/` — expo-network durum + graceful degradation karari
- `performans/DusukCihazModuAktifMi.ts` — animasyon sinirlari
- `mutabakat/okuma/MutabakatSonuclariniGetir.ts`
- `sertifikasyon/okuma/` — checklist + saglik ozeti
- `yuk-testi/` — hediye animasyon + LiveKit mock reconnect stres
- `HediyeAnimasyonuKuyrugu` — max kuyruk / fullScreen kisitlama

## Ekranlar
- `/sertifikasyon` — hub (Profil + Platform kisa yolu)

## Notlar
- Tam mutabakat yalniz `service_role`
- Offline / dusuk cihaz UI kapisi; finans authoritative degil
- LiveKit stres mock token kullanir; gercek oda spam yok
- Super Admin RBAC / otomatik load farm bu fazda yok

## Sonraki
Production smoke: EAS preview build, LiveKit gercek oda, IAP sandbox, 011 migration remote
