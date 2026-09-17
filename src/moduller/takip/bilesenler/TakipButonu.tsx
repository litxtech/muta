import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { TakipIliskiDurumu } from '../TakipTipleri';

type Varyant = 'follow' | 'following' | 'requested' | 'blocked' | 'message';

function varyantAl(state: TakipIliskiDurumu | string): Varyant {
  if (state === 'BLOCKED' || state === 'BLOCKED_BY_USER') return 'blocked';
  if (state === 'FOLLOWING' || state === 'MUTUAL') return 'following';
  if (state === 'REQUEST_PENDING') return 'requested';
  return 'follow';
}

export function TakipButonu({
  state,
  displayName,
  loading,
  onPress,
  compact,
}: {
  state: TakipIliskiDurumu | string;
  displayName?: string;
  loading?: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const v = varyantAl(state);
  if (v === 'blocked') return null;

  const label =
    v === 'following'
      ? 'Takip Ediliyor'
      : v === 'requested'
        ? 'İstek Gönderildi'
        : 'Takip Et';

  const a11y =
    v === 'following'
      ? `${displayName ?? 'Kullanıcı'} takip ediliyor`
      : v === 'requested'
        ? `${displayName ?? 'Kullanıcı'} için takip isteği gönderildi`
        : `${displayName ?? 'Kullanıcı'} kullanıcısını takip et`;

  const icerik = loading ? (
    <ActivityIndicator color={v === 'follow' ? '#fff' : RenkTokenlari.text} />
  ) : (
    <Text
      style={[
        styles.yazi,
        v === 'follow' ? styles.yaziOn : styles.yaziOff,
        compact && styles.yaziCompact,
      ]}
    >
      {label}
    </Text>
  );

  if (v === 'follow') {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [compact ? styles.compact : styles.full, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={[...RenkTokenlari.gradientPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.grad, compact && styles.gradCompact]}
        >
          {icerik}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        compact ? styles.compact : styles.full,
        styles.outline,
        pressed && styles.pressed,
      ]}
    >
      {icerik}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%', borderRadius: YaricapTokenlari.pill, overflow: 'hidden' },
  compact: {
    minWidth: 108,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  grad: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  gradCompact: {
    paddingVertical: 8,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 36,
  },
  outline: {
    paddingVertical: 11,
    paddingHorizontal: BoslukTokenlari.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  yazi: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
  },
  yaziCompact: { ...TipografiTokenlari.caption, fontWeight: '800' },
  yaziOn: { color: '#fff' },
  yaziOff: { color: RenkTokenlari.text },
  pressed: { opacity: 0.85 },
});

void View;
