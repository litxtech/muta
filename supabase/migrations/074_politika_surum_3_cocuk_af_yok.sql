-- Politika sürüm 3: uzun ToS / gizlilik / çocuk koruma (af yok, hesap kapatılır)
-- Tam metin uygulama içi PolitikaMetinleri.ts; DB özet + kabul kaydı için sürüm.

insert into public.policy_versions (policy_code, version, body_md)
select v.policy_code, v.version, v.body_md
from (values
  (
    'tos',
    3,
    E'TAMUSO KULLANIM ŞARTLARI\n\nSon güncelleme: 15 Eylül 2026 · Sürüm 3.0\n\nPlatform 18+ içindir. Hesap oluşturarak / lobiye girerek şartları kabul edersiniz. Yasaklar: taciz, dolandırıcılık, CSAM, güvenlik ihlali, yaş yalanı. Coin/elmas sanal varlıktır. İhlalde uyarı, ban, bakiye iptali veya yasal bildirim uygulanabilir. Çocuk koruma ihlallerinde af yoktur; hesaplar kapatılır. Tam metin: uygulama Politikalar / Lobi.'
  ),
  (
    'privacy',
    3,
    E'TAMUSO GİZLİLİK POLİTİKASI\n\nSon güncelleme: 15 Eylül 2026 · Sürüm 3.0\n\nHesap, kullanım, cihaz, destek ve ödeme referansları hizmet, güvenlik ve yasal yükümlülük için işlenir. Veri satılmaz. 18+ platformdur; bilerek çocuk verisi toplanmaz. Haklar: erişim, düzeltme, silme, kısıtlama. Tam metin: uygulama Politikalar / Lobi.'
  ),
  (
    'child_safety',
    3,
    E'TAMUSO ÇOCUK KORUMA POLİTİKASI\n\nSon güncelleme: 15 Eylül 2026 · Sürüm 3.0\n\nKESİN: AF YOKTUR. CSAM / çocuk istismarı / grooming / reşit olmayan katılım tespitinde hesaplar DERHAL ve KALICI kapatılır; kaçış hesapları da kapatılır; mercilere bildirilebilir. Platform yalnızca 18+ içindir. Rapor: Bildir/Engelle + Canlı Destek. Tam metin: uygulama Politikalar / Lobi.'
  )
) as v(policy_code, version, body_md)
where not exists (
  select 1 from public.policy_versions x
  where x.policy_code = v.policy_code and x.version = v.version
);

update public.policies
set description = case code
  when 'tos' then 'Platform kuralları ve sorumluluklar (v3)'
  when 'privacy' then 'Kişisel verilerin işlenmesi (v3)'
  when 'child_safety' then '18+ · sıfır tolerans · af yok · hesap kapatılır'
  else description
end
where code in ('tos', 'privacy', 'child_safety');
