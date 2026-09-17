/**
 * Platform politikaları kayıtta onaylanır.
 * Oda girişi için yalnızca tek seferlik hafif topluluk hatırlatması tutulur.
 * Bir kez onaylandıysa sonraki girişlerde lobi onay ekranı atlanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'oda_topluluk_hatirlatma_v1';

export async function OdaToplulukOnayiVarMi(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function OdaToplulukOnayiniKaydet(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* sessiz */
  }
}
