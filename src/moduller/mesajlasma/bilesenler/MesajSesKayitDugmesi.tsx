/**
 * DM ses kaydı — dokunmatik kontrol (kaydırma yok).
 * Yatay kaydırma sekme geçişi / geri jestiyle çakışmasın diye
 * basılı tut + kaydır yerine: dokun → kaydet → durdur → önizle → gönder.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from 'expo-router';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import {
  SesliMesajKayitBaslat,
  SesliMesajKayitBitir,
  SesliMesajKayitIptal,
  SesliMesajKayitSaniye,
} from '../ses/SesliMesajKayit';
import { DmSesMedyasiYukle } from '../islemler/DmMedyasiYukle';
import { MesajSesYoneticisi } from '../ses/MesajSesYoneticisi';
import { MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';

type Props = {
  disabled?: boolean;
  onGonderildi: (payload: {
    url: string;
    durationMs: number;
    mime: string;
  }) => void;
  onHata?: (hata: string) => void;
};

type OnizlemeDurum = {
  uri: string;
  durationMs: number;
};

const ONIZLEME_KEY = 'dm-voice-preview';

export function MesajSesKayitDugmesi({
  disabled,
  onGonderildi,
  onHata,
}: Props) {
  const { t } = useCeviri();
  const navigation = useNavigation();
  const [kaydediyor, setKaydediyor] = useState(false);
  const [saniye, setSaniye] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [baslatiliyor, setBaslatiliyor] = useState(false);
  const [onizleme, setOnizleme] = useState<OnizlemeDurum | null>(null);
  const [, tick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aktifRef = useRef(false);

  useEffect(() => MesajSesYoneticisi.aboneOl(() => tick((x) => x + 1)), []);

  /** Kayıt / önizleme sırasında geri kaydırma jestini kapat */
  useEffect(() => {
    const kilit = kaydediyor || !!onizleme || baslatiliyor || yukleniyor;
    if (!kilit) return;
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    } as never);
    return () => {
      navigation.setOptions({
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      } as never);
    };
  }, [kaydediyor, onizleme, baslatiliyor, yukleniyor, navigation]);

  useEffect(() => {
    return () => {
      tickDurdur();
      if (aktifRef.current) void SesliMesajKayitIptal();
      void MesajSesYoneticisi.durdur();
    };
  }, []);

  const tickDurdur = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const kayitBaslat = async () => {
    if (disabled || baslatiliyor || kaydediyor || onizleme || yukleniyor) return;
    setBaslatiliyor(true);
    const r = await SesliMesajKayitBaslat();
    setBaslatiliyor(false);
    if (!r.ok) {
      onHata?.(r.hata);
      return;
    }
    aktifRef.current = true;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* optional */
    }
    setKaydediyor(true);
    setSaniye(0);
    tickRef.current = setInterval(() => {
      setSaniye(SesliMesajKayitSaniye());
    }, 200);
  };

  const kayitIptal = () => {
    tickDurdur();
    aktifRef.current = false;
    void SesliMesajKayitIptal();
    setKaydediyor(false);
    setSaniye(0);
  };

  const kaydiOnizlemeyeAl = async () => {
    tickDurdur();
    aktifRef.current = false;
    const bitis = await SesliMesajKayitBitir();
    setKaydediyor(false);
    setSaniye(0);
    if (!bitis.ok) {
      onHata?.(bitis.hata);
      return;
    }
    if (bitis.durationMs < 400) {
      onHata?.(t('mesajV2.voiceTooShort'));
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      /* optional */
    }
    setOnizleme({ uri: bitis.uri, durationMs: bitis.durationMs });
  };

  const onizlemeSil = () => {
    void MesajSesYoneticisi.durdur();
    setOnizleme(null);
  };

  const onizlemeGonder = async () => {
    if (!onizleme || yukleniyor) return;
    setYukleniyor(true);
    void MesajSesYoneticisi.durdur();
    const up = await DmSesMedyasiYukle(onizleme.uri, {
      mime: 'audio/mp4',
      durationMs: onizleme.durationMs,
    });
    setYukleniyor(false);
    if (!up.ok) {
      onHata?.(up.hata);
      return;
    }
    const payload = {
      url: up.url,
      durationMs: onizleme.durationMs,
      mime: up.mime,
    };
    setOnizleme(null);
    onGonderildi(payload);
  };

  const mm = Math.floor(saniye / 60);
  const ss = Math.floor(saniye % 60)
    .toString()
    .padStart(2, '0');

  if (onizleme) {
    const sureSn = Math.max(0, onizleme.durationMs / 1000);
    const omm = Math.floor(sureSn / 60);
    const oss = Math.floor(sureSn % 60)
      .toString()
      .padStart(2, '0');
    const caliyor = MesajSesYoneticisi.caliyorMu(ONIZLEME_KEY);

    return (
      <View
        style={[
          styles.recBar,
          {
            backgroundColor: MesajKartTokenlari.bgTheirs,
            borderColor: MesajKartTokenlari.borderTheirs,
            borderWidth: MesajKartTokenlari.borderWidth,
          },
        ]}
        // Yatay kaydırma bu karttan sekmeye/geriye sızmasın
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <Pressable
          onPress={() =>
            void MesajSesYoneticisi.cal(ONIZLEME_KEY, onizleme.uri)
          }
          style={styles.playMini}
          accessibilityLabel={t('mesajV2.voicePreviewHint')}
        >
          <Ionicons
            name={caliyor ? 'pause' : 'play'}
            size={16}
            color={RenkTokenlari.text}
          />
        </Pressable>
        <View style={styles.metinBlok}>
          <Text style={styles.recTime}>
            {omm}:{oss}
          </Text>
          <Text style={styles.recHint} numberOfLines={1}>
            {t('mesajV2.voicePreviewHint')}
          </Text>
        </View>
        <Pressable
          onPress={onizlemeSil}
          disabled={yukleniyor}
          style={styles.ikonHit}
          accessibilityLabel={t('mesajV2.delete')}
        >
          <Ionicons name="trash-outline" size={18} color={RenkTokenlari.danger} />
        </Pressable>
        <Pressable
          onPress={() => void onizlemeGonder()}
          disabled={yukleniyor}
          style={styles.sendMini}
          accessibilityLabel={t('mesajV2.send')}
        >
          {yukleniyor ? (
            <ActivityIndicator color="#12040C" />
          ) : (
            <Ionicons name="send" size={16} color="#12040C" />
          )}
        </Pressable>
      </View>
    );
  }

  if (kaydediyor) {
    return (
      <View
        style={[
          styles.recBar,
          {
            backgroundColor: MesajKartTokenlari.bgTheirs,
            borderColor: MesajKartTokenlari.borderTheirs,
            borderWidth: MesajKartTokenlari.borderWidth,
          },
        ]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <Text style={styles.recDot}>●</Text>
        <View style={styles.metinBlok}>
          <Text style={styles.recTime}>
            {mm}:{ss}
          </Text>
          <Text style={styles.recHint} numberOfLines={1}>
            {t('mesajV2.recording')}
          </Text>
        </View>
        <Pressable
          onPress={kayitIptal}
          style={styles.ikonHit}
          accessibilityLabel={t('mesajV2.delete')}
        >
          <Ionicons name="trash-outline" size={18} color={RenkTokenlari.danger} />
        </Pressable>
        <Pressable
          onPress={() => void kaydiOnizlemeyeAl()}
          style={styles.sendMini}
          accessibilityLabel={t('mesajV2.preview')}
        >
          <Ionicons name="checkmark" size={18} color="#12040C" />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      disabled={disabled || baslatiliyor || yukleniyor}
      onPress={() => void kayitBaslat()}
      style={[
        styles.micHit,
        (disabled || baslatiliyor || yukleniyor) && styles.disabled,
      ]}
      accessibilityLabel={t('mesajV2.tapToRecord')}
      accessibilityRole="button"
    >
      {baslatiliyor ? (
        <ActivityIndicator color={RenkTokenlari.primarySoft} />
      ) : (
        <Ionicons name="mic" size={20} color={RenkTokenlari.primarySoft} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  micHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,64,145,0.35)',
  },
  disabled: { opacity: 0.45 },
  recBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 180,
    flex: 1,
  },
  metinBlok: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  recDot: { color: RenkTokenlari.danger, fontSize: 12 },
  recTime: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  recHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  ikonHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
