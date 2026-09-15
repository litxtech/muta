import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { KesfetBolumBasligi } from './KesfetBolumBasligi';

export type KesfetPortal = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tint: string;
};

type Props = {
  portallar: KesfetPortal[];
  onSec: (href: string) => void;
};

/** Keşfet — platform dünyalarına hızlı portal şeridi */
export function KesfetDunyaPortallari({ portallar, onSec }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.baslikPad}>
        <KesfetBolumBasligi baslik="Dünyalar" alt="Platforma hızlı geçiş" />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {portallar.map((portal, index) => (
          <Animated.View
            key={portal.key}
            entering={FadeInRight.delay(60 + index * 50)
              .duration(AnimasyonTokenlari.normal)
              .springify()
              .damping(16)}
          >
            <Pressable
              onPress={() => onSec(portal.href)}
              style={({ pressed }) => [styles.item, pressed && styles.basili]}
              accessibilityRole="button"
              accessibilityLabel={portal.label}
            >
              <LinearGradient
                colors={[`${portal.tint}44`, `${portal.tint}14`]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[styles.ikon, { borderColor: `${portal.tint}55` }]}
              >
                <Ionicons name={portal.icon} size={20} color={portal.tint} />
              </LinearGradient>
              <Text style={styles.etiket} numberOfLines={1}>
                {portal.label}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.sm,
  },
  baslikPad: {
    paddingHorizontal: BoslukTokenlari.lg,
  },
  serit: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.xs,
  },
  item: {
    width: 68,
    alignItems: 'center',
    gap: 8,
  },
  basili: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  ikon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
