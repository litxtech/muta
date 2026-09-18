import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  altYazi: string;
  sohbetSayisi: number;
  onYeniSohbet: () => void;
};

export function MesajMarkaBasligi({ altYazi, sohbetSayisi, onYeniSohbet }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ust}>
        <View style={styles.markaBlok}>
          <Text style={styles.fisilti}>SOHBET</Text>
          <Text style={styles.baslik}>Mesajlar</Text>
          <Text style={styles.alt}>{altYazi}</Text>
        </View>
        <Pressable
          onPress={onYeniSohbet}
          accessibilityLabel="Yeni sohbet"
          style={({ pressed }) => [styles.composeHit, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            style={styles.compose}
          >
            <Ionicons name="create-outline" size={20} color={RenkTokenlari.textOnPrimary} />
          </LinearGradient>
        </Pressable>
      </View>
      {sohbetSayisi > 0 ? (
        <View style={styles.sayac}>
          <View style={styles.accent} />
          <Text style={styles.sayacYazi}>Aktif sohbet</Text>
          <Text style={styles.sayacSayi}>{sohbetSayisi}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.md,
  },
  markaBlok: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.6,
    fontSize: 10,
    lineHeight: 13,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    letterSpacing: -0.5,
    fontSize: 28,
    lineHeight: 34,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  composeHit: {},
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  compose: {
    width: 48,
    height: 48,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sayac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  sayacYazi: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    flex: 1,
    fontSize: 16,
  },
  sayacSayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
});
