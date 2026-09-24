import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  ODA_TEMALAR,
  type OdaTemaTanim,
} from '../../oda-olusturma/katalog/OdaTemaKatalogu';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  seciliKod?: string | null;
  onSec: (tema: OdaTemaTanim) => void;
};

/**
 * Yatay modern tema şeridi — oda arka plan seçimi.
 */
export function OdaArkaPlanTemaSeridi({ seciliKod, onSec }: Props) {
  const { t } = useCeviri();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
    >
      {ODA_TEMALAR.map((tema) => {
        const secili = seciliKod === tema.kod;
        return (
          <Pressable
            key={tema.kod}
            onPress={() => onSec(tema)}
            accessibilityRole="button"
            accessibilityState={{ selected: secili }}
            accessibilityLabel={t('sesOda.temaA11y', { tema: tema.ad })}
            style={({ pressed }) => [
              styles.hit,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.kart,
                secili && {
                  borderColor: tema.vurgu,
                },
              ]}
            >
              <LinearGradient
                colors={[...tema.renkler]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.onizleme}
              >
                <View
                  style={[
                    styles.vurguNokta,
                    { backgroundColor: tema.vurgu },
                  ]}
                />
                {secili ? (
                  <View
                    style={[styles.onay, { backgroundColor: tema.vurgu }]}
                  >
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                ) : null}
              </LinearGradient>
              <Text
                style={[styles.ad, secili && { color: '#fff' }]}
                numberOfLines={1}
              >
                {tema.ad}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serit: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  hit: { flexShrink: 0 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  kart: {
    width: 78,
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  onizleme: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vurguNokta: {
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.9,
  },
  onay: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ad: {
    ...TipografiTokenlari.micro,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
});
