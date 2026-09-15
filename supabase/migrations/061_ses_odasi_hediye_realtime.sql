-- Ses odası: hediye animasyonları diğer katılımcılara gelsin.
-- gift_transactions realtime publication'da yoktu → sadece gönderen görüyordu.

do $$
begin
  alter publication supabase_realtime add table public.gift_transactions;
exception
  when duplicate_object then null;
  when others then null;
end $$;
