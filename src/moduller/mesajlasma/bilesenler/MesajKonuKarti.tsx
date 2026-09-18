import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { MesajKonusu } from '../okuma/MesajKonulariniGetir';
import { MaviTikRozeti } from './MaviTikRozeti';

type Props = {
  konu: MesajKonusu;
  onPress: () => void;
  onLongPress?: () => void;
};

function formatZaman(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Dün';
  }
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

/** Inbox — Telegram tarzi: avatar + isim + onizleme + okunmamis */
export function MesajKonuKarti({ konu, onPress, onLongPress }: Props) {
  const mahkeme = konu.thread_kind === 'mahkeme';
  const ad =
    (mahkeme ? konu.thread_title || konu.peer_display_name : null)?.trim() ||
    konu.peer_display_name?.trim() ||
    konu.peer_username?.trim() ||
    'Kullanıcı';
  const onizleme = konu.last_message_preview?.trim() || 'Yeni sohbet';
  const zaman = formatZaman(konu.last_message_at);
  const unread = konu.unread_count ?? 0;
  const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
  const maviTik =
    !!konu.peer_is_platform_official ||
    mahkeme ||
    (!!konu.peer_is_verified && mahkeme);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <View style={styles.kart}>
        {konu.peer_avatar_url ? (
          <Image source={{ uri: konu.peer_avatar_url }} style={styles.avatarImg} />
        ) : (
          <LinearGradient
            colors={
              mahkeme
                ? (['#4DA3FF', '#1D6FE8'] as [string, string])
                : [...RenkTokenlari.gradientPrimary]
            }
            style={styles.avatar}
          >
            <Text style={styles.avatarYazi}>{mahkeme ? '⚖' : harf}</Text>
          </LinearGradient>
        )}

        <View style={styles.copy}>
          <View style={styles.ust}>
            <View style={styles.adSatir}>
              <Text style={styles.ad} numberOfLines={1}>
                {ad}
              </Text>
              {maviTik ? <MaviTikRozeti size={15} /> : null}
              {konu.closed_at ? (
                <Text style={styles.kapali}>Kapalı</Text>
              ) : null}
            </View>
            {zaman ? (
              <Text style={[styles.zaman, unread > 0 && styles.zamanUnread]}>
                {zaman}
              </Text>
            ) : null}
          </View>
          <View style={styles.alt}>
            <Text
              style={[styles.onizleme, unread > 0 && styles.onizlemeUnread]}
              numberOfLines={1}
            >
              {onizleme}
            </Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={RenkTokenlari.textDim}
              />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  pressed: { opacity: 0.88 },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.sm,
    minHeight: 72,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarYazi: {
    ...TipografiTokenlari.h2,
    color: '#12040C',
    fontSize: 20,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  adSatir: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  ad: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
    flexShrink: 1,
  },
  kapali: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontWeight: '700',
    fontSize: 10,
  },
  zaman: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  zamanUnread: { color: RenkTokenlari.mint, fontWeight: '700' },
  alt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onizleme: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  onizlemeUnread: {
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: RenkTokenlari.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: '#0A1210',
    fontWeight: '800',
    fontSize: 11,
  },
});
