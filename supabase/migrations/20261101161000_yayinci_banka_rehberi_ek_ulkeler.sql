-- =============================================================================
-- Yayıncı ödeme hesabı — ek ülke banka rehberi
--
-- 20261101160000_yayinci_banka_rehberi.sql dosyasını tamamlar:
--   * İngiltere, Singapur, Hong Kong, Çin ve Orta Doğu (JO/BH/OM)
--   * Baltık + Orta Avrupa IBAN ülkeleri (EE, LT, LV, SK, SI, LU, MT, CY, IS)
--   * Afrika (CI, SN, CM, TZ, UG, ET) — banka + mobil para
--   * Güney/Orta Amerika (BO, PY, UY, DO, GT, CR, PA, EC)
--   * Asya (MM, KH)
--
-- Banka adı rehberden gelir; listede olmayan banka serbest metinle girilebilir.
-- Ödeme hâlâ manuel yapılır: bu dosya hiçbir ödeme sağlayıcısı çağırmaz.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Detay normalizasyonu — ayırıcılı hesap kimlikleri
-- ---------------------------------------------------------------------------
create or replace function public.odeme_detay_normallestir(p_details jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      lower(t.k),
      case
        when lower(t.k) in (
          'iban', 'account_number', 'routing_number', 'swift_bic',
          'wallet_number', 'clabe', 'document_id'
        ) then upper(regexp_replace(t.v, '\s', '', 'g'))
        when lower(t.k) in (
          'sort_code', 'ifsc', 'bic', 'bsb', 'transit_number',
          'institution_number', 'branch_code', 'bank_code', 'agency',
          'cbu', 'cci', 'rib', 'corr_account', 'account_id'
        ) then upper(regexp_replace(t.v, '[\s-]', '', 'g'))
        else trim(t.v)
      end
    ),
    '{}'::jsonb
  )
  from (
    select e.k, e.v
    from jsonb_each_text(coalesce(p_details, '{}'::jsonb)) as e(k, v)
    where trim(coalesce(e.v, '')) <> ''
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- 2) Ülke / kanal alan şemaları
-- ---------------------------------------------------------------------------
insert into public.country_payout_methods (
  country_code, method, provider, currency, min_payout_usd, is_enabled,
  auto_payout, requires_kyc, requires_tax_info, requirements, note
)
select
  s.country_code,
  s.method,
  null,
  s.currency,
  25.00,
  s.is_enabled,
  false,
  true,
  true,
  jsonb_build_object(
    'scheme', s.scheme,
    'bank_name_required', s.bank_name_required,
    'fields', s.fields
  ),
  s.note
