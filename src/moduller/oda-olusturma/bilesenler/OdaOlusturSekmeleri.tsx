import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type OdaOlusturSekmeKodu = 'mod' | 'kapasite' | 'duzen' | 'tema' | 'detay';

type Sekme = {
  kod: OdaOlusturSekmeKodu;
  etiket: string;
  adim: number;
};

const SEKMELER: Sekme[] = [
  { kod: 'mod', etiket: 'Mod', adim: 1 },
  { kod: 'kapasite', etiket: 'Boyut', adim: 2 },
  { kod: 'duzen', etiket: 'Düzen', adim: 3 },
  { kod: 'tema', etiket: 'Tema', adim: 4 },
  { kod: 'detay', etiket: 'Detay', adim: 5 },
];

type Props = {
  aktif: OdaOlusturSekmeKodu;
  onSec: (kod: OdaOlusturSekmeKodu) => void;
};

export function OdaOlusturSekmeleri({ aktif, onSec }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
    >
      {SEKMELER.map((sekme) => {
        const secili = aktif === sekme.kod;
        return (
          <Pressable
            key={sekme.kod}
            onPress={() => onSec(sekme.kod)}
            style={styles.hit}
            accessibilityRole="tab"
            accessibilityState={{ selected: secili }}
          >
            {secili ? (
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.chipAktif}
              >
                <Text style={styles.adimAktif}>{sekme.adim}</Text>
                <Text style={styles.etiketAktif}>{sekme.etiket}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.chip}>
                <Text style={styles.adim}>{sekme.adim}</Text>
                <Text style={styles.etiket}>{sekme.etiket}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function sonrakiSekme(aktif: OdaOlusturSekmeKodu): OdaOlusturSekmeKodu | null {
  const i = SEKMELER.findIndex((s) => s.kod === aktif);
  if (i < 0 || i >= SEKMELER.length - 1) return null;
  return SEKMELER[i + 1].kod;
}

export function oncekiSekme(aktif: OdaOlusturSekmeKodu): OdaOlusturSekmeKodu | null {
  const i = SEKMELER.findIndex((s) => s.kod === aktif);
  if (i <= 0) return null;
  return SEKMELER[i - 1].kod;
}

const styles = StyleSheet.create({
  serit: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.md,
  },
  hit: {},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  chipAktif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
  },
  adim: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
  },
  adimAktif: {
    ...TipografiTokenlari.micro,
    color: 'rgba(18,4,12,0.7)',
    fontSize: 10,
    fontWeight: '800',
  },
  etiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  etiketAktif: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
});
