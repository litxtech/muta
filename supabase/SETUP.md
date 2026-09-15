-- ============================================================
-- SUPABASE AUTH + SMTP KURULUM REHBERİ
-- Dashboard: https://supabase.com/dashboard/project/vdkqrqtrftzhbtquzked
-- ============================================================

-- ------------------------------------------------------------
-- 0) CLI 401 Unauthorized — DOGRU KULLANIM
-- ------------------------------------------------------------
-- Hata: unexpected ... 401 Unauthorized / SUPABASE_DB_PASSWORD
-- Sebep: `supabase` komutu Access Token olmadan calistirildi.
--
-- Tek seferlik oturum (token dosyadan):
--   npm run supabase:login
--
-- Sonra hep bunlari kullan (token otomatik yuklenir, Docker gerekmez):
--   npm run supabase:deploy
--   npm run supabase:db:push
--
-- PowerShell alternatif:
--   .\scripts\sb.ps1 login
--   .\scripts\sb.ps1 functions deploy
--   .\scripts\sb.ps1 db push
--
-- Token dosyasi: .env.supabase.local
--   SUPABASE_ACCESS_TOKEN=sbp_...
-- Ornek: .env.supabase.example
-- Token al: https://supabase.com/dashboard/account/tokens
--
-- YANLIS (401 verir):
--   supabase functions deploy
--   supabase db push
-- DOGRU:
--   npm run supabase:deploy
--   npm run supabase:db:push
--   (veya once npm run supabase:login, sonra --use-api ile)

-- 1) Authentication → Providers → Email
--    - Enable Email provider: ON
--    - Confirm email: ON (production için önerilir; dev'de kapatılabilir)
--    - Secure email change: ON

-- 2) Authentication → URL Configuration
--    Site URL (production web):  https://litxtech.com
--    Redirect URLs:
--      https://litxtech.com/**
--      https://litxtech.com/auth/callback
--      https://litxtech.com/reset-password
--      muta://auth/callback
--      muta://reset-password
--      muta-test://auth/callback
--      muta-test://reset-password
--      exp://127.0.0.1:8081/--/reset-password
--      exp://localhost:8081/--/reset-password

-- 3) Authentication → Emails → SMTP Settings
--    Custom SMTP: ON
--    Host / Port / User / Pass: kendi SMTP sağlayıcın
--      Örnekler: Resend, SendGrid, Amazon SES, Brevo, Mailgun
--    Sender email:  noreply@yourdomain.com
--    Sender name:   Muta
--    Minimum interval: 60s

-- 4) Authentication → Email Templates
--    Confirm signup, Magic Link, Reset Password, Change Email
--    Reset Password template içindeki {{ .ConfirmationURL }} linkini koru

-- 5) SQL
--    migrations/001_initial_schema.sql → SQL Editor'de çalıştır
--    seed/001_catalog.sql → SQL Editor'de çalıştır

-- 6) API Keys
--    Project Settings → API
--    Project URL + publishable/anon key → .env dosyasında
--    service_role key ASLA uygulamaya koyma

-- 7) Authentication → Providers → Apple (native iOS)
--    Enable Sign in with Apple: ON
--    Client IDs:
--      com.litxtech.muta
--      (Expo Go test: host.exp.Exponent ekle)
--    Secret Key: BOŞ bırak (yalnızca web OAuth için gerekir)
--    Allow users without an email: ON (önerilir)
--    Apple App ID: com.litxtech.muta
--      Sign in with Apple = ON, Push Notifications = ON

-- 8) iOS Push (Expo Push + Apple Developer bu hesap)
--    Device UDID: 00008150-001669683488401C
--    App ID com.litxtech.muta → Push Notifications ON
--    eas build --profile development-device --platform ios
--    Test: https://expo.dev/notifications

select 'SMTP ve Auth ayarlarını Dashboard üzerinden tamamla' as next_step;
