-- Benzersiz kısa oda kodu (kartta / paylaşımda gösterilir)
-- UUID id kalır; room_code kullanıcıya görünen kısa kimlik.

alter table public.rooms
  add column if not exists room_code text;

create unique index if not exists rooms_room_code_uidx
  on public.rooms (room_code)
  where room_code is not null;

create or replace function public.oda_benzersiz_kod_uret()
returns text
language plpgsql
as $$
declare
  v_alfabe constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_kod text;
  v_i int;
  v_deneme int := 0;
begin
  loop
    v_kod := 'ODA-';
    for v_i in 1..6 loop
      v_kod := v_kod || substr(v_alfabe, 1 + floor(random() * length(v_alfabe))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.rooms r where r.room_code = v_kod
    );
    v_deneme := v_deneme + 1;
    if v_deneme > 40 then
      -- Çakışma aşırı nadir; UUID kuyruğu ile benzersizleştir
      v_kod := 'ODA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit;
    end if;
  end loop;
  return v_kod;
end;
$$;

create or replace function public.rooms_room_code_ata()
returns trigger
language plpgsql
as $$
begin
  if new.room_code is null or btrim(new.room_code) = '' then
    new.room_code := public.oda_benzersiz_kod_uret();
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_room_code_ata_trg on public.rooms;
create trigger rooms_room_code_ata_trg
  before insert on public.rooms
  for each row
  execute function public.rooms_room_code_ata();

-- Mevcut odalara kod doldur
update public.rooms r
set room_code = public.oda_benzersiz_kod_uret()
where r.room_code is null;
