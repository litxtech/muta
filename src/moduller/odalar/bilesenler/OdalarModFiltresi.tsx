import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { RoomMode } from '../../../types/models';
import { useCeviri, type CeviriAnahtari } from '../../../i18n/useCeviri';

export type OdalarFiltre = 'all' | RoomMode;

type FiltreSecenek = {
  id: OdalarFiltre;
  label: CeviriAnahtari;
  icon: keyof typeof Ionicons.glyphMap;
  iconAktif: keyof typeof Ionicons.glyphMap;
  tint: string;
};

const SECENEKLER: FiltreSecenek[] = [
  {
    id: 'all',
    label: 'modlar.tumu',
    icon: 'apps-outline',
    iconAktif: 'apps',
    tint: RenkTokenlari.primarySoft,
  },
  {
    id: 'party',
    label: 'modlar.parti',
    icon: 'sparkles-outline',
    iconAktif: 'sparkles',
    tint: RenkTokenlari.magenta,
  },
  {
    id: 'dating',
    label: 'modlar.flort',
    icon: 'heart-outline',
    iconAktif: 'heart',
    tint: RenkTokenlari.primary,
  },
  {
    id: 'karaoke',
    label: 'modlar.karaoke',
    icon: 'mic-outline',
    iconAktif: 'mic',
    tint: RenkTokenlari.violet,
  },
  {
    id: 'game',
    label: 'modlar.oyun',
    icon: 'game-controller-outline',
    iconAktif: 'game-controller',
    tint: RenkTokenlari.mint,
  },
  {
    id: 'private',
    label: 'modlar.ozel',
    icon: 'lock-closed-outline',
    iconAktif: 'lock-closed',
    tint: RenkTokenlari.accent,
  },
];

type Props = {
  secili: OdalarFiltre;
  onSec: (filtre: OdalarFiltre) => void;
};

/** Küçük, yuvarlak (avatar tarzı) mod filtreleri */
export function OdalarModFiltresi({ secili, onSec }: Props) {
  const { t } = useCeviri();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.serit}
    >
      {SECENEKLER.map((secenek) => {
        const aktif = secili === secenek.id;
        return (
          <Pressable
            key={secenek.id}
            onPress={() => onSec(secenek.id)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
            accessibilityLabel={t(secenek.label)}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: aktif ? `${secenek.tint}30` : RenkTokenlari.bgCard,
                  borderColor: aktif ? secenek.tint : RenkTokenlari.border,
                },
              ]}
            >
              <Ionicons
                name={aktif ? secenek.iconAktif : secenek.icon}
                size={16}
                color={aktif ? secenek.tint : RenkTokenlari.textMuted}
              />
            </View>
            <Text
              style={[
                styles.etiket,
                { color: aktif ? secenek.tint : RenkTokenlari.textMuted },
                aktif && styles.etiketAktif,
              ]}
              numberOfLines={1}
            >
              {t(secenek.label)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** Yatay ScrollView flex:1 almasın — oda avatarları aşağı kaymasın */
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  serit: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
    paddingTop: 0,
    paddingBottom: 2,
    alignItems: 'flex-start',
  },
  item: {
    width: 52,
    alignItems: 'center',
    gap: 5,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
    letterSpacing: 0.1,
    fontWeight: '600',
    textAlign: 'center',
  },
  etiketAktif: {
    fontWeight: '800',
  },
});
