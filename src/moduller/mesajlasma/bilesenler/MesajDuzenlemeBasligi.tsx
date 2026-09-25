import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  visible: boolean;
  onIptal: () => void;
};

export function MesajDuzenlemeBasligi({ visible, onIptal }: Props) {
  const { t } = useCeviri();
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="pencil" size={16} color={RenkTokenlari.primarySoft} />
      <Text style={styles.yazi}>{t('mesajV2.editingMessage')}</Text>
      <Pressable onPress={onIptal} hitSlop={10} accessibilityRole="button">
        <Text style={styles.iptal}>{t('mesajV2.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.pressFill,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    flex: 1,
  },
  iptal: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
