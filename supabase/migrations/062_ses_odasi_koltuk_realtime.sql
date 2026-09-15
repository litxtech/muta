-- Ses odası: koltuk değişiklikleri (mikrofon kabulü) diğer istemcilere gelsin.

do $$
begin
  alter publication supabase_realtime add table public.room_seats;
exception
  when duplicate_object then null;
  when others then null;
end $$;
