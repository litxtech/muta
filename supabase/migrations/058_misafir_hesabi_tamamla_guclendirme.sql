-- Misafir → kayıtlı: username çakışmasında düşmesin; welcome bonus profili bozmasın

create or replace function public.misafir_hesabi_tamamlandi(
  p_display_name text,
  p_username text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_base text;
  v_try text;
  v_i int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  v_base := nullif(trim(lower(coalesce(p_username, ''))), '');
  if v_base is null or length(v_base) < 3 then
    v_try := v_profile.username;
  else
    v_try := left(v_base, 24);
    -- benzersiz olana kadar sonek ekle; olmazsa mevcut guest username kalsın
    while exists (
      select 1 from public.profiles p
      where p.username = v_try and p.id <> v_uid
    ) loop
      v_i := v_i + 1;
      if v_i > 8 then
        v_try := v_profile.username;
        exit;
      end if;
      v_try := left(v_base, 18) || substr(replace(v_uid::text, '-', ''), 1, 4) || v_i::text;
    end loop;
  end if;

  update public.profiles
  set
    is_guest = false,
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    username = coalesce(nullif(trim(v_try), ''), username),
    updated_at = now()
  where id = v_uid
  returning * into v_profile;

  -- Welcome coins: hata profil tamamlamayı bozmasın
  begin
    if not exists (
      select 1 from public.wallet_ledger
      where user_id = v_uid and reason = 'welcome_bonus'
    ) then
      update public.wallets
        set coins = coins + 100, updated_at = now()
        where user_id = v_uid;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
      values (
        v_uid, 'coins', 100,
        (select coins from public.wallets where user_id = v_uid),
        'welcome_bonus'
      );
    end if;
  exception when others then
    raise warning 'misafir_hesabi_tamamlandi welcome_bonus: %', sqlerrm;
  end;

  return v_profile;
end;
$$;

grant execute on function public.misafir_hesabi_tamamlandi(text, text) to authenticated;
