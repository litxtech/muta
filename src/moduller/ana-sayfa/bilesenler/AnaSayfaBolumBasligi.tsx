import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  baslik: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
};

export function AnaSayfaBolumBasligi({ baslik, onSeeAll, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{baslik}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll}>
            <Text style={styles.seeAll}>Tümü</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  seeAll: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
});
