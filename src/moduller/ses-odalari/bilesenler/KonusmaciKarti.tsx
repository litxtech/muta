import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { KonusmaciAktiflikEfekti } from './KonusmaciAktiflikEfekti';
import type { RoomSeat } from '../../../types/models';

type Props = {
  seat: RoomSeat;
  onPress?: () => void;
};

export function KonusmaciKarti({ seat, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <KonusmaciAktiflikEfekti userId={seat.user_id}>
        <View style={[styles.avatar, seat.user_id && styles.filled]}>
          <Ionicons
            name={seat.user_id ? 'person' : 'add'}
            size={22}
            color={seat.user_id ? RenkTokenlari.text : RenkTokenlari.textDim}
          />
        </View>
      </KonusmaciAktiflikEfekti>
      <Text style={styles.name} numberOfLines={1}>
        {seat.profile?.display_name ??
          (seat.seat_index === 0 ? 'Host' : `Mic ${seat.seat_index + 1}`)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '21%', alignItems: 'center', gap: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: RenkTokenlari.seatEmpty,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.18)',
  },
  name: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
});