from (values
  -- ------------------------------ Birleşik Krallık --------------------------
  ('GB', 'bank_transfer', 'uk_sort_code', 'GBP', true, true,
   '[{"key":"sort_code","required":true,"pattern":"^[0-9]{2}-?[0-9]{2}-?[0-9]{2}$","max_length":8,"example":"20-00-00"},{"key":"account_number","required":true,"pattern":"^[0-9]{8}$","max_length":8,"numeric":true,"example":"55779911"}]'::jsonb,
   'İngiltere banka havalesi (sort code + 8 haneli hesap numarası).'),
  ('GB', 'local_transfer', 'uk_iban', 'GBP', true, false,
   '[{"key":"iban","required":true,"example":"GB29 NWBK 6016 1331 9268 19"}]'::jsonb,
   'IBAN ile SEPA/UK havalesi.'),
  ('GB', 'wallet_transfer', 'wallet', 'GBP', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["wise","revolut","paypal"],"example":"wise"},{"key":"wallet_number","required":true,"max_length":40,"example":"@kullanici"}]'::jsonb,
   'Wise / Revolut / PayPal hesabı.'),

  -- --------------------------------- Singapur -------------------------------
  ('SG', 'bank_transfer', 'fast', 'SGD', true, true,
   '[{"key":"bank_code","required":true,"pattern":"^[0-9]{3,4}$","max_length":4,"numeric":true,"example":"7171"},{"key":"branch_code","required":true,"pattern":"^[0-9]{3}$","max_length":3,"numeric":true,"example":"001"},{"key":"account_number","required":true,"pattern":"^[0-9]{9,12}$","max_length":12,"numeric":true,"example":"1234567890"}]'::jsonb,
   'FAST / GIRO havalesi (banka kodu + şube kodu + hesap no).'),
  ('SG', 'wallet_transfer', 'wallet', 'SGD', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["paynow","grabpay"],"example":"paynow"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{8,15}$","max_length":15,"example":"+6591234567"}]'::jsonb,
   'PayNow / GrabPay (telefon numarası).'),

  -- -------------------------------- Hong Kong -------------------------------
  ('HK', 'bank_transfer', 'fps', 'HKD', true, true,
   '[{"key":"bank_code","required":true,"pattern":"^[0-9]{3}$","max_length":3,"numeric":true,"example":"012"},{"key":"branch_code","required":true,"pattern":"^[0-9]{3}$","max_length":3,"numeric":true,"example":"345"},{"key":"account_number","required":true,"pattern":"^[0-9]{6,9}$","max_length":9,"numeric":true,"example":"123456789"}]'::jsonb,
   'Banka havalesi (banka kodu + şube kodu + hesap no).'),
  ('HK', 'wallet_transfer', 'fps', 'HKD', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9+]{8,15}$","max_length":15,"example":"+85291234567"}]'::jsonb,
   'FPS (telefon numarası) ile anlık transfer.'),

  -- ---------------------------------- Çin -----------------------------------
  ('CN', 'bank_transfer', 'cnaps', 'CNY', true, true,
   '[{"key":"bank_code","required":true,"pattern":"^[0-9]{12}$","max_length":12,"numeric":true,"example":"102100099996"},{"key":"account_number","required":true,"pattern":"^[0-9]{12,19}$","max_length":19,"numeric":true,"example":"6222021234567890123"}]'::jsonb,
   'CNAPS kodu + banka hesap numarası.'),
  ('CN', 'wallet_transfer', 'wallet', 'CNY', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["alipay","wechat"],"example":"alipay"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{6,20}$","max_length":20,"example":"+8613800138000"}]'::jsonb,
   'Alipay / WeChat Pay kimliği.'),

  -- ------------------------------- Ürdün -----------------------------------
  ('JO', 'bank_transfer', 'iban', 'JOD', true, false,
   '[{"key":"iban","required":true,"example":"JO94 CBJO 0010 0000 0000 0131 0003 02"}]'::jsonb,
   'IBAN havalesi (JOD).'),

  -- -------------------------------- Bahreyn ---------------------------------
  ('BH', 'bank_transfer', 'iban', 'BHD', true, false,
   '[{"key":"iban","required":true,"example":"BH67 BMAG 0000 0123 4567 89"}]'::jsonb,
   'IBAN havalesi (BHD).'),

  -- --------------------------------- Umman ----------------------------------
  ('OM', 'bank_transfer', 'iban', 'OMR', true, false,
   '[{"key":"iban","required":true,"example":"OM81 0000 0000 0000 0000 0000"}]'::jsonb,
   'IBAN havalesi (OMR).'),

  -- --------------------------- Baltık ülkeleri ------------------------------
  ('EE', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"EE38 2200 2210 2014 5685"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('LT', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"LT12 1000 0111 0100 1000"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('LV', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"LV80 BANK 0000 4351 9500 1"}]'::jsonb,
   'SEPA havalesi (IBAN).'),

  -- --------------------------- Orta Avrupa ----------------------------------
  ('SK', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"SK31 1200 0000 1987 4263 7541"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('SI', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"SI56 2633 0001 2039 086"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('LU', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"LU28 0019 4006 4475 0000"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('MT', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"MT84 MALT 0110 0001 2345 MTLC AST0 01S"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('CY', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"CY17 0020 0128 0000 0012 0052 7600"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('IS', 'bank_transfer', 'iban', 'ISK', true, false,
   '[{"key":"iban","required":true,"example":"IS14 0159 2600 7654 5510 7303 39"}]'::jsonb,
   'IBAN havalesi (ISK).'),

  -- ------------------------------ Afrika (XOF/XAF) --------------------------
  ('CI', 'bank_transfer', 'local_account', 'XOF', true, true,
   '[{"key":"agency","required":false,"max_length":10,"example":"01"},{"key":"account_number","required":true,"pattern":"^[A-Z0-9]{10,24}$","max_length":24,"example":"0012345678901234"}]'::jsonb,
   'Fildişi Sahili banka havalesi (şube + hesap no).'),
  ('CI', 'wallet_transfer', 'wallet', 'XOF', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["orange","mtn","wave"],"example":"wave"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{8,15}$","max_length":15,"example":"+2250700000000"}]'::jsonb,
   'Orange Money / MTN MoMo / Wave numarası.'),
  ('SN', 'bank_transfer', 'local_account', 'XOF', true, true,
   '[{"key":"rib","required":true,"pattern":"^[A-Z0-9]{20,24}$","max_length":24,"example":"0100100000123456789012"}]'::jsonb,
   'Senegal RIB (24 karakter).'),
  ('SN', 'wallet_transfer', 'wallet', 'XOF', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["orange","wave","free"],"example":"wave"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{8,15}$","max_length":15,"example":"+221770000000"}]'::jsonb,
   'Orange Money / Wave / Free Money numarası.'),
  ('CM', 'bank_transfer', 'local_account', 'XAF', true, true,
   '[{"key":"agency","required":false,"max_length":10,"example":"001"},{"key":"account_number","required":true,"pattern":"^[0-9]{11,23}$","max_length":23,"numeric":true,"example":"10001234567890"}]'::jsonb,
   'Kamerun banka havalesi (şube + hesap no).'),
  ('CM', 'wallet_transfer', 'wallet', 'XAF', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["mtn","orange"],"example":"mtn"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{8,15}$","max_length":15,"example":"+237670000000"}]'::jsonb,
   'MTN MoMo / Orange Money numarası.'),
  ('TZ', 'bank_transfer', 'local_account', 'TZS', true, true,
   '[{"key":"branch_code","required":false,"max_length":10,"example":"001"},{"key":"account_number","required":true,"pattern":"^[0-9]{10,16}$","max_length":16,"numeric":true,"example":"0123456789012"}]'::jsonb,
   'Tanzanya banka havalesi (şube + hesap no).'),
  ('TZ', 'wallet_transfer', 'wallet', 'TZS', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["mpesa","tigopesa","airtel","halopesa"],"example":"mpesa"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{9,15}$","max_length":15,"example":"+255754000000"}]'::jsonb,
   'M-Pesa / Tigo Pesa / Airtel Money / HaloPesa numarası.'),
  ('UG', 'bank_transfer', 'local_account', 'UGX', true, true,
   '[{"key":"branch_code","required":false,"max_length":10,"example":"001"},{"key":"account_number","required":true,"pattern":"^[0-9]{10,16}$","max_length":16,"numeric":true,"example":"0123456789012"}]'::jsonb,
   'Uganda banka havalesi (şube + hesap no).'),
  ('UG', 'wallet_transfer', 'wallet', 'UGX', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["mtn","airtel"],"example":"mtn"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{9,15}$","max_length":15,"example":"+256770000000"}]'::jsonb,
   'MTN MoMo / Airtel Money numarası.'),
  ('ET', 'bank_transfer', 'local_account', 'ETB', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{13}$","max_length":13,"numeric":true,"example":"1000123456789"}]'::jsonb,
   'Etiyopya banka havalesi (13 haneli hesap no).'),
  ('ET', 'wallet_transfer', 'wallet', 'ETB', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["telebirr"],"example":"telebirr"},{"key":"wallet_number","required":true,"pattern":"^[0-9+]{9,15}$","max_length":15,"example":"+251910000000"}]'::jsonb,
   'Telebirr numarası.'),

  -- -------------------------- Güney Amerika --------------------------------
  ('BO', 'bank_transfer', 'local_account', 'BOB', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,16}$","max_length":16,"numeric":true,"example":"1234567890"}]'::jsonb,
   'Bolivya banka havalesi (hesap no).'),
  ('PY', 'bank_transfer', 'local_account', 'PYG', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,12}$","max_length":12,"numeric":true,"example":"1234567890"}]'::jsonb,
   'Paraguay banka havalesi (hesap no).'),
  ('UY', 'bank_transfer', 'local_account', 'UYU', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{11,14}$","max_length":14,"numeric":true,"example":"123456789012"}]'::jsonb,
   'Uruguay banka havalesi (hesap no).'),
  ('DO', 'bank_transfer', 'local_account', 'DOP', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,12}$","max_length":12,"numeric":true,"example":"1234567890"}]'::jsonb,
   'Dominik Cumhuriyeti banka havalesi (hesap no).'),
  ('GT', 'bank_transfer', 'local_account', 'GTQ', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,14}$","max_length":14,"numeric":true,"example":"1234567890"}]'::jsonb,
   'Guatemala banka havalesi (hesap no).'),
  ('CR', 'bank_transfer', 'iban', 'CRC', true, false,
   '[{"key":"iban","required":true,"example":"CR05 0152 0000 0001 2345 67"}]'::jsonb,
   'IBAN havalesi (CRC).'),
  ('PA', 'bank_transfer', 'local_account', 'PAB', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,20}$","max_length":20,"numeric":true,"example":"0123456789"}]'::jsonb,
   'Panama banka havalesi (hesap no).'),
  ('EC', 'bank_transfer', 'local_account', 'USD', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,12}$","max_length":12,"numeric":true,"example":"1234567890"}]'::jsonb,
   'Ekvador banka havalesi (hesap no).'),

  -- ------------------------------ Asya -------------------------------------
  ('MM', 'bank_transfer', 'local_account', 'MMK', true, true,
   '[{"key":"branch_code","required":false,"max_length":10,"example":"001"},{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true,"example":"0123456789"}]'::jsonb,
   'Myanmar banka havalesi (şube + hesap no).'),
  ('KH', 'bank_transfer', 'local_account', 'KHR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{8,20}$","max_length":20,"numeric":true,"example":"012345678"}]'::jsonb,
   'Kamboçya banka havalesi (hesap no).')
) as s(
  country_code, method, scheme, currency, bank_name_required, is_enabled, fields, note
)
on conflict (country_code, method) do update set
  provider = excluded.provider,
  currency = excluded.currency,
  is_enabled = excluded.is_enabled,
  requirements = excluded.requirements,
  note = excluded.note,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) Ülke kuralları (para birimi + IBAN uzunluğu)
