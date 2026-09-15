-- Cuzdan anlik guncelleme: wallets tablosu realtime yayininda

do $$
begin
  begin
    alter publication supabase_realtime add table public.wallets;
  exception when duplicate_object then
    null;
  end;
end $$;

-- Filtreli UPDATE olaylari icin (user_id = auth.uid)
alter table public.wallets replica identity full;
