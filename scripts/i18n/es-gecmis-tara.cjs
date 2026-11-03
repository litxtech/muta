const { execSync } = require('child_process');
const revs = execSync('git log --format=%h -- src/i18n/locales/es.ts', {
  cwd: 'C:/Users/ilkse/muta',
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .slice(0, 40);
for (const r of revs) {
  let s = '';
  try {
    s = execSync(`git show ${r}:src/i18n/locales/es.ts`, {
      cwd: 'C:/Users/ilkse/muta',
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch {
    console.log(r, 'yok');
    continue;
  }
  const q = (s.match(/\?/g) || []).length;
  const nl = s.split('\n').length;
  console.log(r, 'satır', String(nl).padStart(6), 'soru', String(q).padStart(5), 'boyut', s.length);
}
