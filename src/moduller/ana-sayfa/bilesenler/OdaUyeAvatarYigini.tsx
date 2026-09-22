import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  avatarlar: readonly (string | null | undefined)[];
  max?: number;
  boyut?: number;
  overlap?: number;
  borderColor?: string;
};

/** Ses odası kartı — sol alt üye avatar yığını (max 5–6) */
export function OdaUyeAvatarYigini({
  avatarlar,
  max = 6,
  boyut = 22,
  overlap = 8,
  borderColor,
}: Props) {
  const liste = avatarlar.slice(0, max);
  if (liste.length === 0) return null;

  const kenar = borderColor ?? RenkTokenlari.bgElevated;

  return (
    <View style={styles.yigin} accessibilityLabel={`${liste.length} katılımcı`}>
      {liste.map((uriHam, i) => {
        const uri = MedyaUriGuvenli(uriHam);
        return (
          <View
            key={`${uri ?? 'bos'}-${i}`}
            style={[
              styles.halka,
              {
                width: boyut,
                height: boyut,
                borderRadius: boyut / 2,
                marginLeft: i === 0 ? 0 : -overlap,
                zIndex: liste.length - i,
                borderColor: kenar,
              },
            ]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.img} />
            ) : (
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.img}
              >
                <Text style={[styles.harf, { fontSize: Math.max(9, boyut * 0.38) }]}>
                  ·
                </Text>
              </LinearGradient>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  yigin: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  halka: {
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  img: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
});
