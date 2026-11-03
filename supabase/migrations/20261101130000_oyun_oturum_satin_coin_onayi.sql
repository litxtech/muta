-- Oyun oturumları (oda oyunları) için satın alınan coin onayı
-- -----------------------------------------------------------------------------
-- Önceki migration oda oyunlarında giriş ücretini cuzdan_coin_harca(...) ile
-- ödüyordu ancak onay parametresini sabit `true` geçiyordu. Bu, oyun coinleri
-- yetersizken satın alınan coinlerin kullanıcıya hiç sorulmadan harcanması
-- demekti (Şart 2 ihlali).
--
-- Bu migration:
--   1) join_game_session / create_game_session içindeki onay parametresini
--      işlem-yerel (transaction-local) bir ayara bağlar; varsayılan KAPALI.
--   2) Açık onay ile çağıran sarmalayıcı RPC'ler ekler:
--        - oyun_oturumuna_katil(p_session_id, p_entry_amount, p_satin_coin_onay)
--        - oyun_oturumu_olustur(..., p_satin_coin_onay)
--      Ayar `set_config(..., true)` ile yalnızca o istek işleminde geçerlidir.
-- -----------------------------------------------------------------------------

do $mig$
declare
  v_src text;
  v_old text;
  v_new text;
  v_consent boolean := false;
begin
  -- 1) join_game_session: onay artık sabit değil
  begin
    v_src := replace(pg_get_functiondef('public.join_game_session(uuid,bigint)'::regprocedure), E'\r\n', E'\n');
    v_old := $f$
        v_uid, v_entry, 'game_entry', 'game_session', p_session_id,
        'gs_entry_' || p_session_id::text || '_' || v_uid::text, 'game_session', true);$f$;
    v_new := replace(
      v_src,
      replace(v_old, E'\r\n', E'\n'),
      $f$
        v_uid, v_entry, 'game_entry', 'game_session', p_session_id,
        'gs_entry_' || p_session_id::text || '_' || v_uid::text, 'game_session',
        coalesce(current_setting('cuzdan.satin_coin_onay', true) = 'on', false));$f$
    );
    if v_new = v_src then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('unmatched', 'join_game_session consent');
    else
      execute v_new;
      v_consent := true;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('patched', 'join_game_session consent');
    end if;
  exception when others then
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
    values ('patch_failed', 'join_game_session consent :: ' || sqlerrm);
  end;

  -- 2) create_game_session: onay artık sabit değil
  begin
    v_src := replace(pg_get_functiondef('public.create_game_session(uuid,text,integer,integer,bigint)'::regprocedure), E'\r\n', E'\n');
    v_old := $f$
      v_uid, v_entry, 'game_entry', 'game_session', null,
      'gs_create_' || coalesce(p_game_code, 'oda') || '_' || v_uid::text || '_' || extract(epoch from now())::bigint::text,
      p_game_code, true);$f$;
    v_new := replace(
      v_src,
      replace(v_old, E'\r\n', E'\n'),
      $f$
      v_uid, v_entry, 'game_entry', 'game_session', null,
      'gs_create_' || coalesce(p_game_code, 'oda') || '_' || v_uid::text || '_' || extract(epoch from now())::bigint::text,
      p_game_code,
      coalesce(current_setting('cuzdan.satin_coin_onay', true) = 'on', false));$f$
    );
    if v_new = v_src then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('unmatched', 'create_game_session consent');
    else
      execute v_new;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('patched', 'create_game_session consent');
    end if;
  exception when others then
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
    values ('patch_failed', 'create_game_session consent :: ' || sqlerrm);
  end;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- 3) Açık onaylı sarmalayıcılar (yalnızca kendi oturumu için)
-- -----------------------------------------------------------------------------
do $wrap$
declare
  v_ret_join text;
  v_ret_create text;
begin
  v_ret_join := pg_get_function_result('public.join_game_session(uuid,bigint)'::regprocedure);
  v_ret_create := pg_get_function_result('public.create_game_session(uuid,text,integer,integer,bigint)'::regprocedure);

  execute format($f$
    create or replace function public.oyun_oturumuna_katil(
      p_session_id uuid,
      p_entry_amount bigint default 0,
      p_satin_coin_onay boolean default false
    )
    returns %s
    language plpgsql
    security definer
    set search_path to 'public'
    as $b$
    begin
      perform set_config(
        'cuzdan.satin_coin_onay',
        case when coalesce(p_satin_coin_onay, false) then 'on' else 'off' end,
        true
      );
      return public.join_game_session(p_session_id, p_entry_amount);
    end;
    $b$;
  $f$, v_ret_join);

  execute format($f$
    create or replace function public.oyun_oturumu_olustur(
      p_room_id uuid,
      p_game_code text,
      p_duration_seconds integer default null,
      p_max_players integer default null,
      p_entry_amount bigint default 0,
      p_satin_coin_onay boolean default false
    )
    returns %s
    language plpgsql
    security definer
    set search_path to 'public'
    as $b$
    begin
      perform set_config(
        'cuzdan.satin_coin_onay',
        case when coalesce(p_satin_coin_onay, false) then 'on' else 'off' end,
        true
      );
      return public.create_game_session(
        p_room_id, p_game_code, p_duration_seconds, p_max_players, p_entry_amount
      );
    end;
    $b$;
  $f$, v_ret_create);
end;
$wrap$;

revoke all on function public.oyun_oturumuna_katil(uuid, bigint, boolean) from public, anon;
grant execute on function public.oyun_oturumuna_katil(uuid, bigint, boolean) to authenticated;

revoke all on function public.oyun_oturumu_olustur(uuid, text, integer, integer, bigint, boolean) from public, anon;
grant execute on function public.oyun_oturumu_olustur(uuid, text, integer, integer, bigint, boolean) to authenticated;

comment on function public.oyun_oturumuna_katil(uuid, bigint, boolean) is
  'Oyun oturumuna katılır; oyun coinleri yetmezse satın alınan coinler yalnızca p_satin_coin_onay = true ise kullanılır.';
comment on function public.oyun_oturumu_olustur(uuid, text, integer, integer, bigint, boolean) is
  'Oyun oturumu oluşturur; oyun coinleri yetmezse satın alınan coinler yalnızca p_satin_coin_onay = true ise kullanılır.';
