/**
 * Scan user-facing files for leftover Turkish UI string literals.
 * Excludes admin, oyunlar brand noise, node_modules.
 */
import fs from 'fs';
import path from 'path';

const ROOTS = ['app', 'src/moduller', 'src/components', 'src/ortak', 'src/banner'];
const SKIP_DIR = new Set([
  'admin',
  'oyunlar',
  'node_modules',
  '.git',
]);

const TR_RE =
  /['"`]([^'"`\n]{2,80}?(?:ç|ğ|ı|İ|ö|ş|ü|Ç|Ğ|Ö|Ş|Ü|Cüzdan|Ayarlar|Kaydet|İptal|Mesaj|Bildirim|Yüklen|Etkinlik|Ajans|Şehir|Takip|Hediye|Kullanıcı|Başlık|Gönder|Silindi|Vazgeç|Henüz|Lütfen|Hata|Başarı|Seçin|Düzenle)[^'"`\n]{0,60})['"`]/g;

const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) scan(p);
  }
}

function scan(file) {
  if (file.includes(`${path.sep}admin${path.sep}`)) return;
  if (file.includes(`${path.sep}oyunlar${path.sep}`)) return;
  const src = fs.readFileSync(file, 'utf8');
  // skip if mostly i18n locale files
  if (file.includes(`${path.sep}i18n${path.sep}locales${path.sep}`)) return;
  let m;
  TR_RE.lastIndex = 0;
  while ((m = TR_RE.exec(src))) {
    const text = m[1];
    // skip import paths / comments-ish
    if (text.includes('/') && text.includes('.')) continue;
    if (/^[\w./@-]+$/.test(text)) continue;
    const line = src.slice(0, m.index).split(/\n/).length;
    hits.push({ file: file.replace(/\\/g, '/'), line, text: text.slice(0, 100) });
  }
}

for (const r of ROOTS) walk(r);

// group by file
const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`TOTAL_HITS ${hits.length} FILES ${sorted.length}`);
for (const [f, list] of sorted.slice(0, 40)) {
  console.log(`\n${f} (${list.length})`);
  for (const h of list.slice(0, 5)) console.log(`  L${h.line}: ${h.text}`);
}
