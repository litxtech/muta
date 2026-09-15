import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  /** Geri gecmisi yoksa donulecek rota (varsayilan: profil) */
  fallbackHref?: Href;
};

/**
 * Stack ekranlarinda once dismiss / back dener;
 * tab sifirlanmasin diye gerekirse profil (veya fallback) acilir.
 */
export function guvenliGeriDon(fallbackHref: Href = '/(tabs)/profile') {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallbackHref);
}

/** Ortak üst bar: geri + başlık + opsiyonel sağ aksiyon */
export function EkranBasligi({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  fallbackHref = '/(tabs)/profile',
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        {showBack ? (
          <Pressable
            style={styles.backBtn}
            onPress={onBack ?? (() => guvenliGeriDon(fallbackHref))}
            hitSlop={8}
            accessibilityLabel="Geri"
          >
            <Ionicons name="chevron-back" size={24} color={RenkTokenlari.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right ?? <View style={styles.backBtn} />}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.xs,
    paddingBottom: BoslukTokenlari.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: BoslukTokenlari.sm,
  },
  title: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    textAlign: 'center',
  },
  sub: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});
