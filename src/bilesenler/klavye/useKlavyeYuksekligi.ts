import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { KlavyeKonumunuKaydet } from './KlavyeKonum';

/**
 * Klavye yüksekliği + açık mı?
 * Android: screen−window nav bar farkını "resize oldu" sanıp pad'i 0 yapmak
 * input'u klavyenin altında bırakıyordu — overlap / baseline ile düzeltilir.
 */
export function useKlavyeYuksekligi(ekstraPad = 0): {
  yukseklik: number;
  acik: boolean;
} {
  const [yukseklik, setYukseklik] = useState(0);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const baselineGap = Math.max(
      0,
      Dimensions.get('screen').height - Dimensions.get('window').height,
    );

    const androidPadHesapla = (keyboardH: number, screenY: number) => {
      const screenH = Dimensions.get('screen').height;
      const windowH = Dimensions.get('window').height;
      const gap = Math.max(0, screenH - windowH);
      const resizeMiktari = Math.max(0, gap - baselineGap);

      if (resizeMiktari >= keyboardH * 0.45) {
        return Math.max(ekstraPad, Math.round(keyboardH * 0.55));
      }

      const overlap = Math.max(0, Math.ceil(windowH - screenY));
      if (overlap > 24) {
        return Math.max(0, overlap + ekstraPad);
      }

      return Math.max(0, keyboardH + ekstraPad);
    };

    const uygula = (keyboardH: number, screenY: number) => {
      KlavyeKonumunuKaydet(screenY, keyboardH);
      if (keyboardH <= 0) {
        setYukseklik(0);
        return;
      }
      if (Platform.OS === 'android') {
        setYukseklik(androidPadHesapla(keyboardH, screenY));
        return;
      }
      setYukseklik(Math.max(0, keyboardH + ekstraPad));
    };

    const onShow = Keyboard.addListener(showEvt, (e) => {
      const keyboardH = e.endCoordinates?.height ?? 0;
      const screenY = e.endCoordinates?.screenY ?? 0;
      setAcik(true);
      uygula(keyboardH, screenY);
      if (Platform.OS === 'android' && keyboardH > 0) {
        requestAnimationFrame(() => uygula(keyboardH, screenY));
        setTimeout(() => uygula(keyboardH, screenY), 60);
        setTimeout(() => uygula(keyboardH, screenY), 180);
      }
    });

    const onHide = Keyboard.addListener(hideEvt, () => {
      setAcik(false);
      setYukseklik(0);
      KlavyeKonumunuKaydet(Dimensions.get('window').height, 0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [ekstraPad]);

  return { yukseklik, acik };
}
