-- ============================================================
-- SUPABASE AUTH + SMTP KURULUM REHBERİ
-- Dashboard: https://supabase.com/dashboard/project/vdkqrqtrftzhbtquzked
-- ============================================================

-- 1) Authentication → Providers → Email
--    - Enable Email provider: ON
--    - Confirm email: ON (production için önerilir; dev'de kapatılabilir)
--    - Secure email change: ON

-- 2) Authentication → URL Configuration
--    Site URL (dev):     muta://
--    Redirect URLs:
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
--    Client IDs (virgülle, hepsi App ID / bundle ID):
--      com.mutaq.muta,com.mutaq.muta.dev,com.mutaq.muta.test,host.exp.Exponent
--    Secret Key: BOŞ bırak (yalnızca web OAuth için gerekir)
--    Allow users without an email: ON (önerilir)
--    Callback URL: web OAuth kullanıyorsan Apple Services ID'ye kaydet
--      https://vdkqrqtrftzhbtquzked.supabase.co/auth/v1/callback
--    Apple Developer:
--      Identifiers → App ID com.mutaq.muta (+ .dev / .test)
--      Capability: Sign in with Apple = ON
--      (Native-only ise Services ID / .p8 secret gerekmez)

select 'SMTP ve Auth ayarlarını Dashboard üzerinden tamamla' as next_step;
