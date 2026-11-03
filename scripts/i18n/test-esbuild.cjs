const b = require('esbuild');
const r = b.buildSync({
  stdin: { contents: 'export default {a:"Sí", b:"Invitación"}', loader: 'ts' },
  write: false,
  bundle: true,
  format: 'cjs',
});
const t = r.outputFiles[0].text;
console.log(JSON.stringify(t));
console.log([...t].filter((c) => c.codePointAt(0) > 127).length, 'ascii-dışı karakter');