-- ---------------------------------------------------------------------------
insert into public.country_payout_rules
  (country_code, currency, iban_length, iban_example, account_min_length, account_max_length, note)
values
  ('GB', 'GBP', 22, 'GB29NWBK60161331926819', 8, 8,
   'Sort code 6 hane, hesap numarası 8 hane.'),
  ('US', 'USD', null, null, 4, 17, 'ACH: 9 haneli routing numarası + hesap numarası.'),
  ('IN', 'INR', null, null, 9, 18, 'IFSC + hesap numarası veya UPI kimliği.'),
  ('ID', 'IDR', null, null, 10, 16, null),
  ('IL', 'ILS', 23, 'IL620108000000099999999', 6, 9, null),
  ('FI', 'EUR', 18, 'FI2112345600000785', null, null, null),
  ('IT', 'EUR', 27, 'IT60X0542811101000000123456', null, null, null),
  ('IE', 'EUR', 22, 'IE29AIBK93115212345678', null, null, null),
  ('SG', 'SGD', null, null, 9, 12, 'Banka kodu + şube kodu + hesap no.'),
  ('HK', 'HKD', null, null, 6, 9, 'Banka kodu + şube kodu + hesap no.'),
  ('CN', 'CNY', null, null, 12, 19, 'CNAPS kodu + hesap no.'),
  ('JO', 'JOD', 30, 'JO94CBJO0010000000000131000302', null, null, null),
  ('BH', 'BHD', 22, 'BH67BMAG00001234567890', null, null, null),
  ('OM', 'OMR', 23, 'OM8100000000000000000000', null, null, null),
  ('EE', 'EUR', 20, 'EE382200221020145685', null, null, null),
  ('LT', 'EUR', 20, 'LT121000011101001000', null, null, null),
  ('LV', 'EUR', 21, 'LV80BANK0000435195001', null, null, null),
  ('SK', 'EUR', 24, 'SK3112000000198742637541', null, null, null),
  ('SI', 'EUR', 19, 'SI56263300012039086', null, null, null),
  ('LU', 'EUR', 20, 'LU280019400644750000', null, null, null),
  ('MT', 'EUR', 31, 'MT84MALT011000012345MTLCAST001S', null, null, null),
  ('CY', 'EUR', 28, 'CY17002001280000001200527600', null, null, null),
  ('IS', 'ISK', 26, 'IS140159260076545510730339', null, null, null),
  ('CI', 'XOF', null, null, 10, 24, 'Şube kodu + hesap numarası.'),
  ('SN', 'XOF', null, null, 20, 24, 'RIB 24 karakter.'),
  ('CM', 'XAF', null, null, 11, 23, 'Şube kodu + hesap numarası.'),
  ('TZ', 'TZS', null, null, 10, 16, null),
  ('UG', 'UGX', null, null, 10, 16, null),
  ('ET', 'ETB', null, null, 13, 13, '13 haneli hesap numarası.'),
  ('BO', 'BOB', null, null, 10, 16, null),
  ('PY', 'PYG', null, null, 6, 12, null),
  ('UY', 'UYU', null, null, 11, 14, null),
  ('DO', 'DOP', null, null, 10, 12, null),
  ('GT', 'GTQ', null, null, 10, 14, null),
  ('CR', 'CRC', 22, 'CR05015200000001234567', null, null, null),
  ('PA', 'PAB', null, null, 10, 20, null),
  ('EC', 'USD', null, null, 10, 12, null),
  ('MM', 'MMK', null, null, 6, 20, null),
  ('KH', 'KHR', null, null, 8, 20, null)
