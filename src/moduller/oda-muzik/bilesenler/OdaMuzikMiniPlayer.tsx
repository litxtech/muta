import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { RoomMusicSession } from '../islemler/OdaMuzikApi';
import { msMetni } from '../islemler/OdaMuzikApi';
import { OdaMuzikPozisyonMs } from '../oynatici/OdaMuzikOynatici';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

type Props = {
  session: RoomMusicSession | null;
  canManage: boolean;
  onOpenLibrary: () => void;
  onPause: () => void;
  onResume: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLocalVolume: () => void;
};

export function OdaMuzikMiniPlayer({
  session,
  canManage,
  onOpenLibrary,
  onPause,
  onResume,
  onPrev,
  onNext,
  onLocalVolume,
}: Props) {
  const [, tick] = useState(0);
  React.useEffect(() => {
    if (session?.state !== 'PLAYING') return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [session?.state]);

  if (!session?.track || session.state === 'STOPPED') return null;

  const cover = MedyaUriGuvenli(session.track.cover_url);
  const pos =
    session.state === 'PLAYING'
      ? OdaMuzikPozisyonMs()
      : session.position_ms || 0;
  const dur = session.track.duration_ms || 0;

  return (
    <Pressable style={styles.wrap} onPress={onOpenLibrary}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(20,16,28,0.55)', 'rgba(12,10,18,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverBos]}>
            <Ionicons name="musical-notes" size={14} color={RenkTokenlari.primarySoft} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {session.track.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {session.track.artist_name || 'Tamuso Music'} · {msMetni(pos)}
            {dur ? ` / ${msMetni(dur)}` : ''}
          </Text>
        </View>
        {canManage ? (
          <View style={styles.ctrls}>
            <Pressable
              onPress={onPrev}
              hitSlop={8}
              accessibilityLabel="Önceki"
            >
              <Ionicons name="play-skip-back" size={18} color={RenkTokenlari.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                if (session.state === 'PLAYING') onPause();
                else onResume();
              }}
              hitSlop={8}
              accessibilityLabel={session.state === 'PLAYING' ? 'Duraklat' : 'Oynat'}
            >
              <Ionicons
                name={session.state === 'PLAYING' ? 'pause' : 'play'}
                size={20}
                color={RenkTokenlari.primarySoft}
              />
            </Pressable>
            <Pressable
              onPress={onNext}
              hitSlop={8}
              accessibilityLabel="Sonraki"
            >
              <Ionicons name="play-skip-forward" size={18} color={RenkTokenlari.text} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onLocalVolume}
            hitSlop={8}
            accessibilityLabel="Müzik sesi"
          >
            <Ionicons name="volume-medium-outline" size={20} color={RenkTokenlari.text} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.md,
    marginBottom: 6,
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cover: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: RenkTokenlari.surface,
  },
  coverBos: { alignItems: 'center', justifyContent: 'center' },
  title: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  ctrls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
