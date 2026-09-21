-- Engelleme: DM geçmişi okuma + thread engel durumu

create or replace function public.mesajlari_getir(
  p_thread_id uuid,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns setof public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_clear timestamptz;
  v_kind text;
  v_peer uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select clear_before into v_clear
  from public.message_thread_members
  where thread_id = p_thread_id and user_id = v_uid;

  if not found then raise exception 'Forbidden'; end if;

  select coalesce(t.thread_kind, 'dm') into v_kind
  from public.message_threads t
  where t.id = p_thread_id;

  -- Mahkeme dışı DM: engelliyse geçmişi de kapalı
  if coalesce(v_kind, 'dm') <> 'mahkeme' then
    select m.user_id into v_peer
    from public.message_thread_members m
    where m.thread_id = p_thread_id and m.user_id <> v_uid
    limit 1;

    if v_peer is not null and public.kullanicilar_engelli_mi(v_uid, v_peer) then
      raise exception 'Bu kullaniciyla iletisim engellenmis';
    end if;
  end if;

  return query
  select m.*
  from public.direct_messages m
  where m.thread_id = p_thread_id
    and m.deleted_at is null
    and (v_clear is null or m.created_at > v_clear)
    and not exists (
      select 1 from public.direct_message_hidden h
      where h.user_id = v_uid and h.message_id = m.id
    )
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.mesajlari_getir(uuid, integer, timestamptz) to authenticated;

-- Thread karşı tarafıyla engel var mı? (UI composer kilidi)
create or replace function public.mesaj_thread_engelli_mi(p_thread_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_peer uuid;
begin
  if v_uid is null then return false; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    return false;
  end if;

  select coalesce(t.thread_kind, 'dm') into v_kind
  from public.message_threads t where t.id = p_thread_id;

  if coalesce(v_kind, 'dm') = 'mahkeme' then
    return false;
  end if;

  select m.user_id into v_peer
  from public.message_thread_members m
  where m.thread_id = p_thread_id and m.user_id <> v_uid
  limit 1;

  if v_peer is null then return false; end if;
  return public.kullanicilar_engelli_mi(v_uid, v_peer);
end;
$$;

grant execute on function public.mesaj_thread_engelli_mi(uuid) to authenticated;
