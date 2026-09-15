/**
 * Oyun lobisi — oyuncu listesi + geri sayım.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { GameSessionPlayer } from '../tipler/OyunTipleri';

type Props = {
  title: string;
  players: GameSessionPlayer[];
  maxPlayers: number;
  countdownSeconds: number | null;
  isHost?: boolean;
  minPlayers?: number;
  onStartNow?: () => void;
  onIptal?: () => void;
};

export function OyunLobisi({
  title,
  players,
  maxPlayers,
  countdownSeconds,
  isHost,
  minPlayers = 1,
  onStartNow,
  onIptal,
}: Props) {
  const aktif = players.filter((p) => p.status !== 'left' && p.status !== 'dnf');
  const baslatilabilir = aktif.length >= minPlayers;

  return (
    <View style={styles.wrap}>
      <View style={styles.ust}>
        <View style={styles.ustMetin}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            {baslatilabilir
              ? 'Hazırsan başlat — veya geri sayımı bekle.'
              : `En az ${minPlayers} oyuncu gerekli. Davetliler katılınca başlar.`}
          </Text>
        </View>
        {onIptal ? (
          <Pressable onPress={onIptal} style={styles.kapat} hitSlop={12}>
            <Text style={styles.kapatYazi}>Kapat</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.list}>
        {aktif.map((p) => (
          <View key={p.user_id} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(p.display_name ?? '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {p.display_name ?? 'Oyuncu'}
            </Text>
            <Text style={styles.check}>Hazır</Text>
          </View>
        ))}
        {aktif.length === 0 ? (
          <Text style={styles.bos}>Oyuncular yükleniyor…</Text>
        ) : null}
      </View>

      <Text style={styles.count}>
        {aktif.length} / {maxPlayers} oyuncu
      </Text>

      {countdownSeconds != null && baslatilabilir ? (
        <Text style={styles.countdown}>{countdownSeconds}</Text>
      ) : null}

      {isHost && onStartNow ? (
        <Pressable
          style={[styles.cta, !baslatilabilir && styles.ctaDisabled]}
          disabled={!baslatilabilir}
          onPress={onStartNow}
        >
          <Text style={styles.ctaText}>
            {baslatilabilir ? 'ŞİMDİ BAŞLAT' : 'OYUNCU BEKLENİYOR'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
    padding: BoslukTokenlari.xl,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.xl,
  },
  ustMetin: { flex: 1, minWidth: 0 },
  title: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
  },
  sub: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    marginTop: BoslukTokenlari.sm,
  },
  kapat: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  kapatYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  list: {
    gap: BoslukTokenlari.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.md,
    padding: BoslukTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: BoslukTokenlari.md,
  },
  avatarText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
  },
  name: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
  },
  check: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.success,
  },
  count: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginTop: BoslukTokenlari.lg,
  },
  countdown: {
    ...TipografiTokenlari.hero,
    color: RenkTokenlari.accent,
    textAlign: 'center',
    marginTop: BoslukTokenlari.xl,
  },
  cta: {
    marginTop: BoslukTokenlari.xxl,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.45,
    backgroundColor: RenkTokenlari.surface,
  },
  ctaText: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingVertical: BoslukTokenlari.md,
  },
});
