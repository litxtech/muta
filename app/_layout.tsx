import React from 'react';
import 'react-native-gesture-handler';
import '../src/moduller/livekit/polyfill/AbortReasonPolyfill';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { BildirimSaglayici } from '../src/moduller/bildirimler/baglam/BildirimSaglayici';
import { GorusmeGelenSaglayici } from '../src/moduller/gorusme/bilesenler/GorusmeGelenSaglayici';
import { UygulamaHataSiniri } from '../src/ortak/hata-sinirlari/UygulamaHataSiniri';
import { ModulHataSiniri } from '../src/ortak/hata-sinirlari/ModulHataSiniri';
import { colors } from '../src/theme/colors';

/** LiveKit globals — require + typeof; named import döngüsünde undefined kalmasın */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LiveKitNativeVarMi } = require('../src/moduller/livekit/bilesenler/LiveKitVideoViewAl') as {
    LiveKitNativeVarMi?: () => boolean;
  };
  if (typeof LiveKitNativeVarMi === 'function' && LiveKitNativeVarMi()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerGlobals } = require('@livekit/react-native') as {
      registerGlobals: () => void;
    };
    registerGlobals();
  }
} catch {
  /* native eksik / bozuk — baglanti mock'a dusar */
}

/** Deep link / yenilemede tab gecmisi index'e dusmesin */
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <UygulamaHataSiniri>
        <AuthProvider>
          <BildirimSaglayici>
          <ModulHataSiniri
            modulAdi="uygulama"
            varyant="ekran"
            fallbackHref="/(tabs)"
          >
            <GorusmeGelenSaglayici>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                  animation: 'fade',
                }}
              >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="kesfet" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mesaj/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kullanici/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="destek/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="lobi/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="canli/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="canli/[id]"
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="pk/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="siralamalar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/yonetim/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="admin/ajanslar/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/ajanslar/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="host/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/lig" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/savas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/secim/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="sehir/secim/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/sehir-secim" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="platform/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="duyuru/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="politika/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="politika/[kod]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="guvenlik/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="engellenen-kullanicilar/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="hesap-sil/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="bildirimler/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="durum/olustur" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="durum/[id]"
            options={{ animation: 'fade', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="bildirim-ayarlari/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="sertifikasyon/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="admin/paylasim-linkleri"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/kullanicilar/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/kullanicilar/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="admin/finans" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/ciro" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/rehber" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="admin/moderasyon/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/moderasyon/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/destek/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/destek/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="admin/odalar" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/ekonomi" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="admin/oyunlar" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="admin/ozellikler"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="paylasim/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="paylas/[kod]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ayarlar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profil-ayarlar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profil-duzenle/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="room/[id]"
            options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="gorusme/[id]"
            options={{ animation: 'fade', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen
            name="admin/gorusme-guvenlik"
            options={{ animation: 'slide_from_right' }}
          />
              </Stack>
            </GorusmeGelenSaglayici>
          </ModulHataSiniri>
          </BildirimSaglayici>
        </AuthProvider>
      </UygulamaHataSiniri>
    </GestureHandlerRootView>
  );
}
