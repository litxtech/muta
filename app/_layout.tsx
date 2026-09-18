import React, { useEffect } from 'react';
import 'react-native-gesture-handler';
import '../src/tasarim-sistemi/tema/StilYama';
import { InteractionManager, LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { BildirimSaglayici } from '../src/moduller/bildirimler/baglam/BildirimSaglayici';
import { GorusmeGelenSaglayici } from '../src/moduller/gorusme/bilesenler/GorusmeGelenSaglayici';
import { KullanimSuresiSaglayici } from '../src/moduller/kullanim-suresi/baglam/KullanimSuresiSaglayici';
import { AktifSesOdasiMiniBar } from '../src/moduller/ses-odalari/bilesenler/AktifSesOdasiMiniBar';
import { SesOdasiArkaPlanKurulum } from '../src/moduller/ses-odalari/arka-plan/SesOdasiArkaPlanServisi';
import { OyunKazancBalonuSaglayici } from '../src/moduller/oyunlar/kazanc-balonu/OyunKazancBalonuSaglayici';
import { UygulamaHataSiniri } from '../src/ortak/hata-sinirlari/UygulamaHataSiniri';
import { ModulHataSiniri } from '../src/ortak/hata-sinirlari/ModulHataSiniri';
import { ImagePickerOnIsit } from '../src/ortak/medya/ImagePickerHazirMi';
import { TemaSaglayici, useTema } from '../src/tasarim-sistemi/tema/TemaSaglayici';
import { TabBarGuvenlikKur } from '../src/components/tab-navigasyon/TabBarGuvenlik';
import { YuzenTabBar } from '../src/components/YuzenTabBar';
import '../src/moduller/livekit/polyfill/AbortReasonPolyfill';

// Tab bar AppState/Dimensions kilidi — en erken
try {
  TabBarGuvenlikKur();
} catch {
  /* ignore */
}

// LiveKit bilincli disconnect sonrasi WS 1001; LogBox kirmizi hata gostermesin
LogBox.ignoreLogs([
  'error reading from signal stream',
  'WS closed unexpectedly',
]);

/** LiveKit globals — expo-audio ile AVAudioSession cakismasin */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LiveKitGlobalsKaydet } = require('../src/moduller/livekit/polyfill/LiveKitGlobalsKaydet') as {
    LiveKitGlobalsKaydet?: () => boolean;
  };
  LiveKitGlobalsKaydet?.();
} catch {
  /* native eksik / bozuk — baglanti mock'a dusar */
}

/** Android FGS + iOS arka plan ses oturumu */
try {
  SesOdasiArkaPlanKurulum();
} catch {
  /* native yok / Expo Go */
}

/** Deep link / yenilemede tab gecmisi index'e dusmesin */
export const unstable_settings = {
  initialRouteName: '(tabs)',
};


function ImagePickerArkaPlanIsit() {
  useEffect(() => {
    const gorev = InteractionManager.runAfterInteractions(() => {
      ImagePickerOnIsit({ izinIste: false });
    });
    return () => gorev.cancel();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <TemaSaglayici>
      <KokIcerik />
    </TemaSaglayici>
  );
}

function KokIcerik() {
  const { palet } = useTema();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palet.bg }}>
      <UygulamaHataSiniri>
        <AuthProvider>
          <KullanimSuresiSaglayici>
          <BildirimSaglayici>
          <ModulHataSiniri
            modulAdi="uygulama"
            varyant="ekran"
            fallbackHref="/(tabs)"
          >
            <GorusmeGelenSaglayici>
              <ImagePickerArkaPlanIsit />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: palet.bg },
                  animation: 'fade',
                }}
              >
          <Stack.Screen
            name="(tabs)"
            options={{
              // Ana kabuk kaydırılarak pop edilmesin — hamburger kenarı ile çakışır
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="kesfet" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="mesaj/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kullanici/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="takip/takipciler" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="takip/takip-edilenler" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="takip/istekler" options={{ animation: 'slide_from_right' }} />
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
          <Stack.Screen name="ajans/uye/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/teklifler" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ajans/profil/[id]" options={{ animation: 'slide_from_right' }} />
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
          <Stack.Screen name="sehir/[id]" options={{ animation: 'slide_from_right' }} />
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
          <Stack.Screen name="durum/duzenle" options={{ animation: 'slide_from_bottom' }} />
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
          <Stack.Screen
            name="admin/kyc/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/kyc/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/takas/index"
            options={{ animation: 'slide_from_right' }}
          />
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
          <Stack.Screen name="admin/oyun-test" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="admin/bannerlar/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/bannerlar/yeni"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/bannerlar/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin/giris-lobisi"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="webview" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="admin/ozellikler"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="paylasim/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="paylas/[kod]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ayarlar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profil-ayarlar/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profil-duzenle/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kyc/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cuzdan/takas" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="room/[id]"
            options={{
              animation: 'fade',
              presentation: 'fullScreenModal',
              contentStyle: { backgroundColor: palet.bg },
              gestureEnabled: true,
              freezeOnBlur: true,
            }}
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
              <YuzenTabBar />
              <AktifSesOdasiMiniBar />
              <OyunKazancBalonuSaglayici />
            </GorusmeGelenSaglayici>
          </ModulHataSiniri>
          </BildirimSaglayici>
          </KullanimSuresiSaglayici>
        </AuthProvider>
      </UygulamaHataSiniri>
    </GestureHandlerRootView>
  );
}
