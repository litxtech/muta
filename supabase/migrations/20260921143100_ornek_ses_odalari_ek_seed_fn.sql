-- Admin seed: ana 8 + ek 10 = 18 örnek canlı oda
-- Fonksiyon gövdesi remote'da apply_migration ile kuruldu (ornek_ses_odalari_ek_seed_fn).
-- Yerel tekrarlar için admin_ornek_ses_odalari_seed ek seed'i de çağırır.

create or replace function public.admin_ornek_ses_odalari_seed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ana jsonb;
  v_ek jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  v_ana := public._ornek_ses_odalari_seed_ic();
  begin
    v_ek := public._ornek_ses_odalari_ek_seed_ic();
  exception when undefined_function then
    v_ek := jsonb_build_object('ek_oda_sayisi', 0, 'uyari', 'ek_seed_yok');
  end;
  return v_ana || coalesce(v_ek, '{}'::jsonb) || jsonb_build_object('toplam_hedef', 18);
end;
$$;
