import React from 'react';
import { StyleSheet, Text, View, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from '../moduller/ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { Room } from '../types/models';

const MODE_LABEL: Record<Room['mode'], string> = {
  party: 'Parti',
  dating: 'Flört',
  karaoke: 'Karaoke',
  game: 'Oyun',
  private: 'Özel',
};

type Props = {
  room: Room;
  onPress: () => void;
};

export function RoomCard({ room, onPress }: Props) {
  const kapak = room.cover_url ?? room.host?.avatar_url ?? null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <View style={styles.card}>
        {kapak ? (
          <Image source={{ uri: kapak }} style={styles.kapak} />
        ) : (
          <LinearGradient
            colors={['#2E1A32', '#1A1224', '#14101C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kapak}
          />
        )}
        <LinearGradient
          colors={['rgba(14,8,20,0.2)', 'rgba(14,8,20,0.92)']}
          style={styles.overlay}
        />

        <View style={styles.top}>
          <View style={styles.livePill}>
            <AnaSayfaCanliNokta boyut={5} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
          <Text style={styles.mode}>{MODE_LABEL[room.mode]}</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>
            {room.title}
          </Text>
          {room.topic ? (
            <Text style={styles.topic} numberOfLines={1}>
              {room.topic}
            </Text>
          ) : null}

          <View style={styles.bottom}>
            <View style={styles.hostRow}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.avatar}
              >
                <Ionicons name="person" size={11} color="#12040C" />
              </LinearGradient>
              <Text style={styles.host} numberOfLines={1}>
                {room.host?.display_name ?? 'Ev sahibi'}
              </Text>
            </View>
            <View style={styles.meta}>
              <Ionicons name="headset" size={11} color={RenkTokenlari.primarySoft} />
              <Text style={styles.metaText}>{room.listener_count}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  card: {
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.28)',
    minHeight: 168,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  kapak: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.sm + 2,
    paddingTop: BoslukTokenlari.sm + 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8, 4, 14, 0.55)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  liveText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 9,
  },
  mode: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    textTransform: 'uppercase',
    fontSize: 9,
  },
  copy: {
    padding: BoslukTokenlari.md,
    gap: 4,
  },
  title: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
    lineHeight: 20,
  },
  topic: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  metaText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
  },
});
