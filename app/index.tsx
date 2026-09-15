import { useEffect } from 'react';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../src/contexts/AuthContext';
import { AcilisEkrani } from '../src/bilesenler/acilis/AcilisEkrani';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Giriş kapısı — marka açılış + oturum yönlendirme.
 * replace ile açılır ki geri tuşunda Ana Sayfa'ya düşülmesin.
 */
export default function Index() {
  const { session, loading } = useAuth();

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      router.replace(session ? '/(tabs)' : '/(auth)/login');
    }, 480);
    return () => clearTimeout(t);
  }, [loading, session]);

  return (
    <AcilisEkrani altYazi={loading ? 'Hazırlanıyor' : 'Açılıyor'} />
  );
}
