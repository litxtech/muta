-- Cüzdan no ile alıcı adı/soyadı (KYC onaylı) — transfer formu otomatik doldurma

create or replace function public.cuzdan_no_ile_alici_getir(p_wallet_number text)
returns table (
  wallet_number char(18),
  first_name text,
  last_name text,
  kyc_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  v_num := regexp_replace(coalesce(p_wallet_number, ''), '\D', '', 'g');
  if length(v_num) <> 18 then
    return;
  end if;

  return query
  select
    w.wallet_number,
    case when w.kyc_status = 'approved' then w.legal_first_name else null end,
    case when w.kyc_status = 'approved' then w.legal_last_name else null end,
    w.kyc_status::text
  from public.wallet_accounts w
  where w.wallet_number = v_num
    and w.user_id <> auth.uid()
  limit 1;
end;
$$;

grant execute on function public.cuzdan_no_ile_alici_getir(text) to authenticated;
