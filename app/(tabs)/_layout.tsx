import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { YuzenTabBar } from '../../src/components/YuzenTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors } from '../../src/theme/colors';

/**
 * Sekmeler: Ana · Durum · Oluştur · Mesaj · Profil
 * Odalar tabda gizli; oluştur / ana menüden açılır.
 */
export default function TabsLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [loading, session]);

  if (loading || !session) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ModulHataSiniri
      modulAdi="ana-navigasyon"
      varyant="ekran"
      fallbackHref="/(auth)/login"
    >
      <Tabs
        backBehavior="history"
        tabBar={(props) => <YuzenTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: RenkTokenlari.primarySoft,
          tabBarInactiveTintColor: RenkTokenlari.textDim,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
        <Tabs.Screen name="durum" options={{ title: 'Durum' }} />
        <Tabs.Screen name="create" options={{ title: 'Oluştur' }} />
        <Tabs.Screen name="messages" options={{ title: 'Mesajlar' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
        <Tabs.Screen name="rooms" options={{ href: null, title: 'Odalar' }} />
        <Tabs.Screen name="wallet" options={{ href: null, title: 'Cüzdan' }} />
        <Tabs.Screen
          name="cihazlar"
          options={{ href: null, title: 'Cihazlar' }}
        />
      </Tabs>
    </ModulHataSiniri>
  );
}
