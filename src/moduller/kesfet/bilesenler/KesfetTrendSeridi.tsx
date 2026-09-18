import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { KesfetBolumBasligi } from './KesfetBolumBasligi';

type Props = {
  odalar: Room[];
  onSec: (oda: Room) => void;
  onHost?: (hostId: string) => void;
};

/** Keşfet — yatay trend / yükselen odalar şeridi */
export function KesfetTrendSeridi({ odalar, onSec, onHost }: Props) {
  if (odalar.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.baslikPad}>
        <KesfetBolumBasligi baslik="Trend şimdi" sayac={odalar.length} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {odalar.map((oda, index) => {
          const kapak = oda.cover_url ?? oda.host?.avatar_url ?? null;
          return (
            <Pressable
              key={oda.id}
              onPress={() => onSec(oda)}
              style={styles.kart}
              accessibilityRole="button"
              accessibilityLabel={`Trend oda: ${oda.title}`}
            >
              {kapak ? (
                <Image source={{ uri: kapak }} style={styles.kapak} />
              ) : (
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPlaceholder]}
                  style={styles.kapak}
                />
              )}
              <LinearGradient
                colors={[...RenkTokenlari.overlayGradient]}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.ust}>
                <View style={styles.sira}>
                  <Text style={styles.siraYazi}>#{index + 1}</Text>
                </View>
                <View style={styles.canli}>
                  <AnaSayfaCanliNokta boyut={4} />
                  <Text style={styles.canliYazi}>CANLI</Text>
                </View>
              </View>

              <View style={styles.alt}>
                <Text style={styles.baslik} numberOfLines={2}>
                  {oda.title}
                </Text>
                <Pressable
                  onPress={() => {
                    if (oda.host_id && onHost) onHost(oda.host_id);
                    else onSec(oda);
                  }}
                  hitSlop={4}
                  style={styles.hostSatir}
                >
                  <Text style={styles.host} numberOfLines={1}>
                    {oda.host?.display_name ?? 'Ev sahibi'}
                  </Text>
                  <View style={styles.dinleyici}>
                    <Ionicons
                      name="headset"
                      size={11}
                      color={RenkTokenlari.primarySoft}
                    />
                    <Text style={styles.dinleyiciYazi}>{oda.listener_count}</Text>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.md,
  },
  baslikPad: {
    paddingHorizontal: BoslukTokenlari.lg,
  },
  serit: {
    gap: BoslukTokenlari.sm + 2,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  kart: {
    width: 168,
    height: 128,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    justifyContent: 'space-between',
  },
  kapak: {
    ...StyleSheet.absoluteFill,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: BoslukTokenlari.sm,
  },
  sira: {
    backgroundColor: 'rgba(240, 180, 41, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  siraYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    fontSize: 10,
  },
  canli: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RenkTokenlari.chipFill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 8,
  },
  alt: {
    padding: BoslukTokenlari.sm,
    gap: 4,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
    lineHeight: 16,
  },
  hostSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.86,
    flex: 1,
  },
  dinleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dinleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontSize: 10,
    fontWeight: '700',
  },
});
