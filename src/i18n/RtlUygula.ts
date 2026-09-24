import { I18nManager, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import type { UygulamaDili } from './diller';
import { isRtlDil } from './rtl';

/** Arapça için RTL; diğer diller LTR. Direction değişirse native reload gerekir. */
export function RtlUygula(dil: UygulamaDili): {
  rtl: boolean;
  yenidenBaslatGerekli: boolean;
} {
  const hedefRtl = isRtlDil(dil);
  const simdiki = I18nManager.isRTL;
  if (simdiki === hedefRtl) {
    return { rtl: hedefRtl, yenidenBaslatGerekli: false };
  }
  try {
    I18nManager.allowRTL(hedefRtl);
    I18nManager.forceRTL(hedefRtl);
  } catch {
    /* native yok */
  }
  // RN/Expo: LTR↔RTL layout I18nManager bayrağı native’de kalıcı; reload şart
  const yenidenBaslatGerekli = Platform.OS !== 'web';
  return { rtl: hedefRtl, yenidenBaslatGerekli };
}

/** Sadece LTR↔RTL geçişinde çağır — TR↔EN↔ES için kullanma */
export async function RtlYenidenBaslat(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await reloadAppAsync('rtl-direction-change');
  } catch {
    /* reload başarısız — kullanıcı manuel kapatıp açmalı */
  }
}
