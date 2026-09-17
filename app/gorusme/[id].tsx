import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/contexts/AuthContext';
import { MedyaOdasiBaglan, MedyaOdasiKes } from '../../src/moduller/livekit/MedyaBaglantisi';
import { LiveKitBaglantiYoneticisi } from '../../src/moduller/livekit/baglanti/LiveKitBaglantiYoneticisi';
import {
  GorusmeBitir,
  GorusmeGetir,
  MesajThreadKarsiProfil,
} from '../../src/moduller/gorusme/islemler/GorusmeIslemleri';
import { GorusmeEkranKorumaBaslat } from '../../src/moduller/gorusme/guvenlik/GorusmeEkranKoruma';
import { GorusmeAktifEkrani } from '../../src/moduller/gorusme/bilesenler/GorusmeEkranlari';
import type { DirectCall, ThreadKarsiProfil } from '../../src/moduller/gorusme/tipler';
import { supabase } from '../../src/lib/supabase';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';

const KEEP_TAG = 'gorusme-call';

export default function GorusmeEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [call, setCall] = useState<DirectCall | null>(null);
  const [peer, setPeer] = useState<ThreadKarsiProfil | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [baglandi, setBaglandi] = useState(false);
  const [mock, setMock] = useState(false);
  const [durumYazi, setDurumYazi] = useState('Bağlanıyor…');

  const bitir = useCallback(
    async (reason = 'hangup') => {
      if (!id) return;
      Keyboard.dismiss();
      await GorusmeBitir(id, reason);
      await MedyaOdasiKes();
      void deactivateKeepAwake(KEEP_TAG);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/messages');
    },
    [id],
  );

  useEffect(() => {
    // Mesaj composer'dan gelince klavye açık kalmasın (kamera/izin kilidi)
    Keyboard.dismiss();
  }, []);

  useEffect(() => {
    void activateKeepAwakeAsync(KEEP_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_TAG);
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    let korumaStop: (() => void) | undefined;

    (async () => {
      try {
        Keyboard.dismiss();
        const c = await GorusmeGetir(id);
        if (!alive) return;
        setCall(c);
        const isVideo = c.call_type === 'video';
        setCameraOn(isVideo);
        // Sesli aramada kulaklık varsayılan (WhatsApp); görüntülüde hoparlör
        setSpeaker(isVideo);

        const benArayan = c.caller_id === user?.id;
        if (c.status === 'ringing' && benArayan) {
          setDurumYazi('Çalıyor…');
        } else if (c.status === 'ringing') {
          setDurumYazi('Bağlanıyor…');
        } else if (c.status === 'active') {
          setDurumYazi('Bağlandı');
        }

        if (['ended', 'rejected', 'missed', 'cancelled'].includes(c.status)) {
          Alert.alert('Görüşme', 'Görüşme sona erdi');
          router.back();
          return;
        }

        // Klavyenin kapanması + kamera izni için kısa nefes
        if (isVideo) {
          await new Promise((r) => setTimeout(r, 120));
        }
        if (!alive) return;

        // Profil + LiveKit paralel — arama ekrani hemen acilir
        const [, medya] = await Promise.all([
          MesajThreadKarsiProfil(c.thread_id).then((p) => {
            if (alive) setPeer(p);
          }),
          MedyaOdasiBaglan({
            roomName: c.channel_name,
            role: 'host',
            video: isVideo,
            gorusmeModu: true,
          }),
        ]);
        if (!alive) return;
        if (!medya.ok) {
          setDurumYazi(medya.hata);
          Alert.alert('Medya bağlantısı', medya.hata ?? 'Bağlanılamadı');
          return;
        }
        if (medya.mock) {
          setMock(true);
          setDurumYazi('Demo — ses/görüntü yok');
          Alert.alert(
            'Medya',
            'Canlı ses/görüntü için LiveKit’li native build gerekir. Şu an demo moddasın.',
          );
          return;
        }
        setMock(false);
        void LiveKitBaglantiYoneticisi.setSpeakerphone(isVideo);
        // Mikrofonu açık tut (muted state false ile senkron)
        LiveKitBaglantiYoneticisi.muteLocalAudio(false);

        // Video: kamera yayınını bir kez daha zorla (ilk deneme sessiz fail olabiliyor)
        if (isVideo) {
          LiveKitBaglantiYoneticisi.setLocalVideoEnabled(true);
        }

        if (c.status === 'active') {
          setBaglandi(true);
          setDurumYazi('Bağlandı');
        }

        korumaStop = await GorusmeEkranKorumaBaslat(c.id);
      } catch (e) {
        Alert.alert(
          'Görüşme',
          e instanceof Error ? e.message : 'Açılamadı',
        );
        router.back();
      }
    })();

    const channel = supabase
      .channel(`call-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          filter: `id=eq.${id}`,
          table: 'direct_calls',
        },
        (payload) => {
          const next = payload.new as DirectCall;
          setCall(next);
          if (next.status === 'active') {
            setBaglandi(true);
            setDurumYazi('Bağlandı');
            // Karşı taraf cevapladıktan sonra video track yenile
            if (next.call_type === 'video') {
              LiveKitBaglantiYoneticisi.setLocalVideoEnabled(true);
            }
            LiveKitBaglantiYoneticisi.muteLocalAudio(false);
          }
          if (['ended', 'rejected', 'missed', 'cancelled'].includes(next.status)) {
            void MedyaOdasiKes();
            void deactivateKeepAwake(KEEP_TAG);
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/messages');
          }
        },
      )
      .subscribe();

    return () => {
      alive = false;
      korumaStop?.();
      void supabase.removeChannel(channel);
      void MedyaOdasiKes();
      void deactivateKeepAwake(KEEP_TAG);
    };
  }, [id, user?.id]);

  useEffect(() => {
    LiveKitBaglantiYoneticisi.muteLocalAudio(muted);
  }, [muted]);

  useEffect(() => {
    if (call?.call_type === 'video') {
      LiveKitBaglantiYoneticisi.setLocalVideoEnabled(cameraOn);
    }
  }, [cameraOn, call?.call_type]);

  useEffect(() => {
    void LiveKitBaglantiYoneticisi.setSpeakerphone(speaker);
  }, [speaker]);

  const isVideo = call?.call_type === 'video';
  const isCaller = call?.caller_id === user?.id;

  return (
    <Screen koyuSahne edges={['top', 'bottom']}>
      <ModulHataSiniri
        modulAdi="görüşme"
        varyant="ekran"
        fallbackHref="/(tabs)/messages"
      >
        <View style={styles.wrap}>
          <GorusmeAktifEkrani
            peer={peer}
            callType={isVideo ? 'video' : 'audio'}
            durumYazi={durumYazi}
            baglandi={baglandi}
            answeredAt={call?.answered_at}
            isCaller={isCaller}
            muted={muted}
            speaker={speaker}
            cameraOn={cameraOn}
            mock={mock}
            onMute={() => setMuted((v) => !v)}
            onSpeaker={() => setSpeaker((v) => !v)}
            onCamera={isVideo ? () => setCameraOn((v) => !v) : undefined}
            onFlip={
              isVideo
                ? () => {
                    void LiveKitBaglantiYoneticisi.kameraCevir();
                  }
                : undefined
            }
            onHangup={() => void bitir('hangup')}
          />
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: RenkTokenlari.bg },
});
