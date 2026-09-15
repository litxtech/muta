import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Screen } from '../src/components/Screen';
import { EkranBasligi } from '../src/components/EkranBasligi';
import { RoomCard } from '../src/components/RoomCard';
import { BosDurum } from '../src/components/BosDurum';
import { ModulHataSiniri } from '../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  KESFET_FILTRELERI,
  KesfetKategorileriniGetir,
  type KesfetFiltresi,
  type KesfetKategorisi,
} from '../src/moduller/kesfet/filtreler/KesfetFiltreleri';
import { KesfetOneriGetir } from '../src/moduller/kesfet/okuma/KesfetOneriGetir';
import { KesfetAramaCubugu } from '../src/moduller/kesfet/bilesenler/KesfetAramaCubugu';
import {
  KesfetFiltreCipleri,
  type KesfetCipi,
} from '../src/moduller/kesfet/bilesenler/KesfetFiltreCipleri';
import { KesfetOneCikanKart } from '../src/moduller/kesfet/bilesenler/KesfetOneCikanKart';
import { KesfetIskelet } from '../src/moduller/kesfet/bilesenler/KesfetIskelet';
import type { Room } from '../src/types/models';
import { RenkTokenlari } from '../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../src/tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const FILTRE_IKONLARI: Record<KesfetFiltresi, keyof typeof Ionicons.glyphMap> = {
  global: 'earth-outline',
  country: 'flag-outline',
  language: 'language-outline',
  online: 'pulse-outline',
  live: 'radio-outline',
  voice_room: 'headset-outline',
  new_creator: 'sparkles-outline',
  trending: 'flame-outline',
};

const KATEGORI_IKONLARI: Record<string, keyof typeof Ionicons.glyphMap> = {
  party: 'sparkles-outline',
  karaoke: 'mic-outline',
  game: 'game-controller-outline',
  dating: 'heart-outline',
};

export default function KesfetEkrani() {
  const [filtre, setFiltre] = useState<KesfetFiltresi>('voice_room');
  const [kategoriler, setKategoriler] = useState<KesfetKategorisi[]>([]);
  const [kategori, setKategori] = useState<string | null>(null);
  const [arama, setArama] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, data] = await Promise.all([
        KesfetKategorileriniGetir().catch(() => []),
        KesfetOneriGetir({ filtre, kategori }).catch(() => []),
      ]);
      setKategoriler(cats);
      setRooms(data);
    } finally {
      setLoading(false);
    }
  }, [filtre, kategori]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtreCipleri = useMemo<KesfetCipi[]>(
    () =>
      KESFET_FILTRELERI.map((f) => ({
        id: f.id,
        label: f.label,
        icon: FILTRE_IKONLARI[f.id],
      })),
    [],
  );

  const kategoriCipleri = useMemo<KesfetCipi[]>(
    () =>
      kategoriler.map((k) => ({
        id: k.code,
        label: k.name,
        icon: KATEGORI_IKONLARI[k.code] ?? 'pricetag-outline',
      })),
    [kategoriler],
  );

  const gorunenler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    if (!q) return rooms;
    return rooms.filter((r) => {
      const metin = [
        r.title,
        r.topic ?? '',
        r.host?.display_name ?? '',
        r.host?.username ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('tr');
      return metin.includes(q);
    });
  }, [rooms, arama]);

  const heroVar = !arama && gorunenler.length >= 3;
  const izgara = heroVar ? gorunenler.slice(1) : gorunenler;
  const ilkYukleme = loading && rooms.length === 0;

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="kesfet">
        <EkranBasligi title="Keşfet" subtitle="Önerilen odalar ve yayınlar" />

        <KesfetAramaCubugu deger={arama} onDegisti={setArama} />

        <KesfetFiltreCipleri
          cipler={filtreCipleri}
          aktifId={filtre}
          onSec={(id) => setFiltre(id as KesfetFiltresi)}
        />

        {kategoriCipleri.length > 0 ? (
          <KesfetFiltreCipleri
            cipler={kategoriCipleri}
            aktifId={kategori}
            onSec={(id) => setKategori((mevcut) => (mevcut === id ? null : id))}
          />
        ) : null}

        {ilkYukleme ? (
          <KesfetIskelet />
        ) : (
          <FlatList
            data={izgara}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.satir}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => void load()}
                tintColor={RenkTokenlari.primary}
              />
            }
            ListHeaderComponent={
              <View style={styles.baslikAlani}>
                {heroVar ? (
                  <Animated.View
                    entering={FadeInUp.duration(AnimasyonTokenlari.normal).springify().damping(16)}
                  >
                    <KesfetOneCikanKart
                      room={gorunenler[0]}
                      onPress={() =>
                        router.push(`/lobi/${gorunenler[0].id}` as any)
                      }
                    />
                  </Animated.View>
                ) : null}
                {gorunenler.length > 0 ? (
                  <View style={styles.bolumSatir}>
                    <Text style={styles.bolumYazi}>
                      {arama ? 'Arama sonuçları' : 'Canlı odalar'}
                    </Text>
                    <View style={styles.bolumCizgi} />
                    <Text style={styles.sayacYazi}>{gorunenler.length}</Text>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.bosAlan}>
                <BosDurum
                  icon={arama ? 'search-outline' : 'compass-outline'}
                  title={arama ? 'Eşleşen oda yok' : 'Şu an canlı oda yok'}
                  body={
                    arama
                      ? 'Farklı bir kelime dene veya filtreyi değiştir.'
                      : 'Canlı odalar açıldığında burada görünür — istersen ilk sahneyi sen kur.'
                  }
                />
                {!arama ? (
                  <View style={styles.bosAksiyonlar}>
                    <Pressable
                      onPress={() => router.navigate('/(tabs)/create')}
                      style={styles.bosBtn}
                    >
                      <LinearGradient
                        colors={[...RenkTokenlari.gradientPrimary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.bosBtnIc}
                      >
                        <Ionicons name="mic" size={15} color="#12040C" />
                        <Text style={styles.bosBtnYazi}>Ses odası aç</Text>
                      </LinearGradient>
                    </Pressable>
                    <Pressable
                      onPress={() => router.navigate('/(tabs)/rooms')}
                      style={styles.bosBtnIkincil}
                    >
                      <Text style={styles.bosBtnIkincilYazi}>Odaları gez</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <Animated.View
                style={styles.kartWrap}
                entering={FadeInUp.delay(Math.min(index, 6) * 40)
                  .duration(AnimasyonTokenlari.normal)
                  .springify()
                  .damping(16)}
              >
                <RoomCard
                  room={item}
                  onPress={() => router.push(`/lobi/${item.id}` as any)}
                />
              </Animated.View>
            )}
          />
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.xs,
    paddingBottom: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
    flexGrow: 1,
  },
  satir: { gap: BoslukTokenlari.md },
  kartWrap: {
    flex: 1,
    maxWidth: '48.5%',
  },
  baslikAlani: {
    gap: BoslukTokenlari.md,
  },
  bolumSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  bolumYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  bolumCizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  sayacYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    backgroundColor: RenkTokenlari.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  bosAlan: {
    alignItems: 'center',
    gap: BoslukTokenlari.xs,
  },
  bosAksiyonlar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  bosBtn: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  bosBtnIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bosBtnYazi: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
  bosBtnIkincil: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  bosBtnIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
});
