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
import type { OdaModTanim } from '../katalog/OdaModKatalogu';

type Props = {
  mod: OdaModTanim;
  secili: boolean;
  onPress: () => void;
};

/** Instagram tile — büyük, görsel ağırlıklı oda mod kartı */
export function OdaModSecimKarti({ mod, secili, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: secili }}
      accessibilityLabel={mod.ad}
    >
      <LinearGradient
        colors={
          secili
            ? [`${mod.tint}AA`, `${mod.tint}44`, 'rgba(12,8,20,0.95)']
            : [`${mod.tint}38`, 'rgba(28,22,40,0.96)', 'rgba(14,10,22,0.98)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.kart,
          secili && {
            borderColor: mod.tint,
            borderWidth: 2,
          },
        ]}
      >
        <View style={[styles.ikon, { backgroundColor: `${mod.tint}33` }]}>
          <Ionicons name={mod.icon} size={30} color={mod.tint} />
        </View>

        <View style={styles.metin}>
          <Text style={styles.ad}>{mod.ad}</Text>
          <Text style={styles.alt} numberOfLines={2}>
            {mod.alt}
          </Text>
        </View>

        {secili ? (
          <View style={[styles.seciliRozet, { backgroundColor: mod.tint }]}>
            <Ionicons name="checkmark" size={14} color="#12040C" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    width: '100%',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  kart: {
    minHeight: 148,
    borderRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: BoslukTokenlari.md,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  ikon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metin: {
    gap: 4,
  },
  ad: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 17,
  },
  seciliRozet: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
