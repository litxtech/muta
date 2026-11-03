-- =============================================================================
-- Yayıncı ödeme hesabı — user_bank_accounts kısıt düzeltmesi
--
-- Sorun: 018_profil_banka_hesabi.sql içindeki
--   constraint user_bank_accounts_iban_len check (char_length(...) between 15 and 34)
-- ve global tekil IBAN indeksi yalnızca IBAN için doğruydu. IBAN kullanmayan
-- ülkelerde (US routing + 10 haneli hesap, PH GCash 11 hane, IN UPI, PIX
-- anahtarı, NUBAN 10 hane ...) birincil hesap kimliği 15 karakterden kısa
-- olduğu için kayıt check constraint'e takılıyor ve kullanıcı "hata" görüyordu.
--
-- Düzeltme:
--   * Uzunluk kuralı 4..64 aralığına genişletilir (IBAN/hesap/cüzdan/PIX farkı
--     artık country_payout_rules + country_payout_methods şemasında doğrulanır).
--   * Global tekil IBAN indeksi kaldırılır: iki yayıncı aynı aile/şirket
--     hesabını kullanabilir; tekillik kullanıcı bazında zaten primary key ile
--     sağlanır.
--
-- IBAN doğrulaması (ülke öneki + mod-97 + ülke uzunluğu) kaybolmaz:
-- public.odeme_iban_dogrula() yayinci_odeme_hesabi_kaydet içinde çalışır.
-- =============================================================================

alter table public.user_bank_accounts
  drop constraint if exists user_bank_accounts_iban_len;

alter table public.user_bank_accounts
  add constraint user_bank_accounts_iban_len
  check (char_length(btrim(iban)) between 4 and 64);

drop index if exists public.user_bank_accounts_iban_unique;

-- Aynı hesap kimliğinin farklı kullanıcılarda tekrarını engellemek yerine,
-- arama/sorgu için tekillik gerektirmeyen normal indeks bırakılır.
create index if not exists user_bank_accounts_iban_lookup_idx
  on public.user_bank_accounts (upper(replace(iban, ' ', '')));
