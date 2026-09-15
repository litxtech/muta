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

export function OdaModSecimKarti({ mod, secili, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={
          secili
            ? [`${mod.tint}55`, `${mod.tint}18`]
            : ['rgba(42,36,56,0.95)', 'rgba(24,18,34,0.98)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.kart, secili && { borderColor: `${mod.tint}99` }]}
      >
        <View style={[styles.ikon, { backgroundColor: `${mod.tint}22`, borderColor: `${mod.tint}55` }]}>
          <Ionicons name={mod.icon} size={22} color={mod.tint} />
        </View>
        <Text style={styles.ad}>{mod.ad}</Text>
        <Text style={styles.alt} numberOfLines={1}>
          {mod.alt}
        </Text>
        <Text style={[styles.kod, secili && { color: mod.tint }]}>{mod.kod}</Text>
        {secili ? (
          <View style={[styles.seciliRozet, { backgroundColor: mod.tint }]}>
            <Ionicons name="checkmark" size={12} color="#12040C" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '47%', flexGrow: 1, maxWidth: '48.5%' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  kart: {
    minHeight: 132,
    borderRadius: YaricapTokenlari.md + 2,
    padding: BoslukTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 4,
    overflow: 'hidden',
  },
  ikon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  ad: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  kod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  seciliRozet: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
