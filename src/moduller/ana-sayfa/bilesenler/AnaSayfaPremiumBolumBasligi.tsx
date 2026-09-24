import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  baslik: string;
  emoji?: string;
  onTumunuGor?: () => void;
  tumunuGorEtiket?: string;
};

export function AnaSayfaPremiumBolumBasligi({
  baslik,
  emoji,
  onTumunuGor,
  tumunuGorEtiket,
}: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const etiket = tumunuGorEtiket ?? t('anaSayfa.tumunuGor');

  return (
    <View style={styles.row}>
      <Text style={styles.baslik} numberOfLines={1}>
        {emoji ? `${emoji} ` : ''}
        {baslik}
      </Text>
      {onTumunuGor ? (
        <Pressable
          onPress={onTumunuGor}
          style={styles.seeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${baslik} — ${etiket}`}
        >
          <Text style={styles.seeAllYazi}>{etiket}</Text>
          <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.primarySoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
    gap: 8,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    fontSize: 12.5,
  },
});
