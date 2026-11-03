/* Çift kodlanmış (mojibake) karakterleri düzeltir: Ã§ -> ç vb. */
const fs = require('fs');
const Y = require('./locale-yardimcilari.cjs');

const MAP = {
  'Ã§': 'ç',
  'Ã£': 'ã',
  'Ã©': 'é',
  'Ã³': 'ó',
  'Ã¡': 'á',
  'Ã­': 'í',
  'Ãª': 'ê',
  'Ãµ': 'õ',
  'Ãº': 'ú',
  'Ã¢': 'â',
  'Ã´': 'ô',
  'Ã ': 'à',
  'Ã‡': 'Ç',
  'Ã¼': 'ü',
  'Ã±': 'ñ',
  'Ã—': '×',
  'Ã‰': 'É',
  'Ã“': 'Ó',
  'Â·': '·',
  'Âº': 'º',
  'Âª': 'ª',
  'Â«': '«',
  'Â»': '»',
  'â€¦': '…',
  'â€”': '—',
  'â€“': '–',
  'â€™': '’',
  'â€œ': '“',
  'â‰¥': '≥',
  'â‰¤': '≤',
  'â†’': '→',
  'âˆ’': '−',
  'Â€': '€',
};

for (const dosya of process.argv.slice(2)) {
  const yol = `src/i18n/locales/${dosya}`;
  let s = fs.readFileSync(yol, 'utf8');
  const once = s;
  let degisen = 0;
  for (const [bozuk, dogru] of Object.entries(MAP)) {
    const parca = s.split(bozuk).length - 1;
    if (parca) {
      degisen += parca;
      s = s.split(bozuk).join(dogru);
    }
  }
  if (s !== once) {
    Y.guvenliYaz(yol, s);
    console.log(`${dosya}: ${degisen} mojibake düzeltildi`);
  } else {
    console.log(`${dosya}: değişiklik yok`);
  }
}
