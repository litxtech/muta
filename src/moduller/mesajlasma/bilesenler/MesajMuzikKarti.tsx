import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MesajSesYoneticisi } from '../ses/MesajSesYoneticisi';
import { mesajKartCamStil, MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { MsSureFormat } from '../../ai-muzik/utils/SureFormat';
import { useCeviri } from '../../../i18n/useCeviri';
import { AiMuzikParcaDetay } from '../../ai-muzik/islemler/AiMuzikApi';
import { MedyaUriGuvenli } from '../yardimcilar/MedyaUriGecerliMi';

type Props = {
  messageId: string;
  musicTrackId?: string | null;
  snapshot?: {
    title?: string;
    cover_url?: string | null;
    artist_name?: string;
    duration_ms?: number | null;
  } | null;
  mediaUrl?: string | null;
  mine: boolean;
  onLongPress?: () => void;
};

export function MesajMuzikKarti({
  messageId,
  musicTrackId,
  snapshot,
  mediaUrl,
  mine,
  onLongPress,
}: Props) {
  const { t } = useCeviri();
  const [, tick] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(
    MedyaUriGuvenli(mediaUrl),
  );

  useEffect(() => MesajSesYoneticisi.aboneOl(() => tick((x) => x + 1)), []);

  useEffect(() => {
    if (audioUrl || !musicTrackId) return;
    let iptal = false;
    void AiMuzikParcaDetay(musicTrackId)
      .then((d) => {
        if (iptal) return;
        const u = MedyaUriGuvenli(d.track.audio_url);
        if (u) setAudioUrl(u);
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [musicTrackId, audioUrl]);

  const aktif = MesajSesYoneticisi.aktifAnahtar() === messageId;
  const caliyor = aktif && MesajSesYoneticisi.caliyorMu(messageId);
  const title = snapshot?.title || t('mesajV2.music');
  const artist = snapshot?.artist_name || '';
  const cover = MedyaUriGuvenli(snapshot?.cover_url);
  const metinRenk = mine
    ? MesajKartTokenlari.textMine
    : MesajKartTokenlari.textTheirs;
  const muted = mine
    ? MesajKartTokenlari.mutedMine
    : MesajKartTokenlari.mutedTheirs;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.kart, mesajKartCamStil(mine)]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverBos]}>
          <Ionicons name="musical-notes" size={22} color={metinRenk} />
        </View>
      )}
      <View style={styles.govde}>
        <Text style={[styles.title, { color: metinRenk }]} numberOfLines={1}>
          {title}
        </Text>
        {artist ? (
          <Text style={[styles.artist, { color: muted }]} numberOfLines={1}>
            {artist}
          </Text>
        ) : null}
        <Text style={[styles.sure, { color: muted }]}>
          {MsSureFormat(snapshot?.duration_ms)}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          if (!audioUrl) return;
          void MesajSesYoneticisi.cal(messageId, audioUrl);
        }}
        style={styles.play}
        disabled={!audioUrl}
        accessibilityRole="button"
        accessibilityLabel={t('mesajV2.music')}
      >
        <Ionicons
          name={caliyor ? 'pause' : 'play'}
          size={22}
          color={metinRenk}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: MesajKartTokenlari.radiusInner,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  coverBos: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  govde: { flex: 1, gap: 2 },
  title: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    fontSize: 14,
  },
  artist: {
    ...TipografiTokenlari.caption,
  },
  sure: {
    ...TipografiTokenlari.micro,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
});
