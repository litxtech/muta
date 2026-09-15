import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { Room } from '../../../types/models';

type Props = {
  room: Room;
  onPress: () => void;
};

/** Keşfet — listenin en üstünde geniş "öne çıkan" oda kartı */
export function KesfetOneCikanKart({ room, onPress }: Props) {
  const kapak = room.cover_url ?? room.host?.avatar_url ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.basili]}
      accessibilityRole="button"
      accessibilityLabel={`Öne çıkan oda: ${room.title}`}
    >
      <View style={styles.kart}>
        {kapak ? (
          <Image source={{ uri: kapak }} style={styles.kapak} />
        ) : (
          <LinearGradient
            colors={['#3A1A38', '#1A1226', '#121018']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kapak}
          />
        )}
        <LinearGradient
          colors={['rgba(14,8,20,0.1)', 'rgba(14,8,20,0.94)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.ust}>
          <View style={styles.eyebrow}>
            <Ionicons name="flame" size={12} color={RenkTokenlari.accent} />
            <Text style={styles.eyebrowYazi}>ÖNE ÇIKAN</Text>
          </View>
          <View style={styles.canliPill}>
            <AnaSayfaCanliNokta boyut={5} />
            <Text style={styles.canliYazi}>CANLI</Text>
          </View>
        </View>

        <View style={styles.alt}>
          <Text style={styles.baslik} numberOfLines={2}>
            {room.title}
          </Text>
          <View style={styles.metaSatir}>
            <Text style={styles.host} numberOfLines={1}>
              {room.host?.display_name ?? 'Ev sahibi'}
            </Text>
            <View style={styles.dinleyici}>
              <Ionicons name="headset" size={12} color={RenkTokenlari.primarySoft} />
              <Text style={styles.dinleyiciYazi}>{room.listener_count}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  basili: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  kart: {
    minHeight: 150,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  kapak: {
    ...StyleSheet.absoluteFill,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: BoslukTokenlari.md,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(8, 4, 14, 0.6)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
  },
  eyebrowYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  canliPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8, 4, 14, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
  },
  alt: {
    padding: BoslukTokenlari.md,
    gap: 6,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    letterSpacing: -0.3,
  },
  metaSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  host: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  dinleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  dinleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
  },
});
