import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { KonusmaciAktiflikEfekti } from './KonusmaciAktiflikEfekti';
import type { RoomSeat } from '../../../types/models';

type Props = {
  seat: RoomSeat;
  onPress?: () => void;
};

export function KonusmaciKarti({ seat, onPress }: Props) {
  const ad =
    seat.profile?.display_name?.trim() ||
    seat.profile?.username?.trim() ||
    (seat.seat_index === 0 ? 'Ev sahibi' : `Mikrofon ${seat.seat_index + 1}`);
  const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
  const avatarUrl = seat.profile?.avatar_url;
  const dolu = !!seat.user_id;

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <KonusmaciAktiflikEfekti userId={seat.user_id} size={68}>
        {dolu && avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        ) : dolu ? (
          <LinearGradient
            colors={[RenkTokenlari.primary, RenkTokenlari.deepPlum]}
            style={[styles.avatar, styles.filled]}
          >
            <Text style={styles.harf}>{harf}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.avatar}>
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="mic-outline" size={20} color={RenkTokenlari.textDim} />
          </View>
        )}
      </KonusmaciAktiflikEfekti>
      <Text style={[styles.name, dolu && styles.nameDolu]} numberOfLines={1}>
        {ad}
      </Text>
      {seat.seat_index === 0 && dolu ? (
        <View style={styles.hostRozet}>
          <Text style={styles.hostYazi}>HOST</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '21%', alignItems: 'center', gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: RenkTokenlari.seatEmpty,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: RenkTokenlari.primarySoft,
  },
  filled: {
    borderColor: RenkTokenlari.primarySoft,
    borderWidth: 2,
  },
  harf: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  name: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
  },
  nameDolu: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  hostRozet: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(240,180,41,0.2)',
  },
  hostYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
