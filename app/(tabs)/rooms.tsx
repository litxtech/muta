import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoomCard } from '../../src/components/RoomCard';
import { fetchLiveRooms } from '../../src/services/api';
import type { Room } from '../../src/types/models';
import { colors, typography } from '../../src/theme/colors';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRooms(await fetchLiveRooms(50));
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tüm odalar</Text>
        <Text style={styles.sub}>Party · Dating · Karaoke · Game</Text>
      </View>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Supabase şemasını çalıştırdıktan sonra odalar burada.</Text>
        }
        renderItem={({ item }) => (
          <RoomCard room={item} onPress={() => router.push(`/lobi/${item.id}` as any)} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 4 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
