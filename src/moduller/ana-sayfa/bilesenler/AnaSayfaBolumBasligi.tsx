import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  baslik: string;
  altBaslik?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
};

export function AnaSayfaBolumBasligi({ baslik, altBaslik, onSeeAll, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titles}>
          <View style={styles.titleRow}>
            <View style={styles.accent} />
            <Text style={styles.title}>{baslik}</Text>
          </View>
          {altBaslik ? <Text style={styles.sub}>{altBaslik}</Text> : null}
        </View>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={8}>
            <Text style={styles.seeAll}>Tümü</Text>
            <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.primarySoft} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: BoslukTokenlari.md, marginBottom: BoslukTokenlari.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
  },
  titles: { flex: 1, gap: 4, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    letterSpacing: -0.3,
  },
  sub: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginLeft: 11,
    letterSpacing: 0.4,
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
