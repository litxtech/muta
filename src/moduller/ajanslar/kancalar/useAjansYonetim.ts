import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AjansYonetimAjanslarim,
  type AjansYonetimOzet,
} from '../islemler/AjansPanelIslemleri';

/** Ajans yetkisi olan kullanıcının sahip olduğu ajanslar (menü görünürlüğü). */
export function useAjansYonetim() {
  const [ajanslar, setAjanslar] = useState<AjansYonetimOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const yenile = useCallback(async () => {
    setYukleniyor(true);
    try {
      setAjanslar(await AjansYonetimAjanslarim());
    } catch {
      setAjanslar([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yenile();
    }, [yenile]),
  );

  const yetkili = ajanslar.length > 0;
  const tekAjans = ajanslar.length === 1 ? ajanslar[0] : null;
  const yonetimHref = tekAjans
    ? (`/ajans/${tekAjans.id}` as const)
    : ('/ajans/yonetim' as const);

  return { ajanslar, yetkili, tekAjans, yonetimHref, yukleniyor, yenile };
}
