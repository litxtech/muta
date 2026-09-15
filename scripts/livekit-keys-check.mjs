/**
 * LiveKit key dogrulama + Supabase secrets set.
 * Usage: node scripts/livekit-keys-check.mjs
 * Optional: LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... node scripts/livekit-keys-check.mjs
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const fileEnv = loadEnvFile('.env.livekit.local');
const key = process.env.LIVEKIT_API_KEY || fileEnv.LIVEKIT_API_KEY;
const secret = process.env.LIVEKIT_API_SECRET || fileEnv.LIVEKIT_API_SECRET;
const url = process.env.LIVEKIT_URL || fileEnv.LIVEKIT_URL;

if (!key || !secret || !url) {
  console.error('Missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET');
  process.exit(1);
}

const host = url.replace('wss://', 'https://');
console.log('Project', host, 'key', key.slice(0, 8) + '…');

try {
  const svc = new RoomServiceClient(host, key, secret);
  const rooms = await svc.listRooms();
  console.log('OK listRooms', rooms.length);
} catch (e) {
  console.error('FAIL invalid API key for this project:', e.message || e);
  console.error(
    '\nLiveKit Cloud → Project Settings → Keys → Create new key\n' +
      'Then update .env.livekit.local and re-run:\n' +
      '  powershell -File scripts/livekit-deploy.ps1',
  );
  process.exit(2);
}

const at = new AccessToken(key, secret, { identity: 'diag', ttl: '2m' });
at.addGrant({
  roomJoin: true,
  room: 'diag',
  canPublish: true,
  canSubscribe: true,
});
const token = await at.toJwt();
const r = await fetch(`${host}/settings/regions`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('regions', r.status, (await r.text()).slice(0, 120));

if (process.argv.includes('--set-secrets')) {
  const r2 = spawnSync(
    'npx',
    [
      'dotenv',
      '-e',
      '.env.supabase.local',
      '--',
      'npx',
      'supabase',
      'secrets',
      'set',
      `LIVEKIT_URL=${url}`,
      `LIVEKIT_API_KEY=${key}`,
      `LIVEKIT_API_SECRET=${secret}`,
      '--project-ref',
      'vdkqrqtrftzhbtquzked',
    ],
    { stdio: 'inherit', shell: true },
  );
  process.exit(r2.status ?? 1);
}
