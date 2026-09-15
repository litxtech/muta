-- Profil düzenleme: banka/IBAN hesabı (çekim için)
create table if not exists public.user_bank_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_holder text not null,
  bank_name text not null,
  iban text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_bank_accounts_iban_len check (char_length(replace(iban, ' ', '')) between 15 and 34)
);

create unique index if not exists user_bank_accounts_iban_unique
  on public.user_bank_accounts (upper(replace(iban, ' ', '')));

drop trigger if exists user_bank_accounts_updated_at on public.user_bank_accounts;
create trigger user_bank_accounts_updated_at
  before update on public.user_bank_accounts
  for each row execute function public.set_updated_at();

alter table public.user_bank_accounts enable row level security;

drop policy if exists "Own bank account select" on public.user_bank_accounts;
create policy "Own bank account select"
  on public.user_bank_accounts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Own bank account insert" on public.user_bank_accounts;
create policy "Own bank account insert"
  on public.user_bank_accounts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Own bank account update" on public.user_bank_accounts;
create policy "Own bank account update"
  on public.user_bank_accounts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Own bank account delete" on public.user_bank_accounts;
create policy "Own bank account delete"
  on public.user_bank_accounts for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_bank_accounts to authenticated;
