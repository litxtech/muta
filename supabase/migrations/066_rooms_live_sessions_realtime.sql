-- Canlı oda kapanınca / silinince ana feed anında güncellensin

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_sessions;
exception
  when duplicate_object then null;
  when others then null;
end $$;
