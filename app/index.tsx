import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { AcilisEkrani } from '../src/bilesenler/acilis/AcilisEkrani';
import { useTema } from '../src/tasarim-sistemi/tema/TemaSaglayici';

/**
 * Giriş kapısı — marka açılış + oturum yönlendirme.
 * Native splash auto-hide (expo-splash-screen native modülü bu build'de yok).
 */
export default function Index() {
  const { session, loading } = useAuth();
  const { hazir } = useTema();

  useEffect(() => {
    if (loading || !hazir) return;
    const t = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/(auth)/login');
    }, 220);
    return () => clearTimeout(t);
  }, [loading, session, hazir]);

  return (
    <AcilisEkrani altYazi={loading || !hazir ? 'Hazırlanıyor' : 'Açılıyor'} />
  );
}
