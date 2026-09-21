import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { FikirKategori } from '../tipler';

export function FikirKategoriSecici({
  kategoriler,
  seciliId,
  onSec,
}: {
  kategoriler: FikirKategori[];
  seciliId: string | null;
  onSec: (k: FikirKategori) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
    >
      {kategoriler.map((k) => {
        const secili = k.id === seciliId;
        return (
          <Pressable
            key={k.id}
            onPress={() => onSec(k)}
            style={[styles.chip, secili && styles.chipSecili]}
          >
            <Ionicons
              name={(k.icon as keyof typeof Ionicons.glyphMap) || 'bulb-outline'}
              size={16}
              color={secili ? RenkTokenlari.textOnPrimary : RenkTokenlari.textMuted}
            />
            <Text
              style={[styles.yazi, secili && styles.yaziSecili]}
              numberOfLines={1}
            >
              {k.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serit: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: BoslukTokenlari.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  chipSecili: {
    backgroundColor: RenkTokenlari.primarySoft,
    borderColor: RenkTokenlari.primarySoft,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  yaziSecili: { color: RenkTokenlari.textOnPrimary },
});
