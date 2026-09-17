import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { RoomMode } from '../../../types/models';
import { KesfetBolumBasligi } from './KesfetBolumBasligi';

export type KesfetModOgesi = {
  mode: RoomMode;
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
};

export const KESFET_MODLARI: KesfetModOgesi[] = [
  {
    mode: 'party',
    baslik: 'Parti',
    alt: 'Enerji · sohbet',
    icon: 'sparkles',
    tint: RenkTokenlari.primarySoft,
  },
  {
    mode: 'karaoke',
    baslik: 'Karaoke',
    alt: 'Mikrofon sahnesi',
    icon: 'mic',
    tint: RenkTokenlari.magenta,
  },
  {
    mode: 'game',
    baslik: 'Oyun',
    alt: 'Takım · eğlence',
    icon: 'game-controller',
    tint: RenkTokenlari.mint,
  },
  {
    mode: 'dating',
    baslik: 'Flört',
    alt: 'Tanış · bağlan',
    icon: 'heart',
    tint: RenkTokenlari.violet,
  },
];

type Props = {
  aktifMode: RoomMode | null;
  onSec: (mode: RoomMode | null) => void;
  sayaclar?: Partial<Record<RoomMode, number>>;
};

/** Keşfet — sahne modları ızgarası */
export function KesfetModKartlari({ aktifMode, onSec, sayaclar }: Props) {
  return (
    <View style={styles.wrap}>
      <KesfetBolumBasligi
        baslik="Sahne modları"
        alt={aktifMode ? 'Tekrar dokununca filtre kalkar' : 'Moda göre gez'}
      />
      <View style={styles.izgara}>
        {KESFET_MODLARI.map((mod) => {
          const aktif = aktifMode === mod.mode;
          const sayi = sayaclar?.[mod.mode] ?? 0;
          return (
            <View key={mod.mode} style={styles.kartWrap}>
              <Pressable
                onPress={() => onSec(aktif ? null : mod.mode)}
                style={[styles.kart, aktif && styles.kartAktif]}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif }}
                accessibilityLabel={`${mod.baslik} modu`}
              >
                <LinearGradient
                  colors={
                    aktif
                      ? [`${mod.tint}55`, `${mod.tint}18`, RenkTokenlari.bgCard]
                      : [`${mod.tint}22`, 'rgba(33,28,46,0.92)', RenkTokenlari.bgCard]
                  }
                  locations={[0, 0.42, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.kartIc}
                >
                  <View style={styles.ustSatir}>
                    <View
                      style={[
                        styles.ikon,
                        {
                          borderColor: `${mod.tint}${aktif ? '88' : '44'}`,
                          backgroundColor: `${mod.tint}22`,
                        },
                      ]}
                    >
                      <Ionicons name={mod.icon} size={18} color={mod.tint} />
                    </View>
                    {sayi > 0 ? (
                      <Text style={[styles.sayi, { color: mod.tint }]}>{sayi}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.baslik}>{mod.baslik}</Text>
                  <Text style={styles.alt} numberOfLines={1}>
                    {mod.alt}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm + 2,
    marginBottom: BoslukTokenlari.md,
  },
  izgara: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm + 2,
  },
  kartWrap: {
    width: '48.2%',
  },
  kart: {
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  kartAktif: {
    borderColor: RenkTokenlari.borderAccent,
  },
  kartIc: {
    padding: BoslukTokenlari.md,
    gap: 4,
    minHeight: 96,
  },
  ustSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ikon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sayi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
});
