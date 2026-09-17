-- Kaskad spin ölçek: tek-tur context, idempotency kurtarma, aktif oturum indeksi.
-- Her spin'de müzik + getUser + 4 ayrı SELECT yerine 1 context RPC.

create index if not exists kaskad_sessions_active_user_idx
  on public.kaskad_sessions (user_id, created_at desc)
  where status = 'active';

create index if not exists kaskad_rounds_user_created_idx
  on public.kaskad_rounds (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Spin öncesi tek round-trip (admin, bakiye, bonus, bakım, bahis aralığı)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_spin_context(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := false;
  v_coins bigint := 0;
  v_bonus integer := 0;
  v_persistent numeric := 0;
  v_session uuid;
  s public.kaskad_game_settings%rowtype;
begin
  if p_user_id is null then
    return jsonb_build_object('error', 'user required');
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles where id = p_user_id;

  select coalesce(coins, 0) into v_coins
  from public.wallets where user_id = p_user_id;

  select id, bonus_spins_remaining, bonus_persistent_multiplier
    into v_session, v_bonus, v_persistent
  from public.kaskad_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  select * into s from public.kaskad_game_settings where id = 1;

  return jsonb_build_object(
    'isAdmin', coalesce(v_admin, false),
    'coins', coalesce(v_coins, 0),
    'sessionId', v_session,
    'bonusSpinsRemaining', coalesce(v_bonus, 0),
    'persistentMultiplier', coalesce(v_persistent, 0),
    'gamePaused', coalesce(s.game_paused, false),
    'maintenance', coalesce(s.maintenance_mode, false),
    'maintenanceMessage', coalesce(s.maintenance_message, ''),
    'minBet', s.min_bet,
    'maxBet', s.max_bet,
    'betPresets', s.bet_presets
  );
end;
$$;

revoke all on function public.kozmik_kaskad_spin_context(uuid) from public;
revoke all on function public.kozmik_kaskad_spin_context(uuid) from anon;
grant execute on function public.kozmik_kaskad_spin_context(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Aynı idempotency anahtarıyla kayıp yanıtı kurtar (çift bahis yok)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_round_by_idempotency(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.kaskad_rounds%rowtype;
begin
  if v_uid is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.kaskad_rounds
  where user_id = v_uid and idempotency_key = trim(p_key);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'round_id', v_row.id,
    'status', v_row.status,
    'result_snapshot', v_row.result_snapshot
  );
end;
$$;

grant execute on function public.kozmik_kaskad_round_by_idempotency(text) to authenticated;
grant execute on function public.kozmik_kaskad_round_by_idempotency(text) to service_role;

create or replace function public.kozmik_kaskad_round_by_idempotency_admin(
  p_user_id uuid,
  p_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.kaskad_rounds%rowtype;
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.kaskad_rounds
  where user_id = p_user_id and idempotency_key = trim(p_key);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'roundId', v_row.id,
    'sessionId', v_row.session_id,
    'balanceAfter', v_row.balance_after,
    'result', v_row.result_snapshot,
    'duplicate', true
  );
end;
$$;

revoke all on function public.kozmik_kaskad_round_by_idempotency_admin(uuid, text) from public;
revoke all on function public.kozmik_kaskad_round_by_idempotency_admin(uuid, text) from anon;
grant execute on function public.kozmik_kaskad_round_by_idempotency_admin(uuid, text) to service_role;
