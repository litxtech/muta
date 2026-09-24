/**
 * One-shot: convert current good ar.ts → ar.json (UTF-8), then thin ar.ts wrapper.
 * Run: node scripts/ar_ts_to_json.mjs
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

function extractObjectLiteral(src, exportName) {
  const marker = `export const ${exportName}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`export ${exportName} not found`);
  let i = src.indexOf('{', start);
  let depth = 0;
  let inStr = null;
  let escape = false;
  const begin = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(begin, i + 1);
    }
  }
  throw new Error('unclosed object');
}

const arTsPath = 'src/i18n/locales/ar.ts';
const arJsonPath = 'src/i18n/locales/ar.json';

const arSrc = fs.readFileSync(arTsPath, 'utf8');
const arabic = (arSrc.match(/[\u0600-\u06FF]/g) || []).length;
if (arabic < 10_000) {
  console.error('ar.ts corrupt — rebuild first with build_ar_locale.mjs', { arabic });
  process.exit(1);
}

const obj = Function(
  `"use strict"; return (${extractObjectLiteral(arSrc, 'ar')})`,
)();
const json = `${JSON.stringify(obj, null, 2)}\n`;

const tmp = path.join(os.tmpdir(), `tamuso-ar-${Date.now()}.json`);
fs.writeFileSync(tmp, json, 'utf8');
fs.copyFileSync(tmp, arJsonPath);
fs.unlinkSync(tmp);

const onDisk = fs.readFileSync(arJsonPath, 'utf8');
const arabicJson = (onDisk.match(/[\u0600-\u06FF]/g) || []).length;
if (arabicJson < 10_000) {
  console.error('ar.json write corrupted', { arabicJson });
  process.exit(1);
}

/** ASCII-only wrapper — IDE cannot mangle Arabic in this file */
const wrapper =
  `import type { CeviriSozlugu } from './tr';\n` +
  `import raw from './ar.json';\n\n` +
  `/** Arabic UI strings live in ar.json (UTF-8). Do not paste Arabic into this file. */\n` +
  `export const ar = raw as CeviriSozlugu;\n`;

const tmpTs = path.join(os.tmpdir(), `tamuso-ar-wrap-${Date.now()}.ts`);
fs.writeFileSync(tmpTs, wrapper, 'utf8');
fs.copyFileSync(tmpTs, arTsPath);
fs.unlinkSync(tmpTs);

console.log(
  JSON.stringify(
    {
      arabicInJson: arabicJson,
      jsonBytes: Buffer.byteLength(onDisk),
      sample: JSON.parse(onDisk).ortak.iptal,
      wrapperBytes: fs.statSync(arTsPath).size,
    },
    null,
    2,
  ),
);
