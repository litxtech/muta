import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
};

const KARTLAR: Kart[] = [
  { kod: 'koyu', baslik: 'Koyu' },
  { kod: 'acik', baslik: 'Açık' },
  { kod: 'kadife', baslik: 'Kadife' },
  { kod: 'sampanya', baslik: 'Şampanya' },
  { kod: 'kozmik', baslik: 'Kozmik' },
  { kod: 'zumrut', baslik: 'Zümrüt' },
];

/**
 * Görünüm sekmeleri — kompakt yatay seçim (ayarlar / profil).
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
      style={styles.scroll}
    >
      {KARTLAR.map((kart) => {
        const ornek: RenkPaleti = paletiKoddanAl(kart.kod);
        const secili = aktif === kart.kod;
        return (
          <Pressable
            key={kart.kod}
            onPress={() => void sec(kart.kod)}
            accessibilityRole="tab"
            accessibilityState={{ selected: secili }}
            accessibilityLabel={`${kart.baslik} görünüm`}
            style={({ pressed }) => [
              styles.hit,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.sekme,
                {
                  borderColor: secili ? palet.primary : palet.border,
                  backgroundColor: secili ? palet.pressFill : palet.bgCard,
                },
              ]}
            >
              <LinearGradient
                colors={[...ornek.gradientNight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.swatch}
              >
                <View
                  style={[
                    styles.swatchNokta,
                    { backgroundColor: ornek.primary },
                  ]}
                />
                {secili ? (
                  <View
                    style={[
                      styles.onay,
                      { backgroundColor: ornek.primary },
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={10}
                      color={ornek.textOnPrimary}
                    />
                  </View>
                ) : null}
              </LinearGradient>
              <Text
                style={[
                  styles.etiket,
                  {
                    color: secili ? palet.text : palet.textMuted,
                    fontWeight: secili ? '700' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {kart.baslik}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: BoslukTokenlari.md,
    marginHorizontal: -BoslukTokenlari.sm,
  },
  serit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.sm,
    paddingVertical: 2,
  },
  hit: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  sekme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1.5,
    minHeight: 36,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swatchNokta: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiket: {
    ...TipografiTokenlari.micro,
    fontSize: 12,
    letterSpacing: -0.1,
  },
});
