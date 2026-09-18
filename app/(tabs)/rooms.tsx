import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { RoomCard } from '../../src/components/RoomCard';
import { BosDurum } from '../../src/components/BosDurum';
import { fetchLiveRooms } from '../../src/services/api';
import type { Room } from '../../src/types/models';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { OdalarMarkaBasligi } from '../../src/moduller/odalar/bilesenler/OdalarMarkaBasligi';
import { OdaHaftalikSiralamaSeridi } from '../../src/moduller/liderlik-siralamalari/bilesenler/OdaHaftalikSiralamaSeridi';
import {
  OdalarModFiltresi,
  type OdalarFiltre,
} from '../../src/moduller/odalar/bilesenler/OdalarModFiltresi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtre, setFiltre] = useState<OdalarFiltre>('all');

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

  const filtrelenmis = useMemo(() => {
    if (filtre === 'all') return rooms;
    return rooms.filter((oda) => oda.mode === filtre);
  }, [rooms, filtre]);

  const odaAc = useCallback((oda: Room) => {
    router.push(`/lobi/${oda.id}` as any);
  }, []);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="odalar">
        <OdalarMarkaBasligi canliSayisi={rooms.length} />
        <OdalarModFiltresi secili={filtre} onSec={setFiltre} />
        <OdaHaftalikSiralamaSeridi />

        <FlatList
          data={filtrelenmis}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={styles.satir}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          ListHeaderComponent={
            filtrelenmis.length > 0 ? (
              <View style={styles.listeBaslik}>
                <View style={styles.accent} />
                <Text style={styles.listeBaslikYazi}>
                  {filtre === 'all' ? 'Canlı odalar' : 'Seçili sahne'}
                </Text>
                <Text style={styles.listeSayi}>{filtrelenmis.length}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.bosWrap}>
              <BosDurum
                icon="radio-outline"
                title={filtre === 'all' ? 'Sahne boş' : 'Bu modda oda yok'}
                body={
                  filtre === 'all'
                    ? 'Canlı odalar açıldığında burada görünecek.'
                    : 'Başka bir moda bak veya kendi odanı kur.'
                }
              />
              <Pressable
                onPress={() => router.navigate('/(tabs)/create')}
                style={styles.bosCta}
              >
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.bosCtaIc}
                >
                  <Ionicons name="add" size={16} color={RenkTokenlari.textOnPrimary} />
                  <Text style={styles.bosCtaYazi}>Oda kur</Text>
                </LinearGradient>
              </Pressable>
              {filtre !== 'all' ? (
                <Pressable onPress={() => setFiltre('all')} hitSlop={8}>
                  <Text style={styles.tumuneDon}>Tüm sahneleri göster</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.kartWrap}>
              <RoomCard
                room={item}
                variant="avatar"
                onPress={() => odaAc(item)}
              />
            </View>
          )}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: 0,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    gap: BoslukTokenlari.xs,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  satir: {
    gap: BoslukTokenlari.sm,
    alignItems: 'flex-start',
    marginTop: 0,
  },
  kartWrap: {
    width: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  listeBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    marginTop: 0,
    paddingHorizontal: BoslukTokenlari.xs,
  },
  accent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  listeBaslikYazi: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    flex: 1,
    fontSize: 15,
  },
  listeSayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    fontSize: 10,
  },
  bosWrap: {
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.lg,
  },
  bosCta: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  bosCtaIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bosCtaYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
    color: RenkTokenlari.textOnPrimary,
  },
  tumuneDon: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
