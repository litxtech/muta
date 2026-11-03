-- =============================================================================
-- Yayıncı ödeme kanalları — ülke bazlı alan şemalarının etkinleştirilmesi
--
-- Sorun:
--   20261101160000_yayinci_banka_rehberi.sql ve
--   20261101161000_yayinci_banka_rehberi_ek_ulkeler.sql dosyalarındaki VALUES
--   sırası (country_code, method, scheme, currency, bank_name_required,
--   is_enabled, fields, note). IBAN satırlarında ikinci bayrak `false`
--   bırakıldığı için bank_name_required=true, is_enabled=false yazıldı.
--
--   Sonuç: TR, DE, FR, NL, ES, IT, PK, SA, AE… gibi IBAN/RIB ülkelerinin
--   banka kanalı "kapalı" sayıldı; `yayinci_odeme_ulke_durumu` etkin kanal
--   bulamayınca generic şemaya (hesap numarası + SWIFT) düşüyordu. Kullanıcı
--   ülkeyi seçse bile o ülkenin alanları (IBAN, CLABE, PIX, IFSC, sort code,
--   transit no, RIB, CBU…) gösterilmiyordu.
--
-- Bu migration:
--   1) Alan şeması tanımlı her kanalı etkinleştirir (banka + cüzdan).
--   2) bank_name_required bayrağını şemaya göre yeniden hesaplar:
--        IBAN / UK IBAN / RIB  → banka adı gerekmez (IBAN bankayı taşır)
--        yerel hesap / ACH…    → banka adı gerekir
--        cüzdan transferi      → banka adı gerekmez
--   3) Hiçbir ülke "kanalı yok" durumuna düşmesin diye kontrol bloğu ekler.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Şeması tanımlı kanalları etkinleştir
-- ---------------------------------------------------------------------------
update public.country_payout_methods m
set is_enabled = true,
    requirements = jsonb_set(
      coalesce(m.requirements, '{}'::jsonb),
      '{bank_name_required}',
      to_jsonb(
        m.method <> 'wallet_transfer'
        and coalesce(m.requirements ->> 'scheme', 'local_account')
            not in ('iban', 'uk_iban', 'rib')
      ),
      true
    ),
    updated_at = now()
where jsonb_typeof(m.requirements -> 'fields') = 'array'
  and jsonb_array_length(m.requirements -> 'fields') > 0;

-- Eski (alan şeması olmayan) kayıtlar: alan listesi boşsa kanal kapalı
-- kalsın, çünkü `yayinci_odeme_ulke_durumu` bu ülke için generic şemayı
-- üretir ve kullanıcıya doğru alanları gösterir.
update public.country_payout_methods m
set is_enabled = false,
    updated_at = now()
where not (jsonb_typeof(m.requirements -> 'fields') = 'array')
   or jsonb_array_length(coalesce(m.requirements -> 'fields', '[]'::jsonb)) = 0;

-- ---------------------------------------------------------------------------
-- 2) Cüzdan kanallarında banka alanı zorunlu olmasın (provider yeterli)
-- ---------------------------------------------------------------------------
update public.country_payout_methods m
set requirements = jsonb_set(
      coalesce(m.requirements, '{}'::jsonb),
      '{bank_name_required}',
      'false'::jsonb,
      true
    ),
    updated_at = now()
where m.method = 'wallet_transfer'
  and coalesce((m.requirements ->> 'bank_name_required')::boolean, false);

-- ---------------------------------------------------------------------------
-- 3) Doğrulama: para birimi tanımlı her ülkenin en az bir etkin kanalı olmalı
-- ---------------------------------------------------------------------------
do $$
declare
  v_eksik text;
begin
  select string_agg(r.country_code, ', ' order by r.country_code)
  into v_eksik
  from public.country_payout_rules r
  where not exists (
    select 1
    from public.country_payout_methods m
    where m.country_code = r.country_code and m.is_enabled
  );

  if v_eksik is not null then
    raise exception 'Etkin ödeme kanalı olmayan ülkeler: %', v_eksik;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Kanalların okunmasını hızlandır (ülke + etkin filtre)
-- ---------------------------------------------------------------------------
create index if not exists country_payout_methods_enabled_idx
  on public.country_payout_methods (country_code, method)
  where is_enabled;

comment on column public.country_payout_methods.is_enabled is
  'Kanal kullanıcıya açık mı? Alan şeması tanımlı kanallar açıktır.';
