import { useEffect } from 'react';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../src/contexts/AuthContext';
import { AcilisEkrani } from '../src/bilesenler/acilis/AcilisEkrani';
import { useTema } from '../src/tasarim-sistemi/tema/TemaSaglayici';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Giriş kapısı — marka açılış + oturum yönlendirme.
 * Görünüm varsayılan koyu; seçim ayarlardan yapılır.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const { hazir } = useTema();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

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
