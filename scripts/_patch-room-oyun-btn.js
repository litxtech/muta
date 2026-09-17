const fs = require('fs');
const p = 'app/room/[id].tsx';
let c = fs.readFileSync(p, 'utf8');
const old = [
'            <SesOdasiMikrofonDuzeni',
'              seats={seats}',
'              hostId={room.host_id}',
'              layoutCode={room.layout_code}',
'              onSeatPress={koltukMenusu}',
'            />',
'            {oyunlarAcik && !isDemo && !klavyeAcik ? (',
'              <View style={styles.oyunKoltukBtn} pointerEvents="box-none">',
'                <OdaOyunDockButonu',
'                  aktif={gameOpen}',
'                  onPress={() =>',
"                    islemiDene('oyun_baslat', () => {",
'                      setGiftOpen(false);',
'                      void gorunurOyunlariYenile();',
'                      setGameOpen(true);',
'                    })',
'                  }',
'                />',
'              </View>',
'            ) : null}',
].join('\r\n');
const neu = [
'            <SesOdasiMikrofonDuzeni',
'              seats={seats}',
'              hostId={room.host_id}',
'              layoutCode={room.layout_code}',
'              onSeatPress={koltukMenusu}',
'              oyunButonu={',
'                oyunlarAcik && !isDemo && !klavyeAcik ? (',
'                  <OdaOyunDockButonu',
'                    aktif={gameOpen}',
'                    onPress={() =>',
"                      islemiDene('oyun_baslat', () => {",
'                        setGiftOpen(false);',
'                        void gorunurOyunlariYenile();',
'                        setGameOpen(true);',
'                      })',
'                    }',
'                  />',
'                ) : null',
'              }',
'            />',
].join('\r\n');
if (!c.includes(old)) {
  console.error('BLOCK NOT FOUND len', old.length);
  process.exit(1);
}
c = c.replace(old, neu);
c = c.replace(/\r?\n  oyunKoltukBtn: \{[\s\S]*?\},/, '');
fs.writeFileSync(p, c);
console.log('OK', c.includes('oyunButonu'), !c.includes('oyunKoltukBtn'));