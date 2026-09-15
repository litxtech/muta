import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  sayi: number;
  onPress: () => void;
};

/** Ana sayfa / header bildirim zili + rozet */
export function BildirimZiliDugmesi({ sayi, onPress }: Props) {
  const n = Math.max(0, Math.floor(sayi));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel={
        n > 0 ? `${n} okunmamış bildirim` : 'Bildirimler'
      }
      style={styles.btn}
    >
      <Ionicons
        name={n > 0 ? 'notifications' : 'notifications-outline'}
        size={22}
        color={n > 0 ? RenkTokenlari.primarySoft : RenkTokenlari.text}
      />
      {n > 0 ? (
        <View style={styles.rozet}>
          <Text style={styles.rozetYazi}>{n > 99 ? '99+' : String(n)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  rozet: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
});
