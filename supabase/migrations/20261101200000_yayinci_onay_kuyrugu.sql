-- ===========================================================================
-- Yayıncı ödeme onay kuyruğu — admin panelinde görünürlük
-- ===========================================================================
-- Sorun:
--   Ödeme profili   (creator_payout_profiles.status = 'submitted')
--   Vergi/şirket belgesi (creator_payout_documents.status = 'submitted')
--   Banka talimatı  (creator_payout_accounts.status = 'pending_verification')
--   kayıtları onay bekliyordu ama admin panelinde bunları LİSTELEYEN bir uç
--   yoktu. Yönetici ancak kullanıcı kimliğini bilip tek tek detay ekranına
--   girerse görebiliyordu. Dahası `admin_yayinci_listesi` kazanç kayıtlarına
--   INNER JOIN yaptığı için henüz kazancı olmayan yeni yayıncı o listede hiç
--   görünmüyordu; bu yüzden yeni ödeme profilleri panele "düşmüyordu".
--
-- Bu migration yalnızca OKUMA uçları ekler. Durum geçişleri mevcut,
-- denetim kaydı yazan RPC'lerde kalır:
--   profil  → public.admin_yayinci_odeme_profili_karar(uuid, text, text)
--   belge   → public.admin_yayinci_odeme_belgesi_karar(uuid, text, text)
--   hesap   → public.admin_odeme_hesabi_dogrula(uuid, text, text)
-- Yetki: finance.view (admin_has_permission).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Kuyruk sorguları için indeksler
-- ---------------------------------------------------------------------------
create index if not exists creator_payout_profiles_status_idx
  on public.creator_payout_profiles (status, submitted_at desc);

create index if not exists creator_payout_documents_status_idx
  on public.creator_payout_documents (status, created_at desc);

create index if not exists creator_payout_accounts_status_idx
  on public.creator_payout_accounts (status, last_changed_at desc);

-- ---------------------------------------------------------------------------
-- 2) Sayaçlar — panel üstü uyarı balonları ve sekme rozetleri
-- ---------------------------------------------------------------------------
create or replace function public.admin_yayinci_onay_sayilari()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_profil int := 0;
  v_belge int := 0;
  v_hesap int := 0;
  v_kazanc int := 0;
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;

  select count(*) into v_profil
    from public.creator_payout_profiles
   where status = 'submitted';

  select count(*) into v_belge
    from public.creator_payout_documents
   where status = 'submitted';

  select count(*) into v_hesap
    from public.creator_payout_accounts
   where status = 'pending_verification';

  -- Bekleyen Gelirler ekranıyla aynı küme.
  select count(*) into v_kazanc
    from public.creator_earning_entries e
   where public.yayinci_kazanc_durumu(e) in ('pending', 'on_hold', 'available', 'in_payout');

  return jsonb_build_object(
    'profil', v_profil,
    'belge', v_belge,
    'hesap', v_hesap,
    'kazanc', v_kazanc,
    'onay_bekleyen_toplam', v_profil + v_belge + v_hesap
  );
end;
$$;

comment on function public.admin_yayinci_onay_sayilari() is
  'Onay bekleyen yayıncı ödeme profili / belgesi / banka talimatı ve kazanç sayıları.';

