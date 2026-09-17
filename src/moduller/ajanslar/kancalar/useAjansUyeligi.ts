import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AjansUyelikGetir,
  type AjansUyelik,
} from '../okuma/AjansUyelikGetir';

const BOS: AjansUyelik = {
  role: 'none',
  agency: null,
  application_id: null,
  application_status: null,
};

/** Giriş yapan kullanıcının ajans üyeliği / bekleyen başvurusu. */
export function useAjansUyeligi(enabled = true) {
  const [uyelik, setUyelik] = useState<AjansUyelik>(BOS);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yenile = useCallback(async () => {
    if (!enabled) {
      setUyelik(BOS);
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    try {
      setUyelik(await AjansUyelikGetir());
    } catch {
      setUyelik(BOS);
    } finally {
      setYukleniyor(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void yenile();
    }, [yenile]),
  );

  return { uyelik, yukleniyor, yenile };
}
