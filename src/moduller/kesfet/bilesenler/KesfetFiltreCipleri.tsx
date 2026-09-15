import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type KesfetCipi = {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props = {
  cipler: KesfetCipi[];
  aktifId: string | null;
  onSec: (id: string) => void;
};

/** Keşfet — yatay kaydırılan ikonlu filtre çipleri */
export function KesfetFiltreCipleri({ cipler, aktifId, onSec }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {cipler.map((cip) => {
        const aktif = aktifId === cip.id;
        return (
          <Pressable
            key={cip.id}
            onPress={() => onSec(cip.id)}
            style={({ pressed }) => [styles.cip, pressed && styles.basili]}
            accessibilityRole="button"
            accessibilityState={{ selected: aktif }}
          >
            {aktif ? (
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ic}
              >
                {cip.icon ? (
                  <Ionicons name={cip.icon} size={13} color="#12040C" />
                ) : null}
                <Text style={styles.yaziAktif}>{cip.label}</Text>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={[RenkTokenlari.bgElevated, RenkTokenlari.bgElevated]}
                style={[styles.ic, styles.icPasif]}
              >
                {cip.icon ? (
                  <Ionicons name={cip.icon} size={13} color={RenkTokenlari.textMuted} />
                ) : null}
                <Text style={styles.yazi}>{cip.label}</Text>
              </LinearGradient>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.sm,
    gap: BoslukTokenlari.sm,
  },
  cip: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  basili: {
    opacity: 0.85,
  },
  ic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
  },
  icPasif: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  yaziAktif: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
});
