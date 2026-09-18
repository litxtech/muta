-- Yetkili (is_coin_distributor) ajans listesi + otomatik karşılama mesajı

alter table public.agencies
  add column if not exists coin_auto_message text;

comment on column public.agencies.coin_auto_message is
  'Coin yükleme sohbeti açılınca ajans sahibinden otomatik ilk mesaj (opsiyonel)';

-- Sohbet markası (önceki migration uygulanmamış ortamlarda da güvenli)
alter table public.message_threads
  add column if not exists thread_kind text not null default 'dm',
  add column if not exists title text,
  add column if not exists peer_agency_id uuid references public.agencies(id);

create index if not exists message_threads_peer_agency_idx
  on public.message_threads (peer_agency_id)
  where peer_agency_id is not null;

create or replace function public.yetkili_ajanslari_listele(p_limit int default 40)
returns table (
  id uuid,
  name text,
  agency_public_id text,
  logo_url text,
  slogan text,
  owner_id uuid,
  monthly_score numeric,
  coin_auto_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 80);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return query
  select
    a.id,
    a.name,
    a.agency_public_id,
    a.logo_url,
    a.slogan,
    a.owner_id,
    coalesce(a.monthly_score, 0)::numeric,
    a.coin_auto_message
  from public.agencies a
  where a.status = 'active'
    and a.is_coin_distributor = true
    and a.owner_id is not null
  order by coalesce(a.monthly_score, 0) desc, a.name asc
  limit v_limit;
end;
$$;

grant execute on function public.yetkili_ajanslari_listele(int) to authenticated;

-- Ajans sohbeti: ilk açılışta otomatik mesaj (sahipten)
create or replace function public.ajans_sohbet_ac_veya_getir(p_agency_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_name text;
  v_auto text;
  v_thread uuid;
  v_guest boolean;
  v_yeni boolean := false;
  v_body text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_agency_id is null then raise exception 'Agency required'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then
    raise exception 'Guest cannot start messages';
  end if;

  select owner_id, name, coin_auto_message
  into v_owner, v_name, v_auto
  from public.agencies
  where id = p_agency_id and status = 'active';
  if v_owner is null then raise exception 'Agency not found'; end if;
  if v_owner = v_uid then raise exception 'Kendi ajansına mesaj açılamaz'; end if;

  if public.kullanicilar_engelli_mi(v_uid, v_owner) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  select m1.thread_id into v_thread
  from public.message_thread_members m1
  join public.message_thread_members m2 on m1.thread_id = m2.thread_id
  join public.message_threads t on t.id = m1.thread_id
  where m1.user_id = v_uid
    and m2.user_id = v_owner
    and coalesce(t.thread_kind, 'dm') = 'dm'
    and t.peer_agency_id = p_agency_id
    and (
      select count(*) from public.message_thread_members mx
      where mx.thread_id = m1.thread_id
    ) = 2
  limit 1;

  if v_thread is not null then
    update public.message_thread_members set
      deleted_at = null,
      archived_at = null
    where thread_id = v_thread and user_id = v_uid
      and (deleted_at is not null or archived_at is not null);
    return v_thread;
  end if;

  v_yeni := true;
  insert into public.message_threads (thread_kind, peer_agency_id, title)
  values ('dm', p_agency_id, coalesce(nullif(trim(v_name), ''), 'Ajans'))
  returning id into v_thread;

  insert into public.message_thread_members (thread_id, user_id) values
    (v_thread, v_uid), (v_thread, v_owner);

  if v_yeni then
    v_body := coalesce(
      nullif(trim(v_auto), ''),
      'Merhaba! ' || coalesce(nullif(trim(v_name), ''), 'Ajans')
        || ' coin yükleme hattı. İhtiyacınızı yazın; cüzdan no veya kullanıcı ID paylaşabilirsiniz.'
    );
    insert into public.direct_messages (
      thread_id, sender_id, body, message_type
    ) values (
      v_thread, v_owner, left(v_body, 4000), 'text'
    );
    update public.message_threads set
      last_message_at = now(),
      last_message_preview = left(v_body, 120),
      updated_at = now()
    where id = v_thread;
  end if;

  return v_thread;
end;
$$;

grant execute on function public.ajans_sohbet_ac_veya_getir(uuid) to authenticated;

-- Ajans sahibi otomatik mesajı günceller
create or replace function public.ajans_coin_auto_mesaj_ayarla(
  p_agency_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select owner_id into v_owner from public.agencies where id = p_agency_id;
  if v_owner is null then raise exception 'Agency not found'; end if;
  if v_owner <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.agencies set
    coin_auto_message = nullif(trim(coalesce(p_message, '')), ''),
    updated_at = now()
  where id = p_agency_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_coin_auto_mesaj_ayarla(uuid, text) to authenticated;