on conflict (country_code) do update set
  currency = excluded.currency,
  iban_length = excluded.iban_length,
  iban_example = excluded.iban_example,
  account_min_length = coalesce(excluded.account_min_length, country_payout_rules.account_min_length),
  account_max_length = coalesce(excluded.account_max_length, country_payout_rules.account_max_length),
  note = coalesce(excluded.note, country_payout_rules.note),
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) Banka / cüzdan rehberi
-- ---------------------------------------------------------------------------
insert into public.country_bank_directory
  (country_code, code, name, short_name, kind, sort_order)
values
  -- Birleşik Krallık
  ('GB','barclays','Barclays','Barclays','bank',10),
  ('GB','hsbcuk','HSBC UK','HSBC UK','bank',20),
  ('GB','lloyds','Lloyds Bank','Lloyds','bank',30),
  ('GB','natwest','NatWest','NatWest','bank',40),
  ('GB','santanderuk','Santander UK','Santander UK','bank',50),
  ('GB','halifax','Halifax','Halifax','bank',60),
  ('GB','nationwide','Nationwide Building Society','Nationwide','bank',70),
  ('GB','tsb','TSB Bank','TSB','bank',80),
  ('GB','monzo','Monzo','Monzo','bank',90),
  ('GB','starling','Starling Bank','Starling','bank',100),
  ('GB','revolut','Revolut','Revolut','bank',110),
  ('GB','metro','Metro Bank','Metro','bank',120),
  ('GB','coop','The Co-operative Bank','Co-op Bank','bank',130),
  ('GB','virginmoney','Virgin Money','Virgin Money','bank',140),
  ('GB','firstdirect','first direct','first direct','bank',150),
  ('GB','wise','Wise','Wise','wallet',200),
  ('GB','paypal','PayPal','PayPal','wallet',210),

  -- Amerika Birleşik Devletleri
  ('US','chase','JPMorgan Chase','Chase','bank',10),
  ('US','bofa','Bank of America','BofA','bank',20),
  ('US','wellsfargo','Wells Fargo','Wells Fargo','bank',30),
  ('US','citi','Citibank','Citi','bank',40),
  ('US','usbank','U.S. Bank','U.S. Bank','bank',50),
  ('US','pnc','PNC Bank','PNC','bank',60),
  ('US','capitalone','Capital One','Capital One','bank',70),
  ('US','td','TD Bank','TD Bank','bank',80),
  ('US','truist','Truist Bank','Truist','bank',90),
  ('US','ally','Ally Bank','Ally','bank',100),
  ('US','schwab','Charles Schwab Bank','Schwab','bank',110),
  ('US','marcus','Goldman Sachs (Marcus)','Marcus','bank',120),
  ('US','sofi','SoFi Bank','SoFi','bank',130),
  ('US','chime','Chime','Chime','bank',140),
  ('US','wise','Wise','Wise','wallet',200),
  ('US','paypal','PayPal','PayPal','wallet',210),
  ('US','cashapp','Cash App','Cash App','wallet',220),

  -- İtalya
  ('IT','intesa','Intesa Sanpaolo','Intesa','bank',10),
  ('IT','unicredit','UniCredit','UniCredit','bank',20),
  ('IT','bpm','Banco BPM','BPM','bank',30),
  ('IT','bper','BPER Banca','BPER','bank',40),
  ('IT','mps','Banca Monte dei Paschi di Siena','MPS','bank',50),
  ('IT','creditagricole','Crédit Agricole Italia','Crédit Agricole','bank',60),
  ('IT','poste','Poste Italiane (BancoPosta)','BancoPosta','bank',70),
  ('IT','mediolanum','Banca Mediolanum','Mediolanum','bank',80),
  ('IT','fineco','FinecoBank','Fineco','bank',90),
  ('IT','revolut','Revolut Bank','Revolut','bank',100),

  -- İrlanda
  ('IE','aib','Allied Irish Banks (AIB)','AIB','bank',10),
  ('IE','boi','Bank of Ireland','Bank of Ireland','bank',20),
  ('IE','ptsb','Permanent TSB','PTSB','bank',30),
  ('IE','avant','Avant Money','Avant','bank',40),
  ('IE','ebs','EBS d.a.c.','EBS','bank',50),
  ('IE','revolut','Revolut Bank','Revolut','bank',60),

  -- Hindistan
  ('IN','sbi','State Bank of India','SBI','bank',10),
  ('IN','hdfc','HDFC Bank','HDFC','bank',20),
  ('IN','icici','ICICI Bank','ICICI','bank',30),
  ('IN','axis','Axis Bank','Axis','bank',40),
  ('IN','kotak','Kotak Mahindra Bank','Kotak','bank',50),
  ('IN','pnb','Punjab National Bank','PNB','bank',60),
  ('IN','bob','Bank of Baroda','BoB','bank',70),
  ('IN','canara','Canara Bank','Canara','bank',80),
  ('IN','idfc','IDFC FIRST Bank','IDFC FIRST','bank',90),
  ('IN','yes','Yes Bank','Yes Bank','bank',100),
  ('IN','paytm','Paytm','Paytm','wallet',200),
  ('IN','phonepe','PhonePe','PhonePe','wallet',210),
  ('IN','gpay','Google Pay (UPI)','Google Pay','wallet',220),
  ('IN','amazonpay','Amazon Pay (UPI)','Amazon Pay','wallet',230),

  -- Endonezya
  ('ID','bca','Bank Central Asia (BCA)','BCA','bank',10),
  ('ID','mandiri','Bank Mandiri','Mandiri','bank',20),
  ('ID','bni','Bank Negara Indonesia (BNI)','BNI','bank',30),
  ('ID','bri','Bank Rakyat Indonesia (BRI)','BRI','bank',40),
  ('ID','cimb','CIMB Niaga','CIMB Niaga','bank',50),
  ('ID','permata','Permata Bank','Permata','bank',60),
  ('ID','danamon','Bank Danamon','Danamon','bank',70),
  ('ID','btn','Bank Tabungan Negara (BTN)','BTN','bank',80),
  ('ID','ocbc','OCBC NISP','OCBC','bank',90),
  ('ID','gopay','GoPay','GoPay','wallet',200),
  ('ID','ovo','OVO','OVO','wallet',210),
  ('ID','dana','DANA','DANA','wallet',220),
  ('ID','shopeepay','ShopeePay','ShopeePay','wallet',230),

  -- İsrail
  ('IL','leumi','Bank Leumi','Leumi','bank',10),
  ('IL','poalim','Bank Hapoalim','Hapoalim','bank',20),
  ('IL','discount','Israel Discount Bank','Discount','bank',30),
  ('IL','mizrahi','Mizrahi Tefahot Bank','Mizrahi','bank',40),
  ('IL','fibi','First International Bank of Israel','FIBI','bank',50),
  ('IL','bit','Bit','Bit','wallet',200),
  ('IL','paybox','PayBox','PayBox','wallet',210),

  -- Finlandiya
  ('FI','op','OP Ryhmä','OP','bank',10),
  ('FI','nordea','Nordea','Nordea','bank',20),
  ('FI','danske','Danske Bank','Danske','bank',30),
  ('FI','sp','Säästöpankki','Säästöpankki','bank',40),
  ('FI','spankki','S-Pankki','S-Pankki','bank',50),
  ('FI','aktia','Aktia Bank','Aktia','bank',60),
  ('FI','mobilepay','MobilePay','MobilePay','wallet',200),

  -- Singapur
  ('SG','dbs','DBS Bank','DBS','bank',10),
  ('SG','ocbc','OCBC Bank','OCBC','bank',20),
  ('SG','uob','United Overseas Bank (UOB)','UOB','bank',30),
  ('SG','hsbc','HSBC Singapore','HSBC','bank',40),
  ('SG','citi','Citibank Singapore','Citi','bank',50),
  ('SG','maybank','Maybank Singapore','Maybank','bank',60),
  ('SG','sc','Standard Chartered Singapore','StanChart','bank',70),
  ('SG','paynow','PayNow','PayNow','wallet',200),
  ('SG','grabpay','GrabPay','GrabPay','wallet',210),

  -- Hong Kong
  ('HK','hsbc','HSBC Hong Kong','HSBC','bank',10),
  ('HK','hang','Hang Seng Bank','Hang Seng','bank',20),
  ('HK','bochk','Bank of China (Hong Kong)','BOCHK','bank',30),
  ('HK','sc','Standard Chartered Hong Kong','StanChart','bank',40),
  ('HK','citi','Citibank Hong Kong','Citi','bank',50),
  ('HK','dbs','DBS Hong Kong','DBS','bank',60),
  ('HK','fps','FPS','FPS','wallet',200),

  -- Çin
  ('CN','icbc','Industrial and Commercial Bank of China (ICBC)','ICBC','bank',10),
  ('CN','ccb','China Construction Bank','CCB','bank',20),
  ('CN','abc','Agricultural Bank of China','ABC','bank',30),
  ('CN','boc','Bank of China','BOC','bank',40),
  ('CN','bocom','Bank of Communications','BoCom','bank',50),
  ('CN','cmb','China Merchants Bank','CMB','bank',60),
  ('CN','alipay','Alipay','Alipay','wallet',200),
  ('CN','wechat','WeChat Pay','WeChat Pay','wallet',210),

  -- Ürdün
  ('JO','arabbank','Arab Bank','Arab Bank','bank',10),
  ('JO','housing','Housing Bank for Trade and Finance','Housing Bank','bank',20),
  ('JO','jordanahli','Jordan Ahli Bank','Ahli Bank','bank',30),
  ('JO','cairoamman','Cairo Amman Bank','Cairo Amman','bank',40),
  ('JO','bankofjordan','Bank of Jordan','Bank of Jordan','bank',50),

  -- Bahreyn
  ('BH','nbb','National Bank of Bahrain','NBB','bank',10),
  ('BH','bbk','Bank of Bahrain and Kuwait (BBK)','BBK','bank',20),
  ('BH','bisb','Bahrain Islamic Bank','BisB','bank',30),
  ('BH','ahli','Ahli United Bank','AUB','bank',40),
  ('BH','beyon','Beyon Money','Beyon','wallet',200),
  ('BH','benefitpay','BenefitPay','BenefitPay','wallet',210),

  -- Umman
  ('OM','bankmuscat','Bank Muscat','Bank Muscat','bank',10),
  ('OM','nbo','National Bank of Oman','NBO','bank',20),
  ('OM','hsbc','HSBC Oman','HSBC Oman','bank',30),
  ('OM','bankdhofar','Bank Dhofar','Dhofar','bank',40),
  ('OM','thawani','Thawani Pay','Thawani','wallet',200),

  -- Estonya
  ('EE','swedbank','Swedbank','Swedbank','bank',10),
  ('EE','seb','SEB Pank','SEB','bank',20),
  ('EE','lhv','LHV Pank','LHV','bank',30),
  ('EE','luminor','Luminor Bank','Luminor','bank',40),
  ('EE','coop','Coop Pank','Coop','bank',50),

  -- Litvanya
  ('LT','swedbank','Swedbank','Swedbank','bank',10),
  ('LT','seb','SEB Bankas','SEB','bank',20),
  ('LT','luminor','Luminor Bank','Luminor','bank',30),
  ('LT','revolut','Revolut Bank','Revolut','bank',40),
  ('LT','paysera','Paysera','Paysera','wallet',200),

  -- Letonya
  ('LV','swedbank','Swedbank','Swedbank','bank',10),
  ('LV','seb','SEB Banka','SEB','bank',20),
  ('LV','luminor','Luminor Bank','Luminor','bank',30),
  ('LV','citadele','Citadele Banka','Citadele','bank',40),
  ('LV','riietumu','Rietumu Banka','Rietumu','bank',50),

  -- Slovakya
  ('SK','slovenska','Slovenská sporiteľňa','SLSP','bank',10),
  ('SK','vub','VÚB Banka','VÚB','bank',20),
  ('SK','tatrabanka','Tatra banka','Tatra banka','bank',30),
  ('SK','csas','ČSOB','ČSOB','bank',40),
  ('SK','postova','Poštová banka','Poštová','bank',50),

  -- Slovenya
  ('SI','nlb','NLB Banka','NLB','bank',10),
  ('SI','nkbm','NKBM Banka','NKBM','bank',20),
  ('SI','unicredit','UniCredit Banka Slovenija','UniCredit','bank',30),
  ('SI','sparkasse','Sparkasse Slovenija','Sparkasse','bank',40),

  -- Lüksemburg
  ('LU','bcee','Banque et Caisse d''Épargne de l''État','BCEE','bank',10),
  ('LU','bgl','BGL BNP Paribas','BGL','bank',20),
  ('LU','bil','Banque Internationale à Luxembourg (BIL)','BIL','bank',30),
  ('LU','raiffeisen','Banque Raiffeisen','Raiffeisen','bank',40),

  -- Malta
  ('MT','bov','Bank of Valletta','BOV','bank',10),
  ('MT','hsbc','HSBC Malta','HSBC Malta','bank',20),
  ('MT','aps','APS Bank','APS','bank',30),
  ('MT','meusac','MeDirect Bank','MeDirect','bank',40),

  -- Kıbrıs
  ('CY','boc','Bank of Cyprus','BoC','bank',10),
  ('CY','hellenic','Hellenic Bank','Hellenic','bank',20),
  ('CY','rcb','RCB Bank','RCB','bank',30),
  ('CY','astric','AstroBank','AstroBank','bank',40),

  -- İzlanda
  ('IS','landsbankinn','Landsbankinn','Landsbankinn','bank',10),
  ('IS','islandsbanki','Íslandsbanki','Íslandsbanki','bank',20),
  ('IS','arion','Arion banki','Arion','bank',30),
  ('IS','kvika','Kvika banki','Kvika','bank',40),

  -- Fildişi Sahili
  ('CI','sgci','Société Générale Côte d''Ivoire','SGCI','bank',10),
  ('CI','ecobank','Ecobank Côte d''Ivoire','Ecobank','bank',20),
  ('CI','boaci','Bank of Africa Côte d''Ivoire','BOA CI','bank',30),
  ('CI','nsia','NSIA Banque','NSIA','bank',40),
  ('CI','coris','Coris Bank International','Coris','bank',50),
  ('CI','orange','Orange Money','Orange Money','wallet',200),
  ('CI','mtn','MTN MoMo','MTN MoMo','wallet',210),
  ('CI','wave','Wave','Wave','wallet',220),

  -- Senegal
  ('SN','cbao','CBAO Banque','CBAO','bank',10),
  ('SN','ecobank','Ecobank Sénégal','Ecobank','bank',20),
  ('SN','sgb','Société Générale Sénégal','SGBS','bank',30),
  ('SN','bicis','BICIS','BICIS','bank',40),
  ('SN','orange','Orange Money','Orange Money','wallet',200),
  ('SN','wave','Wave','Wave','wallet',210),
  ('SN','free','Free Money','Free Money','wallet',220),

  -- Kamerun
  ('CM','afriland','Afriland First Bank','Afriland','bank',10),
  ('CM','sgbc','Société Générale Cameroun','SGC','bank',20),
  ('CM','ecobank','Ecobank Cameroun','Ecobank','bank',30),
  ('CM','uba','United Bank for Africa (UBA)','UBA','bank',40),
  ('CM','mtn','MTN MoMo','MTN MoMo','wallet',200),
  ('CM','orange','Orange Money','Orange Money','wallet',210),

  -- Tanzanya
  ('TZ','crdb','CRDB Bank','CRDB','bank',10),
  ('TZ','nmb','NMB Bank','NMB','bank',20),
  ('TZ','nbc','National Bank of Commerce (NBC)','NBC','bank',30),
  ('TZ','stanbic','Stanbic Bank Tanzania','Stanbic','bank',40),
  ('TZ','equity','Equity Bank Tanzania','Equity','bank',50),
  ('TZ','mpesa','M-Pesa','M-Pesa','wallet',200),
  ('TZ','tigopesa','Tigo Pesa','Tigo Pesa','wallet',210),
  ('TZ','airtel','Airtel Money','Airtel Money','wallet',220),
  ('TZ','halopesa','HaloPesa','HaloPesa','wallet',230),

  -- Uganda
  ('UG','stanbic','Stanbic Bank Uganda','Stanbic','bank',10),
  ('UG','centenary','Centenary Bank','Centenary','bank',20),
  ('UG','dfcu','DFCU Bank','DFCU','bank',30),
  ('UG','equity','Equity Bank Uganda','Equity','bank',40),
  ('UG','mtn','MTN MoMo','MTN MoMo','wallet',200),
  ('UG','airtel','Airtel Money','Airtel Money','wallet',210),

  -- Etiyopya
  ('ET','cbe','Commercial Bank of Ethiopia','CBE','bank',10),
  ('ET','awash','Awash Bank','Awash','bank',20),
  ('ET','dashen','Dashen Bank','Dashen','bank',30),
  ('ET','abyssinia','Bank of Abyssinia','Abyssinia','bank',40),
  ('ET','telebirr','Telebirr','Telebirr','wallet',200),

  -- Bolivya
  ('BO','bancounion','Banco Unión','Unión','bank',10),
  ('BO','bnb','Banco Nacional de Bolivia (BNB)','BNB','bank',20),
  ('BO','bmsc','Banco Mercantil Santa Cruz','BMSC','bank',30),
  ('BO','bcp','Banco de Crédito BCP','BCP','bank',40),
  ('BO','ganadero','Banco Ganadero','Ganadero','bank',50),

  -- Paraguay
  ('PY','continental','Banco Continental','Continental','bank',10),
  ('PY','itau','Banco Itaú Paraguay','Itaú','bank',20),
  ('PY','familiar','Banco Familiar','Familiar','bank',30),
  ('PY','ueno','Ueno Bank','Ueno','bank',40),
  ('PY','sudameris','Banco Sudameris','Sudameris','bank',50),

  -- Uruguay
  ('UY','brou','Banco República (BROU)','BROU','bank',10),
  ('UY','itau','Itaú Uruguay','Itaú','bank',20),
  ('UY','santander','Santander Uruguay','Santander','bank',30),
  ('UY','bbva','BBVA Uruguay','BBVA','bank',40),
  ('UY','scotiabank','Scotiabank Uruguay','Scotiabank','bank',50),

  -- Dominik Cumhuriyeti
  ('DO','banreservas','Banreservas','Banreservas','bank',10),
  ('DO','popular','Banco Popular Dominicano','Popular','bank',20),
  ('DO','bhd','Banco BHD','BHD','bank',30),
  ('DO','scotiabank','Scotiabank República Dominicana','Scotiabank','bank',40),
  ('DO','santacruz','Banco Santa Cruz','Santa Cruz','bank',50),

  -- Guatemala
  ('GT','banrural','Banco de Desarrollo Rural (Banrural)','Banrural','bank',10),
  ('GT','bi','Banco Industrial','BI','bank',20),
  ('GT','bac','BAC Guatemala','BAC','bank',30),
  ('GT','gyt','Banco G&T Continental','G&T','bank',40),
  ('GT','promerica','Banco Promerica','Promerica','bank',50),

  -- Kosta Rika
  ('CR','bncr','Banco Nacional de Costa Rica','BNCR','bank',10),
  ('CR','bcr','Banco de Costa Rica','BCR','bank',20),
  ('CR','bac','BAC Costa Rica','BAC','bank',30),
  ('CR','davivienda','Davivienda Costa Rica','Davivienda','bank',40),

  -- Panama
  ('PA','general','Banco General','Banco General','bank',10),
  ('PA','banistmo','Banistmo','Banistmo','bank',20),
  ('PA','global','Global Bank','Global Bank','bank',30),
  ('PA','bac','BAC Panamá','BAC','bank',40),

  -- Ekvador
  ('EC','pichincha','Banco Pichincha','Pichincha','bank',10),
  ('EC','guayaquil','Banco Guayaquil','Guayaquil','bank',20),
  ('EC','produbanco','Produbanco','Produbanco','bank',30),
  ('EC','pacifico','Banco del Pacífico','Pacífico','bank',40),
  ('EC','bolivariano','Banco Bolivariano','Bolivariano','bank',50),

  -- Myanmar
  ('MM','kbz','KBZ Bank','KBZ','bank',10),
  ('MM','aya','AYA Bank','AYA','bank',20),
  ('MM','cb','CB Bank','CB','bank',30),
  ('MM','uab','UAB Bank','UAB','bank',40),
  ('MM','kbzpay','KBZPay','KBZPay','wallet',200),
  ('MM','wavepay','WavePay','WavePay','wallet',210),

  -- Kamboçya
  ('KH','acleda','ACLEDA Bank','ACLEDA','bank',10),
  ('KH','canadia','Canadia Bank','Canadia','bank',20),
  ('KH','aba','ABA Bank','ABA','bank',30),
  ('KH','wing','Wing Bank','Wing','bank',40),
  ('KH','abapay','ABA Pay','ABA Pay','wallet',200)
on conflict (country_code, code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
