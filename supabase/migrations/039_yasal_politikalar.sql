-- Yasal politikalar: tos, privacy, child_safety (TR metin) + policies_enabled

update public.feature_flags
set enabled = true, updated_at = now()
where key = 'policies_enabled';

insert into public.policies (code, title, description, is_required, is_active) values
  ('tos', 'Kullanım Şartları', 'Platform kuralları ve sorumluluklar', true, true),
  ('privacy', 'Gizlilik Politikası', 'Kişisel verilerin işlenmesi', true, true),
  ('child_safety', 'Çocuk Koruma Politikası', '18+ ve çocuk güvenliği', true, true)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  is_required = true,
  is_active = true;

-- Yerel metinlerle ayni ozet; tam metin uygulama icinde PolitikaMetinleri.ts
insert into public.policy_versions (policy_code, version, body_md)
select v.policy_code, v.version, v.body_md
from (values
  (
    'tos',
    2,
    E'TAMUSO KULLANIM ŞARTLARI\n\nSon güncelleme: 12 Eylül 2026\n\nPlatform 18 yaş ve üzeri içindir. Hesap oluşturarak kullanım şartlarını kabul edersiniz. Yasaklar: taciz, dolandırıcılık, CSAM, güvenlik ihlali. Coin/elmas sanal varlıktır. İhlalde uyarı, ban veya yasal bildirim uygulanabilir. Detaylı metin uygulama içi politikalardadır.'
  ),
  (
    'privacy',
    2,
    E'TAMUSO GİZLİLİK POLİTİKASI\n\nSon güncelleme: 12 Eylül 2026\n\nHesap, kullanım, cihaz ve destek verileri hizmet sunumu, güvenlik ve yasal yükümlülük için işlenir. Veri satılmaz. 18+ platformdur. Haklarınız: erişim, düzeltme, silme. Detaylı metin uygulama içi politikalardadır.'
  ),
  (
    'child_safety',
    1,
    E'TAMUSO ÇOCUK KORUMA POLİTİKASI\n\nSon güncelleme: 12 Eylül 2026\n\nPlatform yalnızca 18+ içindir. Çocuk istismarı / CSAM için sıfır tolerans. İhlalde hesap kapatılır ve mercilere bildirilebilir. Raporlama: uygulama içi bildir / canlı destek. Detaylı metin uygulama içi politikalardadır.'
  )
) as v(policy_code, version, body_md)
where not exists (
  select 1 from public.policy_versions x
  where x.policy_code = v.policy_code and x.version = v.version
);

-- Kayit ekrani (anon) politikalari okuyabilsin
drop policy if exists "Policies readable anon" on public.policies;
create policy "Policies readable anon" on public.policies
  for select to anon using (is_active);

drop policy if exists "Policy versions readable anon" on public.policy_versions;
create policy "Policy versions readable anon" on public.policy_versions
  for select to anon using (true);

grant select on public.policies to anon;
grant select on public.policy_versions to anon;
