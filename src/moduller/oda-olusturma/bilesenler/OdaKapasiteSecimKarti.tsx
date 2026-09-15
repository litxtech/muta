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
import type { OdaKapasiteTanim } from '../katalog/OdaKapasiteKatalogu';

type Props = {
  kapasite: OdaKapasiteTanim;
  secili: boolean;
  onPress: () => void;
};

export function OdaKapasiteSecimKarti({ kapasite, secili, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={
          secili
            ? ['rgba(232,64,145,0.28)', 'rgba(196,59,255,0.12)']
            : ['rgba(42,36,56,0.95)', 'rgba(24,18,34,0.98)']
        }
        style={[styles.kart, secili && styles.kartSecili]}
      >
        <View style={styles.ust}>
          <Text style={styles.ad}>{kapasite.ad}</Text>
          {secili ? (
            <Ionicons name="checkmark-circle" size={18} color={RenkTokenlari.primarySoft} />
          ) : null}
        </View>
        <Text style={styles.alt}>{kapasite.alt}</Text>
        <View style={styles.meta}>
          <View style={styles.metaChip}>
            <Ionicons name="people-outline" size={12} color={RenkTokenlari.primarySoft} />
            <Text style={styles.metaYazi}>{kapasite.dinleyici}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="mic-outline" size={12} color={RenkTokenlari.mint} />
            <Text style={styles.metaYazi}>{kapasite.mikrofon}</Text>
          </View>
        </View>
        <Text style={styles.kod}>{kapasite.kod}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  pressed: { opacity: 0.9 },
  kart: {
    borderRadius: YaricapTokenlari.md,
    padding: BoslukTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  kartSecili: {
    borderColor: RenkTokenlari.borderAccent,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ad: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  meta: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  metaYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
  },
  kod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
