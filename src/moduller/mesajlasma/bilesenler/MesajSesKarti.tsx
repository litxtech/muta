import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MesajSesYoneticisi,
  type MesajSesHiz,
} from '../ses/MesajSesYoneticisi';
import { mesajKartCamStil, MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { SureFormat } from '../../ai-muzik/utils/SureFormat';
import { useCeviri } from '../../../i18n/useCeviri';
import { MedyaUriGuvenli } from '../yardimcilar/MedyaUriGecerliMi';

type Props = {
  messageId: string;
  mediaUrl?: string | null;
  durationMs?: number | null;
  waveform?: number[] | null;
  mine: boolean;
  onLongPress?: () => void;
};

const HIZLAR: MesajSesHiz[] = [1, 1.5, 2];

function varsayilanDalga(n = 28): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(0.25 + Math.abs(Math.sin(i * 0.7)) * 0.75);
  }
  return out;
}

export function MesajSesKarti({
  messageId,
  mediaUrl,
  durationMs,
  waveform,
  mine,
  onLongPress,
}: Props) {
  const { t } = useCeviri();
  const uri = MedyaUriGuvenli(mediaUrl);
  const [, tick] = useState(0);
  const bars = useMemo(
    () => (waveform?.length ? waveform : varsayilanDalga()),
    [waveform],
  );

  useEffect(() => MesajSesYoneticisi.aboneOl(() => tick((x) => x + 1)), []);

  const aktif = MesajSesYoneticisi.aktifAnahtar() === messageId;
  const caliyor = aktif && MesajSesYoneticisi.caliyorMu(messageId);
  const poz = aktif ? MesajSesYoneticisi.pozisyonSn() : 0;
  const sure =
    aktif && MesajSesYoneticisi.sureSn() > 0
      ? MesajSesYoneticisi.sureSn()
      : Math.max(0, (durationMs ?? 0) / 1000);
  const progress = sure > 0 ? Math.min(1, poz / sure) : 0;
  const hiz = MesajSesYoneticisi.hizAl();
  const metinRenk = mine
    ? MesajKartTokenlari.textMine
    : MesajKartTokenlari.textTheirs;
  const muted = mine
    ? MesajKartTokenlari.mutedMine
    : MesajKartTokenlari.mutedTheirs;

  if (!uri) {
    return (
      <View style={[styles.kart, mesajKartCamStil(mine)]}>
        <Text style={{ color: muted }}>{t('mesajlar.medyaYok')}</Text>
      </View>
    );
  }

  const oynat = () => {
    void MesajSesYoneticisi.cal(messageId, uri, { autoplaySirasi: true });
  };

  return (
    <Pressable
      onPress={oynat}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.kart, mesajKartCamStil(mine)]}
      accessibilityRole="button"
      accessibilityLabel={t('mesajV2.voice')}
    >
      <Pressable
        onPress={oynat}
        style={styles.play}
        accessibilityRole="button"
        accessibilityLabel={t('mesajV2.voice')}
      >
        <Ionicons
          name={caliyor ? 'pause' : 'play'}
          size={22}
          color={metinRenk}
        />
      </Pressable>

      <View style={styles.orta}>
        <Pressable
          style={styles.wave}
          onPress={(e) => {
            const w = e.nativeEvent.locationX;
            // yaklaşık seek — layoutWidth bilinmiyor; progress bar genişliği ~140
            const oran = Math.min(1, Math.max(0, w / 140));
            void MesajSesYoneticisi.seekVeOynat(oran * (sure || 1));
          }}
        >
          {bars.slice(0, 28).map((v, i) => {
            const filled = i / 28 <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: 8 + Math.max(0.15, Math.min(1, v)) * 18,
                    backgroundColor: filled
                      ? MesajKartTokenlari.waveformBar
                      : MesajKartTokenlari.waveformTrack,
                  },
                ]}
              />
            );
          })}
        </Pressable>
        <Text style={[styles.sure, { color: muted }]}>
          {SureFormat(caliyor || poz > 0 ? poz : sure)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          const idx = HIZLAR.indexOf(hiz);
          const next = HIZLAR[(idx + 1) % HIZLAR.length];
          void MesajSesYoneticisi.hizAyarla(next);
        }}
        style={styles.hiz}
        accessibilityRole="button"
        accessibilityLabel={t('mesajV2.speedNx', { n: hiz })}
      >
        <Text style={[styles.hizYazi, { color: metinRenk }]}>
          {t('mesajV2.speedNx', { n: hiz })}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  orta: { flex: 1, gap: 4 },
  wave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 2,
  },
  sure: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
  },
  hiz: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  hizYazi: {
    ...TipografiTokenlari.micro,
    fontWeight: '800',
  },
});
