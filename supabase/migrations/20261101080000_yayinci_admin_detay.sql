-- ===========================================================================
-- Tamuso · Yayıncı Finans Merkezi — yönetici yayıncı detayı + vergi durumu
-- ===========================================================================
-- Amaç: web admin panelinden tek bir yayıncıyı incelemek ve yalnızca
-- *doğrulama* niteliğindeki işlemleri yapmak:
--   * program durumu (onay / askı / ret)  → admin_yayinci_program_durum (mevcut)
--   * ödeme hesabı doğrulaması            → admin_odeme_hesabi_dogrula (mevcut)
--   * vergi bilgisi durumu                → admin_yayinci_vergi_durum (bu dosya)
--
-- Tutar hesapları istemcide yapılmaz; tüm bakiyeler sunucudaki defterden
-- okunur. Bu dosya yeni tablo oluşturmaz, mevcut kayıtları değiştirmez.
-- ===========================================================================

create or replace function public.admin_yayinci_detay(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_profile jsonb;
  v_enr jsonb;
  v_acc jsonb;
  v_elig jsonb;
  v_totals jsonb;
  v_entries jsonb;
  v_payouts jsonb;
  v_adj numeric(14,4) := 0;
  v_diamonds numeric(20,0) := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_user_id is null then raise exception 'user_required'; end if;

  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'country_code', p.country_code,
    'birth_date', p.birth_date
  ) into v_profile
  from public.profiles p
  where p.id = p_user_id;

  if v_profile is null then raise exception 'user_not_found'; end if;

  select to_jsonb(e) - 'user_id' into v_enr
  from public.creator_program_enrollments e
  where e.user_id = p_user_id;

  -- Ödeme hesabı: yalnızca maskeli IBAN ve durum bilgisi döner.
  select jsonb_build_object(
    'id', a.id,
    'method', a.method,
    'account_holder', a.account_holder,
    'bank_name', a.bank_name,
    'iban_masked', a.iban_masked,
    'country_code', a.country_code,
    'currency', a.currency,
    'status', a.status,
    'verified_at', a.verified_at,
    'last_changed_at', a.last_changed_at
  ) into v_acc
  from public.creator_payout_accounts a
  where a.user_id = p_user_id;

  v_elig := public.yayinci_uygunluk_durumu(p_user_id);

  select coalesce(sum(a.amount_usd), 0) into v_adj
  from public.creator_earning_adjustments a
  where a.creator_id = p_user_id and a.applied = false;

  select coalesce(sum(d.amount), 0) into v_diamonds
  from public.creator_reward_diamonds d
  where d.creator_id = p_user_id;

  select jsonb_build_object(
    'pending_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'pending'), 0),
    'available_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0),
    'on_hold_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0),
    'in_payout_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'in_payout'), 0),
    'paid_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'paid'), 0),
    'lifetime_creator_usd', coalesce(sum(e.creator_usd) filter (where e.eligible), 0),
    'lifetime_gross_usd', coalesce(sum(e.gross_usd) filter (where e.eligible), 0),
    'lifetime_platform_usd', coalesce(sum(e.platform_usd) filter (where e.eligible), 0),
    'created_count', count(*),
    'ineligible_count', count(*) filter (where not e.eligible)
  ) into v_totals
  from public.creator_earning_entries e
  where e.creator_id = p_user_id;

  v_totals := coalesce(v_totals, '{}'::jsonb) || jsonb_build_object(
    'adjustments_usd', v_adj,
    'diamonds', v_diamonds
  );

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_entries
  from (
    select e.id, e.created_at, e.source_type, e.channel, e.coin_source, e.coins,
           e.gross_usd, e.creator_usd, e.platform_usd, e.deductions_usd, e.net_usd,
           e.eligible, e.ineligible_reason, public.yayinci_kazanc_durumu(e) as status,
           e.period_start, e.period_end
    from public.creator_earning_entries e
    where e.creator_id = p_user_id
    order by e.created_at desc
    limit 30
  ) x;

  select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) into v_payouts
  from (
    select i.id, i.batch_id, i.amount_usd, i.fee_usd, i.net_usd, i.status,
           i.external_reference, i.failure_reason, i.sent_at, i.paid_at,
           i.created_at, b.period_month, b.payout_date, b.status as batch_status
    from public.payout_batch_items i
    join public.payout_batches b on b.id = i.batch_id
    where i.creator_id = p_user_id
    order by i.created_at desc
    limit 10
  ) y;

  return jsonb_build_object(
    'profile', v_profile,
    'enrollment', v_enr,
    'payout_account', v_acc,
    'eligibility', v_elig,
    'totals', v_totals,
    'entries', v_entries,
    'payouts', v_payouts,
    'currency', 'USD'
  );
end;
$$;

grant execute on function public.admin_yayinci_detay(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Vergi bilgisi durumu (yalnızca doğrulama kaydı; tutar hesaplamaz)
-- ---------------------------------------------------------------------------
create or replace function public.admin_yayinci_vergi_durum(
  p_user_id uuid,
  p_status text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.creator_program_enrollments%rowtype;
  v_before jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_status not in ('pending', 'complete', 'not_required') then
    raise exception 'invalid_status';
  end if;

  select * into v_row from public.creator_program_enrollments
  where user_id = p_user_id
  for update;

  if v_row.user_id is null then raise exception 'enrollment_not_found'; end if;

  v_before := to_jsonb(v_row);

  update public.creator_program_enrollments
    set tax_status = p_status,
        tax_reference = case
          when p_status = 'pending' then null
          else coalesce(nullif(trim(coalesce(p_reference, '')), ''), tax_reference)
        end,
        updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  insert into public.financial_audit_events
    (actor_id, action, entity_type, entity_id, before_state, after_state, details)
  values (
    auth.uid(),
    'admin.creator_tax_status',
    'creator_program_enrollment',
    p_user_id,
    v_before,
    to_jsonb(v_row),
    jsonb_build_object('status', p_status)
  );

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.admin_yayinci_vergi_durum(uuid, text, text) to authenticated;
