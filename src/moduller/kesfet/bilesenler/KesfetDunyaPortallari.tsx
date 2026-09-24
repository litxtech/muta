import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { KesfetBolumBasligi } from './KesfetBolumBasligi';
import { useCeviri } from '../../../i18n/useCeviri';

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
  const { t } = useCeviri();
  return (
    <View style={styles.wrap}>
      <View style={styles.baslikPad}>
        <KesfetBolumBasligi baslik={t('kesfet.dunyalar')} alt={t('kesfet.dunyalarAlt')} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {portallar.map((portal) => (
          <Pressable
            key={portal.key}
            onPress={() => onSec(portal.href)}
            style={styles.item}
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
