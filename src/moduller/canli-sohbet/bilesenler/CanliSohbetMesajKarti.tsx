import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfilAvatarKucuk } from './ProfilAvatarKucuk';
import { SeviyeTaci } from '../../ses-odalari/bilesenler/SeviyeTaci';
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
  level?: number | null;
};

type Props = {
  item: CanliSohbetMesajGorunum;
  mine?: boolean;
  onLongPress?: () => void;
  /** Avatar / isme kısa tık — profil sheet */
  onProfilPress?: (item: CanliSohbetMesajGorunum) => void;
  /** live: TikTok/Twitch/YouTube — kompakt, okunabilir overlay */
  varyant?: 'kart' | 'live';
};

function yorumZamani(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const sn = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sn < 45) return 'şimdi';
  if (sn < 3600) return `${Math.floor(sn / 60)} dk`;
  if (sn < 86400) return `${Math.floor(sn / 3600)} sa`;
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Canli yorum satiri.
 * live: avatar + seviye tacı + isim + zaman + mesaj.
 */
export function CanliSohbetMesajKarti({
  item,
  mine,
  onLongPress,
  onProfilPress,
  varyant = 'kart',
}: Props) {
  const ad =
    item.display_name?.trim() ||
    item.username?.trim() ||
    'Kullanıcı';
  const seviye = typeof item.level === 'number' ? item.level : 0;
  const zaman = useMemo(() => yorumZamani(item.created_at), [item.created_at]);

  if (varyant === 'live') {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[styles.liveRow, mine && styles.liveRowMine]}
      >
        <Pressable
          onPress={onProfilPress ? () => onProfilPress(item) : undefined}
          onLongPress={onLongPress}
          delayLongPress={350}
          style={styles.liveAvatarWrap}
          accessibilityRole="button"
          accessibilityLabel={`${ad} profili`}
        >
          <SeviyeTaci level={seviye} size="sm" avatarBoy={32}>
            <ProfilAvatarKucuk
              size={32}
              displayName={item.display_name}
              username={item.username}
              avatarUrl={item.avatar_url}
            />
          </SeviyeTaci>
        </Pressable>
        <View style={styles.liveGovde}>
          <View style={styles.liveUst}>
            <Pressable
              onPress={onProfilPress ? () => onProfilPress(item) : undefined}
              onLongPress={onLongPress}
              delayLongPress={350}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`${ad} profili`}
            >
              <Text
                style={[styles.liveAd, mine && styles.liveAdMine]}
                numberOfLines={1}
              >
                {ad}
              </Text>
            </Pressable>
            {zaman ? <Text style={styles.liveZaman}>{zaman}</Text> : null}
          </View>
          <Text style={styles.liveBody}>{item.body}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[styles.kart, mine && styles.kartMine]}
    >
      <Pressable
        onPress={onProfilPress ? () => onProfilPress(item) : undefined}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={styles.kartAvatarWrap}
        accessibilityRole="button"
        accessibilityLabel={`${ad} profili`}
      >
        <SeviyeTaci level={seviye} size="sm" avatarBoy={34}>
          <ProfilAvatarKucuk
            size={34}
            displayName={item.display_name}
            username={item.username}
            avatarUrl={item.avatar_url}
          />
        </SeviyeTaci>
      </Pressable>
      <View style={styles.body}>
        <View style={styles.liveUst}>
          <Pressable
            onPress={onProfilPress ? () => onProfilPress(item) : undefined}
            onLongPress={onLongPress}
            delayLongPress={350}
            hitSlop={4}
          >
            <Text style={[styles.ad, mine && styles.adMine]} numberOfLines={1}>
              {ad}
            </Text>
          </Pressable>
          {zaman ? <Text style={styles.liveZaman}>{zaman}</Text> : null}
        </View>
        <Text style={styles.mesaj}>{item.body}</Text>
      </View>
    </Pressable>
  );
}

/** Ustten soft fade — yorumlar panel icinde kaybolmasin */
export function CanliSohbetListeFade() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(12,10,18,0.95)', 'rgba(12,10,18,0)']}
      style={styles.fade}
    />
  );
}

const styles = StyleSheet.create({
  liveRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
    paddingHorizontal: 2,
    maxWidth: '96%',
  },
  liveRowMine: {
    opacity: 1,
  },
  liveAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  kartAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveGovde: {
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  liveUst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  liveAd: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 14,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  liveAdMine: {
    color: RenkTokenlari.primarySoft,
  },
  liveZaman: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
    fontSize: 11,
  },
  liveBody: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    flexShrink: 1,
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
