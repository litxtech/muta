import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  text?: string | null;
  tags?: string[];
};

export function BannerBadge({ text, tags }: Props) {
  const items = [
    ...(text ? [text] : []),
    ...(tags ?? []).slice(0, 2),
  ];
  if (items.length === 0) return null;

  return (
    <View style={styles.row} accessibilityRole="text">
      {items.map((t) => (
        <View key={t} style={styles.badge}>
          <Text style={styles.text} numberOfLines={1}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: BoslukTokenlari.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(232,64,145,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.35)',
  },
  text: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
