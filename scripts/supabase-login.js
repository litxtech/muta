/**
 * .env.supabase.local icindeki SUPABASE_ACCESS_TOKEN ile CLI login.
 * Cıplak `supabase ...` komutlarinin 401 vermesini onler.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env.supabase.local');

if (!fs.existsSync(envPath)) {
  console.error(
    'Eksik: .env.supabase.local\n' +
      'Dashboard → Account → Access Tokens ile token olustur,\n' +
      'dosyaya yaz: SUPABASE_ACCESS_TOKEN=sbp_...\n' +
      'Ornek: .env.supabase.example',
  );
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const match = raw.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m);
const token = match?.[1]?.trim().replace(/^["']|["']$/g, '');

if (!token || !token.startsWith('sbp_')) {
  console.error(
    '.env.supabase.local icinde gecerli SUPABASE_ACCESS_TOKEN yok (sbp_... olmali).',
  );
  process.exit(1);
}

process.env.SUPABASE_ACCESS_TOKEN = token;

const r = spawnSync(
  'npx',
  ['supabase', 'login', '--token', token],
  { stdio: 'inherit', shell: true, cwd: root, env: process.env },
);

if (r.status !== 0) {
  console.error(
    'Login basarisiz. Token suresi dolmus olabilir — Dashboard’dan yeni Access Token al.',
  );
  process.exit(r.status ?? 1);
}

console.log('Supabase CLI oturumu hazir. Ornekler:');
console.log('  npm run supabase:deploy');
console.log('  npm run supabase:db:push');
console.log('  npx supabase functions deploy --project-ref vdkqrqtrftzhbtquzked --use-api');
