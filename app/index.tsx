import { useEffect } from 'react';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../src/contexts/AuthContext';
import { AcilisEkrani } from '../src/bilesenler/acilis/AcilisEkrani';
import { GorunumSecimEkrani } from '../src/moduller/gorunum/bilesenler/GorunumSecimEkrani';
import { useTema } from '../src/tasarim-sistemi/tema/TemaSaglayici';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Giriş kapısı — marka açılış + görünüm seçimi + oturum yönlendirme.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const { hazir, secimGerekli } = useTema();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading || !hazir || secimGerekli) return;
    const t = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/(auth)/login');
    }, 220);
    return () => clearTimeout(t);
  }, [loading, session, hazir, secimGerekli]);

  if (hazir && secimGerekli) {
    return <GorunumSecimEkrani />;
  }

  return (
    <AcilisEkrani altYazi={loading || !hazir ? 'Hazırlanıyor' : 'Açılıyor'} />
  );
}
