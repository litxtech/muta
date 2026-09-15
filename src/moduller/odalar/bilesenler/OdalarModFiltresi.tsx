import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { RoomMode } from '../../../types/models';

export type OdalarFiltre = 'all' | RoomMode;

type FiltreSecenek = {
  id: OdalarFiltre;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconAktif: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const SECENEKLER: FiltreSecenek[] = [
  {
    id: 'all',
    label: 'Tümü',
    icon: 'apps-outline',
    iconAktif: 'apps',
    tint: RenkTokenlari.primarySoft,
  },
  {
    id: 'party',
    label: 'Parti',
    icon: 'sparkles-outline',
    iconAktif: 'sparkles',
    tint: RenkTokenlari.magenta,
  },
  {
    id: 'dating',
    label: 'Flört',
    icon: 'heart-outline',
    iconAktif: 'heart',
    tint: RenkTokenlari.primary,
  },
  {
    id: 'karaoke',
    label: 'Karaoke',
    icon: 'mic-outline',
    iconAktif: 'mic',
    tint: RenkTokenlari.violet,
  },
  {
    id: 'game',
    label: 'Oyun',
    icon: 'game-controller-outline',
    iconAktif: 'game-controller',
    tint: RenkTokenlari.mint,
  },
  {
    id: 'private',
    label: 'Özel',
    icon: 'lock-closed-outline',
    iconAktif: 'lock-closed',
    tint: RenkTokenlari.accent,
  },
];

type Props = {
  secili: OdalarFiltre;
  onSec: (filtre: OdalarFiltre) => void;
};

/** Kompakt, renkli mod chip’leri */
export function OdalarModFiltresi({ secili, onSec }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
    >
      {SECENEKLER.map((secenek) => {
        const aktif = secili === secenek.id;
        return (
          <Pressable
            key={secenek.id}
            onPress={() => onSec(secenek.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: aktif ? `${secenek.tint}28` : RenkTokenlari.bgCard,
                borderColor: aktif ? `${secenek.tint}88` : RenkTokenlari.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.ikon,
                { backgroundColor: aktif ? `${secenek.tint}33` : `${secenek.tint}14` },
              ]}
            >
              <Ionicons
                name={aktif ? secenek.iconAktif : secenek.icon}
                size={12}
                color={secenek.tint}
              />
            </View>
            <Text
              style={[
                styles.yazi,
                { color: aktif ? secenek.tint : RenkTokenlari.textMuted },
                aktif && styles.yaziAktif,
              ]}
            >
              {secenek.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serit: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: 6,
    paddingBottom: BoslukTokenlari.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 5,
    paddingRight: 9,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
  },
  pressed: { opacity: 0.85 },
  ikon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yazi: {
    ...TipografiTokenlari.micro,
    fontSize: 11,
    letterSpacing: 0.1,
    fontWeight: '600',
  },
  yaziAktif: {
    fontWeight: '800',
  },
});
