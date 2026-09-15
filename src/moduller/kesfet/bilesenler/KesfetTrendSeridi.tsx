import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
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
            <Animated.View
              key={oda.id}
              entering={FadeInRight.delay(50 + index * 55)
                .duration(AnimasyonTokenlari.normal)
                .springify()
                .damping(16)}
            >
              <Pressable
                onPress={() => onSec(oda)}
                style={({ pressed }) => [styles.kart, pressed && styles.basili]}
                accessibilityRole="button"
                accessibilityLabel={`Trend oda: ${oda.title}`}
              >
                {kapak ? (
                  <Image source={{ uri: kapak }} style={styles.kapak} />
                ) : (
                  <LinearGradient
                    colors={['#3A1A38', '#1A1226', '#121018']}
                    style={styles.kapak}
                  />
                )}
                <LinearGradient
                  colors={['rgba(14,8,20,0.05)', 'rgba(14,8,20,0.92)']}
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
            </Animated.View>
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
    paddingHorizontal: 0,
  },
  serit: {
    gap: BoslukTokenlari.sm + 2,
    paddingRight: BoslukTokenlari.xs,
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
  basili: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  kapak: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: 'rgba(8, 4, 14, 0.55)',
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
    color: RenkTokenlari.text,
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
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  dinleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dinleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontSize: 10,
  },
});
