import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfilAvatarKucuk } from './ProfilAvatarKucuk';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

export type CanliSohbetMesajGorunum = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
};

type Props = {
  item: CanliSohbetMesajGorunum;
  mine?: boolean;
  onLongPress?: () => void;
  /** live: TikTok/Twitch/YouTube — kompakt, okunabilir overlay */
  varyant?: 'kart' | 'live';
};

/**
 * Canli yorum satiri.
 * live: isim renkli + mesaj tek akista (Twitch/YT), hafif arka plan.
 */
export function CanliSohbetMesajKarti({
  item,
  mine,
  onLongPress,
  varyant = 'kart',
}: Props) {
  const ad =
    item.display_name?.trim() ||
    item.username?.trim() ||
    'Kullanıcı';

  if (varyant === 'live') {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[styles.liveRow, mine && styles.liveRowMine]}
      >
        <ProfilAvatarKucuk
          size={22}
          displayName={item.display_name}
          username={item.username}
          avatarUrl={item.avatar_url}
        />
        <Text style={styles.liveText}>
          <Text style={[styles.liveAd, mine && styles.liveAdMine]}>{ad} </Text>
          <Text style={styles.liveBody}>{item.body}</Text>
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.kart, mine && styles.kartMine]}
    >
      <ProfilAvatarKucuk
        size={34}
        displayName={item.display_name}
        username={item.username}
        avatarUrl={item.avatar_url}
      />
      <View style={styles.body}>
        <Text style={[styles.ad, mine && styles.adMine]} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={styles.mesaj}>{item.body}</Text>
      </View>
    </Pressable>
  );
}

/** Ustten soft fade — yorumlar sahne uzerinde kaybolmasin */
export function CanliSohbetListeFade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(18,16,24,0.85)', 'rgba(18,16,24,0)']}
      style={styles.fade}
    />
  );
}

const styles = StyleSheet.create({
  liveRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 6, 14, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: '92%',
  },
  liveRowMine: {
    backgroundColor: 'rgba(232, 64, 145, 0.22)',
    borderColor: 'rgba(232, 64, 145, 0.32)',
  },
  liveText: {
    flexShrink: 1,
    ...TipografiTokenlari.body,
    fontSize: 13,
    lineHeight: 18,
  },
  liveAd: {
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 13,
  },
  liveAdMine: {
    color: RenkTokenlari.primarySoft,
  },
  liveBody: {
    color: RenkTokenlari.text,
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
  },
  kart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(18, 16, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    maxWidth: '100%',
  },
  kartMine: {
    borderColor: 'rgba(232, 64, 145, 0.28)',
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  ad: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '800',
  },
  adMine: { color: RenkTokenlari.primarySoft },
  mesaj: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 20,
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    zIndex: 2,
  },
});
