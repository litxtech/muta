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

/**
 * Ortak üst bar: geri + ortalı başlık + opsiyonel sağ aksiyon.
 * Başlık absolute ortalı — butonlarla iç içe binmez.
 */
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
        <View style={styles.yanSol}>
          {showBack ? (
            <Pressable
              style={styles.backBtn}
              onPress={onBack ?? (() => guvenliGeriDon(fallbackHref))}
              hitSlop={8}
              accessibilityLabel="Geri"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={RenkTokenlari.text}
              />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        <View style={styles.merkez} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.yanSag}>
          {right ?? <View style={styles.backBtn} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.xs,
    paddingBottom: BoslukTokenlari.sm,
    zIndex: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    position: 'relative',
  },
  yanSol: {
    minWidth: 44,
    zIndex: 2,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  yanSag: {
    minWidth: 44,
    marginLeft: 'auto',
    zIndex: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merkez: {
    position: 'absolute',
    left: 52,
    right: 52,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    maxWidth: '100%',
  },
  sub: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 2,
    maxWidth: '100%',
  },
});
