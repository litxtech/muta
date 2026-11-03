-- =============================================================================
-- Cüzdan / coin sayfası admin müdahalesi kaldırıldı.
--
-- Cüzdan ekranı artık uygulama içinde sabit (statik, premium) tasarımla çizilir.
-- Admin panelinden simge / tema / bölüm / metin / yayın değiştirme yolu yoktur.
-- Bu migration eski dinamik cüzdan UI altyapısını (RPC + tablolar + storage)
-- ve ilgili admin yetkisini temizler.
-- =============================================================================

-- 1) RPC'ler
drop function if exists public.admin_wallet_ui_audit(int);
drop function if exists public.admin_wallet_ui_surumler(int);
drop function if exists public.admin_wallet_ui_geri_al();
drop function if exists public.admin_wallet_ui_yayinla(text);
drop function if exists public.admin_wallet_ui_taslak_kaydet(jsonb, text);
drop function if exists public.admin_wallet_ui_taslak_getir();
drop function if exists public.wallet_ui_canli_getir();
drop function if exists public.wallet_ui_default_payload();

-- 2) Tablolar (canlı işaretçi önce silinir)
drop table if exists public.wallet_ui_live;
drop table if exists public.wallet_ui_audit_logs;
drop table if exists public.wallet_ui_versions;

-- 3) Admin varlık deposu (policy → obje → bucket)
--
-- Supabase storage şeması doğrudan silmeyi `storage.protect_delete` trigger'ı ile
-- engeller. Baket tamamen kaldırıldığı için bu migration kendi transaction'ında
-- korumayı bilinçli olarak açar (yalnızca bu oturum/transaction için geçerli).
drop policy if exists "wallet_ui_public_read" on storage.objects;
drop policy if exists "wallet_ui_admin_write" on storage.objects;
drop policy if exists "wallet_ui_admin_update" on storage.objects;
drop policy if exists "wallet_ui_admin_delete" on storage.objects;
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id = 'wallet-ui';
delete from storage.buckets where id = 'wallet-ui';

-- 4) Admin yetkisi / rol atamaları
delete from public.admin_role_permissions where permission_code = 'wallet.ui.manage';
delete from public.admin_user_permission_overrides where permission_key = 'wallet.ui.manage';
delete from public.admin_permission_catalog where permission_key = 'wallet.ui.manage';
