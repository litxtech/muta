import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { LiveKitBaglantiYoneticisi } from '../../src/moduller/livekit/baglanti/LiveKitBaglantiYoneticisi';
import { GorusmeAktifEkrani } from '../../src/moduller/gorusme/bilesenler/GorusmeEkranlari';
import { GorusmeArkaPlan } from '../../src/moduller/gorusme/bilesenler/GorusmeArkaPlan';
import {
  GorusmeOturumEkranAc,
  GorusmeOturumEkranKapandiIptal,
  GorusmeOturumEkranKapandi,
  GorusmeOturumKameraAyarla,
  GorusmeOturumMuteAyarla,
  GorusmeOturumSpeakerAyarla,
  GorusmeOturumSunumAyarla,
  GorusmeOturumTamamenBitir,
} from '../../src/moduller/gorusme/oturum/GorusmeOturumYoneticisi';
import { useGorusmeOturumu } from '../../src/moduller/gorusme/oturum/useGorusmeOturumu';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';

export default function GorusmeEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const oturum = useGorusmeOturumu();
  const bilincliCikis = useRef(false);
  const mockUyariVerildi = useRef(false);
  const oturumKuruldu = useRef(false);

  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    if (!id) return;
    bilincliCikis.current = false;
    mockUyariVerildi.current = false;
    oturumKuruldu.current = false;
    let iptal = false;

    GorusmeOturumEkranKapandiIptal();

    void (async () => {
      const sonuc = await GorusmeOturumEkranAc({
        callId: id,
        userId: user?.id,
      });
      if (iptal) return;
      if (sonuc === 'reuse' || sonuc === 'started') {
        oturumKuruldu.current = true;
        return;
      }
      if (sonuc === 'ended') {
        Alert.alert('Görüşme', 'Görüşme sona erdi');
        bilincliCikis.current = true;
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/messages');
        return;
      }
      if (sonuc === 'error') {
        oturumKuruldu.current = true;
      }
    })();

    return () => {
      iptal = true;
      GorusmeOturumEkranKapandi(id);
    };
  }, [id, user?.id]);

  useEffect(() => {
    if (!id) return;
    if (bilincliCikis.current) return;
    if (oturum && oturum.callId === id) {
      oturumKuruldu.current = true;
      return;
    }
    if (oturum === null && oturumKuruldu.current) {
      bilincliCikis.current = true;
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/messages');
    }
  }, [oturum, id]);

  useEffect(() => {
    if (oturum?.hata) {
      Alert.alert('Medya bağlantısı', oturum.hata);
    }
  }, [oturum?.hata]);

  useEffect(() => {
    if (oturum?.mock && oturum.hazir && !mockUyariVerildi.current) {
      mockUyariVerildi.current = true;
      Alert.alert(
        'Medya',
        'Canlı ses/görüntü için LiveKit’li native build gerekir. Şu an demo moddasın.',
      );
    }
  }, [oturum?.mock, oturum?.hazir]);

  const bitir = useCallback(async () => {
    Keyboard.dismiss();
    bilincliCikis.current = true;
    await GorusmeOturumTamamenBitir({ reason: 'hangup' });
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/messages');
  }, []);

  const kucult = useCallback(() => {
    if (!oturum?.baglandi) return;
    bilincliCikis.current = true;
    GorusmeOturumSunumAyarla('minimized');
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [oturum?.baglandi]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (oturum?.baglandi && oturum.callId === id) {
        kucult();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [oturum?.baglandi, oturum?.callId, id, kucult]);

  const isVideo = oturum?.call.call_type === 'video';
  const isCaller = oturum?.call.caller_id === user?.id;

  return (
    <GorusmeArkaPlan>
      {/* flex:1 sarmalayıcı — ModulHataSiniri native view üretmez; zinciri kırma */}
      <View style={styles.icerik} collapsable={false}>
        <ModulHataSiniri
          modulAdi="görüşme"
          varyant="ekran"
          fallbackHref="/(tabs)/messages"
        >
          {oturum && oturum.callId === id ? (
            <GorusmeAktifEkrani
              peer={oturum.peer}
              callType={isVideo ? 'video' : 'audio'}
              durumYazi={oturum.durumYazi}
              baglandi={oturum.baglandi}
              answeredAt={oturum.call.answered_at}
              isCaller={isCaller}
              muted={oturum.muted}
              speaker={oturum.speaker}
              cameraOn={oturum.cameraOn}
              mock={oturum.mock}
              onMute={() => GorusmeOturumMuteAyarla(!oturum.muted)}
              onSpeaker={() => GorusmeOturumSpeakerAyarla(!oturum.speaker)}
              onCamera={
                isVideo
                  ? () => GorusmeOturumKameraAyarla(!oturum.cameraOn)
                  : undefined
              }
              onFlip={
                isVideo
                  ? () => {
                      void LiveKitBaglantiYoneticisi.kameraCevir();
                    }
                  : undefined
              }
              onHangup={() => void bitir()}
              onMinimize={oturum.baglandi ? kucult : undefined}
            />
          ) : (
            <View style={styles.bos} />
          )}
        </ModulHataSiniri>
      </View>
    </GorusmeArkaPlan>
  );
}

const styles = StyleSheet.create({
  icerik: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  bos: { flex: 1, backgroundColor: 'transparent' },
});
