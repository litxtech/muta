-- Çocuk koruma politika v5: tek seferlik onay kartı (TR+EN tam metin uygulamada)
insert into public.policy_versions (policy_code, version, body_md)
select 'child_safety', 5,
  E'# Placeholder\n\nTAMUSO Çocuk Koruma v5.0 — 22 Eylül 2026\nTek seferlik 18+ onay kartı · sıfır tolerans · af yok · hesap kapatılır.\nTam metin: uygulama PolitikaMetinleri (TR+EN).'
where not exists (
  select 1 from public.policy_versions x
  where x.policy_code = 'child_safety' and x.version = 5
);

update public.policies
set description = '18+ · tek seferlik onay kartı · sıfır tolerans · af yok'
where code = 'child_safety';
