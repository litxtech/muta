import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { RenkPaleti, TemaKodu } from '../../../tasarim-sistemi/tema/TemaTipleri';
import { useTema } from '../../../tasarim-sistemi/tema/TemaSaglayici';
import { paletiKoddanAl } from '../../../tasarim-sistemi/tema/TemaDurumu';

type Kart = {
  kod: TemaKodu;
  baslik: string;
  alt: string;
};

const KARTLAR: Kart[] = [
  { kod: 'koyu', baslik: 'Siyah ekran', alt: 'Gece sahnesi' },
  { kod: 'acik', baslik: 'Beyaz ekran', alt: 'Açık zemin' },
  { kod: 'kadife', baslik: 'Kadife', alt: 'Şarap · rose-gold' },
  { kod: 'sampanya', baslik: 'Şampanya', alt: 'Mürekkep · VIP altın' },
  { kod: 'kozmik', baslik: 'Kozmik', alt: 'Indigo · pembe' },
  { kod: 'zumrut', baslik: 'Zümrüt', alt: 'Orman · VIP mint' },
];

/**
 * Görünüm kartları — kurulum ve ayarlar.
 */
export function GorunumSecimKartlari({
  onSec,
}: {
  onSec?: (kod: TemaKodu) => void;
}) {
  const { kod: aktif, temayiSec, palet } = useTema();

  const sec = async (kod: TemaKodu) => {
    await temayiSec(kod);
    onSec?.(kod);
  };

  return (
    <View style={styles.grid}>
      {KARTLAR.map((kart) => {
        const ornek: RenkPaleti = paletiKoddanAl(kart.kod);
        const secili = aktif === kart.kod;
        return (
          <Pressable
            key={kart.kod}
            onPress={() => void sec(kart.kod)}
            accessibilityRole="button"
            accessibilityState={{ selected: secili }}
            accessibilityLabel={`${kart.baslik} görünüm`}
            style={({ pressed }) => [styles.press, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.kart,
                {
                  borderColor: secili ? palet.primary : palet.border,
                  backgroundColor: palet.bgCard,
                },
              ]}
            >
              <LinearGradient
                colors={[...ornek.gradientNight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.onizleme}
              >
                <View
                  style={[
                    styles.onizlemeCubuk,
                    { backgroundColor: ornek.primary },
                  ]}
                />
                <View
                  style={[
                    styles.onizlemeSatir,
                    { backgroundColor: ornek.bgCard, borderColor: ornek.border },
                  ]}
                >
                  <View
                    style={[
                      styles.onizlemeNokta,
                      { backgroundColor: ornek.primary },
                    ]}
                  />
                  <View style={styles.onizlemeMetinler}>
                    <View
                      style={[
                        styles.onizlemeCizgi,
                        { backgroundColor: ornek.text, width: '72%' },
                      ]}
                    />
                    <View
                      style={[
                        styles.onizlemeCizgi,
                        {
                          backgroundColor: ornek.textMuted,
                          width: '48%',
                          opacity: 0.7,
                        },
                      ]}
                    />
                  </View>
                </View>
                {secili ? (
                  <View
                    style={[styles.onay, { backgroundColor: ornek.primary }]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={ornek.textOnPrimary}
                    />
                  </View>
                ) : null}
              </LinearGradient>
              <Text style={[styles.baslik, { color: palet.text }]}>
                {kart.baslik}
              </Text>
              <Text style={[styles.alt, { color: palet.textMuted }]}>
                {kart.alt}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.lg,
  },
  press: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  kart: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: BoslukTokenlari.sm,
    gap: BoslukTokenlari.sm,
  },
  onizleme: {
    height: 112,
    borderRadius: YaricapTokenlari.md,
    padding: BoslukTokenlari.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  onizlemeCubuk: {
    position: 'absolute',
    top: 14,
    left: 12,
    width: 36,
    height: 6,
    borderRadius: 3,
  },
  onizlemeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  onizlemeNokta: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  onizlemeMetinler: {
    flex: 1,
    gap: 5,
  },
  onizlemeCizgi: {
    height: 6,
    borderRadius: 3,
  },
  onay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslik: {
    ...TipografiTokenlari.h2,
    fontSize: 16,
    paddingHorizontal: 4,
  },
  alt: {
    ...TipografiTokenlari.micro,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
});
