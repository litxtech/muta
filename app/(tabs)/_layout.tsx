import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { YuzenTabBar } from '../../src/components/YuzenTabBar';
import { yuzenTabBarToplamYukseklik } from '../../src/components/YuzenTabBosluk';
import { useAuth } from '../../src/contexts/AuthContext';

/**
 * Sekmeler: Ana · Durum · Oluştur · Mesaj · Profil
 * YuzenTabBar in-flow (absolute değil) — iOS çıkış/geri dönüşte bozulmaz.
 */
export default function TabsLayout() {
  const { session, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = yuzenTabBarToplamYukseklik(insets.bottom);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <YuzenTabBar {...props} />,
    [],
  );

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/(auth)/login');
    }
  }, [loading, session]);

  // Oturum varken loading spinner Tabs’ı UNMOUNT ETMESİN — remount iOS layout bozar
  if (!session) {
    if (loading) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: RenkTokenlari.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={RenkTokenlari.primary} size="large" />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: RenkTokenlari.bg }} />
    );
  }

  return (
    <ModulHataSiniri
      modulAdi="ana-navigasyon"
      varyant="ekran"
      fallbackHref="/(auth)/login"
    >
      <Tabs
        backBehavior="none"
        tabBar={renderTabBar}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          tabBarShowLabel: false,
          tabBarActiveTintColor: RenkTokenlari.primarySoft,
          tabBarInactiveTintColor: RenkTokenlari.textDim,
          tabBarStyle: {
            height: tabBarHeight,
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            position: 'relative',
          },
          tabBarBackground: () => null,
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
