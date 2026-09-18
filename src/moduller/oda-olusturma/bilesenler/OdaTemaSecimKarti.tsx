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
import type { OdaTemaTanim } from '../katalog/OdaTemaKatalogu';

type Props = {
  tema: OdaTemaTanim;
  secili: boolean;
  onPress: () => void;
};

export function OdaTemaSecimKarti({ tema, secili, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <View style={[styles.kart, secili && { borderColor: `${tema.vurgu}99` }]}>
        <LinearGradient
          colors={[...tema.renkler]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.onizleme}
        >
          <View style={[styles.vurguLeke, { backgroundColor: `${tema.vurgu}55` }]} />
          {secili ? (
            <View style={[styles.secili, { backgroundColor: tema.vurgu }]}>
              <Ionicons name="checkmark" size={14} color={RenkTokenlari.textOnPrimary} />
            </View>
          ) : null}
        </LinearGradient>
        <View style={styles.copy}>
          <Text style={styles.ad}>{tema.ad}</Text>
          <Text style={styles.alt} numberOfLines={1}>
            {tema.alt}
          </Text>
          <Text style={[styles.kod, secili && { color: tema.vurgu }]}>{tema.kod}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  pressed: { opacity: 0.92 },
  kart: {
    flexDirection: 'row',
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    minHeight: 88,
  },
  onizleme: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vurguLeke: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  secili: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    padding: BoslukTokenlari.md,
    justifyContent: 'center',
    gap: 2,
  },
  ad: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  kod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    letterSpacing: 0.7,
    marginTop: 4,
  },
});
