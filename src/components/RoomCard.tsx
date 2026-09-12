import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../theme/colors';
import type { Room } from '../types/models';

const MODE_LABEL: Record<Room['mode'], string> = {
  party: 'Party',
  dating: 'Dating',
  karaoke: 'Karaoke',
  game: 'Game',
  private: 'Private',
};

type Props = {
  room: Room;
  onPress: () => void;
};

export function RoomCard({ room, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.press}>
      <LinearGradient colors={['#2B1238', '#160A24']} style={styles.card}>
        <View style={styles.top}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.mode}>{MODE_LABEL[room.mode]}</Text>
        </View>

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
            <View style={styles.avatar}>
              <Ionicons name="person" size={14} color={colors.textMuted} />
            </View>
            <Text style={styles.host} numberOfLines={1}>
              {room.host?.display_name ?? 'Host'}
            </Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="headset" size={14} color={colors.primarySoft} />
            <Text style={styles.metaText}>{room.listener_count}</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    minWidth: '47%',
  },
  card: {
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderHot,
    minHeight: 168,
    justifyContent: 'space-between',
    gap: 10,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 61, 129, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    ...typography.micro,
    color: colors.primarySoft,
  },
  mode: {
    ...typography.micro,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  topic: {
    ...typography.caption,
    color: colors.textMuted,
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
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.seatEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.text,
  },
});