-- ---------------------------------------------------------------------------
-- 3) Birleşik onay kuyruğu
--    p_tur: null | 'profil' | 'belge' | 'hesap'
-- ---------------------------------------------------------------------------
create or replace function public.admin_yayinci_onay_kuyrugu(
  p_tur text default null,
  p_limit int default 150
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_tur text := lower(nullif(btrim(coalesce(p_tur, '')), ''));
  v_limit int := least(greatest(coalesce(p_limit, 150), 1), 400);
  v_items jsonb;
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;
  if v_tur in ('', 'all', 'tumu', 'tümü') then
    v_tur := null;
  end if;
  if v_tur is not null and v_tur not in ('profil', 'belge', 'hesap') then
    raise exception 'invalid_kind';
  end if;

  with kuyruk as (
    -- 3.a) Ödeme profili onayı
    select
      'profil'::text as tur,
      pr.user_id as user_id,
      pr.user_id as kayit_id,
      coalesce(p.display_name, p.username, pr.user_id::text)::text as ad,
      p.username::text as kullanici_adi,
      pr.country_code as ulke,
      pr.status as durum,
      coalesce(pr.submitted_at, pr.updated_at) as gonderim,
      jsonb_build_object(
        'profil_id', pr.user_id,
        'ad', pr.legal_first_name,
        'soyad', pr.legal_last_name,
        'telefon_ulke', pr.phone_country_code,
        'telefon', pr.phone,
        'vergi_no', pr.tax_number,
        'vergi_dairesi', pr.tax_office,
        'sirket_var', pr.has_company,
        'sirket_adi', pr.company_name,
        'sirket_vergi_no', pr.company_tax_number,
        'sirket_ulke', pr.company_country_code,
        'eksikler', public.yayinci_odeme_profil_eksikleri(pr.user_id)
      ) as detay
    from public.creator_payout_profiles pr
    join public.profiles p on p.id = pr.user_id
    where pr.status = 'submitted'

    union all

    -- 3.b) Vergi / şirket belgesi onayı
    select
      'belge'::text,
      d.user_id,
      d.id,
      coalesce(p.display_name, p.username, d.user_id::text)::text,
      p.username::text,
      coalesce(pr.country_code, upper(coalesce(p.country_code, ''))),
      d.status,
      d.created_at,
      jsonb_build_object(
        'belge_id', d.id,
        'doc_type', d.doc_type,
        'version', d.version,
        'file_name', d.file_name,
        'mime', d.mime,
        'byte_size', d.byte_size,
        'profil_durumu', pr.status
      )
    from public.creator_payout_documents d
    join public.profiles p on p.id = d.user_id
    left join public.creator_payout_profiles pr on pr.user_id = d.user_id
    where d.status = 'submitted'

    union all

    -- 3.c) Banka / cüzdan talimatı doğrulaması
    select
      'hesap'::text,
      a.user_id,
      a.id,
      coalesce(p.display_name, p.username, a.user_id::text)::text,
      p.username::text,
      coalesce(a.country_code, upper(coalesce(p.country_code, ''))),
      a.status,
      coalesce(a.last_changed_at, a.updated_at),
      jsonb_build_object(
        'hesap_id', a.id,
        'method', a.method,
        'scheme', a.scheme,
        'currency', a.currency,
        'account_holder', a.account_holder,
        'bank_name', a.bank_name,
        'iban_masked', a.iban_masked,
        'details_masked', a.details_masked
      )
    from public.creator_payout_accounts a
    join public.profiles p on p.id = a.user_id
    where a.status = 'pending_verification'
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'tur', k.tur,
               'user_id', k.user_id,
               'kayit_id', k.kayit_id,
               'ad', k.ad,
               'kullanici_adi', k.kullanici_adi,
               'ulke', k.ulke,
               'durum', k.durum,
               'gonderim', k.gonderim,
               'detay', k.detay
             )
             order by k.gonderim desc nulls last, k.tur
           ),
           '[]'::jsonb
         )
    into v_items
    from (
      select *
        from kuyruk
       where v_tur is null or kuyruk.tur = v_tur
       order by gonderim desc nulls last
       limit v_limit
    ) k;

  return jsonb_build_object(
    'sayilar', public.admin_yayinci_onay_sayilari(),
    'items', v_items
  );
end;
$$;

comment on function public.admin_yayinci_onay_kuyrugu(text, int) is
  'Onay bekleyen ödeme profili, belge ve banka talimatlarını tek listede döndürür.';

-- ---------------------------------------------------------------------------
-- 4) İzinler
-- ---------------------------------------------------------------------------
revoke all on function public.admin_yayinci_onay_sayilari() from public, anon;
revoke all on function public.admin_yayinci_onay_kuyrugu(text, int) from public, anon;

grant execute on function public.admin_yayinci_onay_sayilari() to authenticated;
grant execute on function public.admin_yayinci_onay_kuyrugu(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Belge kararı profil durumunu tazeler
-- ---------------------------------------------------------------------------
-- Eski hâlde belge reddedilse bile profil 'submitted' kalıyordu: kuyrukta
-- "onay bekliyor" görünen ama eksik evrakı olan bir kayıt oluşuyordu.
-- Karar sonrası eksik listesi yeniden hesaplanır:
--   belge eksiği varsa    → profil 'incomplete' (kullanıcı yeniden yükler)
--   tüm belgeler tamamsa  → profil 'submitted'
-- Doğrulanmış ('verified') profil bu tazelemeden etkilenmez.
create or replace function public.admin_yayinci_odeme_belgesi_karar(
  p_document_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.creator_payout_documents%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;
  if v_status not in ('under_review', 'approved', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if v_status = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'note_required';
  end if;

  update public.creator_payout_documents
     set status = v_status,
         review_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_document_id
  returning * into v_row;

  if v_row.id is null then raise exception 'Not found'; end if;

  perform public.yayinci_odeme_profil_durum_yenile(v_row.user_id);

  begin
    perform public.bildirim_kuyruga_ekle(
      v_row.user_id, 'wallet',
      case when v_status = 'approved'
        then 'Ödeme belgeniz onaylandı'
        else 'Ödeme belgeniz güncellenmeli' end,
      case when v_status = 'approved'
        then 'Yayıncı ödeme evrakınız onaylandı.'
        else coalesce(left(p_note, 300), 'Ödeme evrakınız için yeni bir belge yükleyin.') end,
      '/cuzdan/yayinci-kazanclari/odeme-profili',
      jsonb_build_object('type', 'payout_document', 'document_id', v_row.id, 'status', v_status)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', v_row.status, 'version', v_row.version);
end;
$$;

revoke all on function public.admin_yayinci_odeme_belgesi_karar(uuid, text, text) from public, anon;
grant execute on function public.admin_yayinci_odeme_belgesi_karar(uuid, text, text) to authenticated;
