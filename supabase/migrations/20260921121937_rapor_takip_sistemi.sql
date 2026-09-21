-- Kullanıcı rapor takibi + admin bildirene görünür not

alter table public.user_reports
  add column if not exists reporter_note text;

comment on column public.user_reports.reporter_note is
  'Bildirene gösterilen durum notu (admin_note iç not olarak kalır).';

create or replace function public.raporlarimi_listele(p_limit integer default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_out
  from (
    select
      r.id,
      r.reason,
      r.details,
      r.status,
      r.content_type,
      r.content_id,
      r.created_at,
      r.resolved_at,
      r.reporter_note,
      case
        when p.id is null then null
        else jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'username', p.username,
          'avatar_url', p.avatar_url,
          'public_user_id', p.public_user_id
        )
      end as target
    from public.user_reports r
    left join public.profiles p on p.id = r.target_user_id
    where r.reporter_id = v_uid
    order by r.created_at desc
    limit v_limit
  ) t;

  return v_out;
end;
$$;

grant execute on function public.raporlarimi_listele(integer) to authenticated;

create or replace function public.raporumu_getir(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_reports%rowtype;
  v_target jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_id is null then raise exception 'id required'; end if;

  select * into v_row
  from public.user_reports
  where id = p_id and reporter_id = v_uid;

  if not found then raise exception 'Rapor bulunamadı'; end if;

  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'public_user_id', p.public_user_id
  ) into v_target
  from public.profiles p
  where p.id = v_row.target_user_id;

  return jsonb_build_object(
    'id', v_row.id,
    'reason', v_row.reason,
    'details', v_row.details,
    'status', v_row.status,
    'content_type', v_row.content_type,
    'content_id', v_row.content_id,
    'created_at', v_row.created_at,
    'resolved_at', v_row.resolved_at,
    'reporter_note', v_row.reporter_note,
    'target', v_target
  );
end;
$$;

grant execute on function public.raporumu_getir(uuid) to authenticated;

-- Eski 3 argümanlı imzayı kaldır; tek fonksiyon (defaults ile geriye uyumlu)
drop function if exists public.admin_rapor_durum_guncelle(uuid, text, text);

create or replace function public.admin_rapor_durum_guncelle(
  p_id uuid,
  p_status text,
  p_admin_note text default null,
  p_reporter_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_note text := nullif(trim(coalesce(p_reporter_note, '')), '');
  v_admin text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_title text;
  v_body text;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception 'Gecersiz durum';
  end if;

  select reporter_id into v_reporter
  from public.user_reports
  where id = p_id
  for update;

  if not found then raise exception 'Rapor bulunamadi'; end if;

  update public.user_reports set
    status = p_status,
    admin_note = coalesce(v_admin, admin_note),
    reporter_note = coalesce(v_note, reporter_note),
    resolved_at = case
      when p_status in ('resolved', 'dismissed') then coalesce(resolved_at, now())
      else null
    end,
    resolved_by = case
      when p_status in ('resolved', 'dismissed') then auth.uid()
      else null
    end
  where id = p_id;

  perform public.admin_audit_yaz(
    v_reporter,
    'report_' || p_status,
    'Rapor durumu: ' || p_status,
    jsonb_build_object('report_id', p_id, 'has_reporter_note', v_note is not null)
  );

  v_title := case p_status
    when 'reviewing' then 'Raporunuz inceleniyor'
    when 'resolved' then 'Raporunuz sonuçlandı'
    when 'dismissed' then 'Raporunuz kapatıldı'
    else 'Rapor durumunuz güncellendi'
  end;
  v_body := coalesce(
    v_note,
    case p_status
      when 'reviewing' then 'Moderasyon ekibi raporunuzu inceliyor.'
      when 'resolved' then 'Raporunuzla ilgili işlem tamamlandı.'
      when 'dismissed' then 'Raporunuz incelendi; ek işlem gerekmedi.'
      else 'Rapor durumunuz değişti.'
    end
  );

  begin
    perform public.bildirim_kuyruga_ekle(
      v_reporter,
      'system',
      v_title,
      v_body,
      '/raporlarim/' || p_id::text,
      jsonb_build_object(
        'kind', 'report_status',
        'report_id', p_id,
        'status', p_status
      )
    );
  exception
    when others then null;
  end;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_rapor_durum_guncelle(uuid, text, text, text)
  to authenticated;
