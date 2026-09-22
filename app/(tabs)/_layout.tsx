import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  TabsBirKezMountMu,
  TabsMountIsaretle,
} from '../../src/components/tab-navigasyon/TabBarGuvenlik';

/**
 * Sekme ekranları — tab BAR burada YOK.
 * Bar root’ta (YuzenTabBar) — oda modal’ı Tabs’ı dondursa bile bozulmaz.
 */
export default function TabsLayout() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (session) TabsMountIsaretle();
  }, [session]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/(auth)/login');
  }, [loading, session]);

  const tabsKoruma = TabsBirKezMountMu() || !!session;

  if (!tabsKoruma) {
    // Oturum yokken boş View gösterme — login yönlendirmesi gelene kadar spinner
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
    <ModulHataSiniri
      modulAdi="ana-navigasyon"
      varyant="ekran"
      fallbackHref="/(auth)/login"
    >
      <Tabs
        backBehavior="none"
        detachInactiveScreens
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          lazy: true,
          freezeOnBlur: true,
          tabBarStyle: {
            display: 'none',
            height: 0,
            overflow: 'hidden',
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Ana Sayfa', lazy: false, freezeOnBlur: false }}
        />
        <Tabs.Screen name="durum" options={{ title: 'Durum', lazy: true }} />
        <Tabs.Screen name="create" options={{ title: 'Oluştur', lazy: true }} />
        <Tabs.Screen
          name="messages"
          options={{ title: 'Mesajlar', lazy: true }}
        />
        <Tabs.Screen name="profile" options={{ title: 'Profil', lazy: true }} />
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
