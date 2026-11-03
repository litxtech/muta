/**
 * Popüler Ülkeler şeridi — başlık + ülke çipleri.
 * Seçili ülke vurgulanır; başlık sağındaki ok tüm ülke listesini açar.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { ulkeBayragi, ulkeGorunenAd } from '../utils/KisilerYardimcilar';

/** Vitrinde gösterilen popüler ülkeler (sıra sabit). */
export const POPULER_ULKE_KODLARI = [
  'TR',
  'SA',
  'EG',
  'PH',
  'PK',
  'US',
  'DE',
  'AZ',
  'MA',
  'AE',
  'GB',
  'DZ',
] as const;

type Props = {
  secili: string | null;
  onSec: (code: string | null) => void;
  onTumunuAc: () => void;
};

export function KisilerUlkeSeridi({ secili, onSec, onTumunuAc }: Props) {
  const { t, dil } = useCeviri();

  const ulkeler = useMemo(
    () =>
      POPULER_ULKE_KODLARI.map((code) => ({
        code,
        ad: ulkeGorunenAd(code),
        bayrak: ulkeBayragi(code),
      })),
    // dil değişince görünen adlar tazelensin
    [dil],
  );

  return (
    <View style={styles.blok}>
      <View style={styles.baslikSatir}>
        <Ionicons
          name="earth-outline"
          size={17}
          color={RenkTokenlari.primarySoft}
        />
        <Text style={styles.baslik}>{t('kisilerX.populerUlkeler')}</Text>
        <Pressable
          onPress={onTumunuAc}
          hitSlop={BoslukTokenlari.sm}
          accessibilityRole="button"
          accessibilityLabel={t('kisilerX.tumUlkeler')}
          style={styles.ok}
        >
          <Ionicons
            name="chevron-forward"
            size={16}
            color={RenkTokenlari.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.satir}
      >
        {ulkeler.map((u) => {
          const aktif = secili === u.code;
          const icerik = (
            <>
              <Text style={styles.bayrak}>{u.bayrak}</Text>
              <Text
                style={[styles.cipYazi, aktif && styles.cipYaziAktif]}
                numberOfLines={1}
              >
                {u.ad}
              </Text>
            </>
          );
          return (
            <Pressable
              key={u.code}
              onPress={() => {
                void Haptics.selectionAsync();
                onSec(aktif ? null : u.code);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={u.ad}
              style={({ pressed }) => [
                styles.cip,
                aktif && styles.cipAktif,
                pressed && styles.cipBasili,
              ]}
            >
              {aktif ? (
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cipDolgu}
                  pointerEvents="none"
                />
              ) : null}
              {icerik}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: {
    gap: BoslukTokenlari.sm,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    flex: 1,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  ok: {
    width: 24,
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  satir: {
    alignItems: 'center',
    gap: 6,
    paddingRight: BoslukTokenlari.sm,
  },
  cip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 36,
    maxWidth: 168,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.chipFill,
  },
  cipAktif: {
    borderColor: RenkTokenlari.primary,
  },
  cipBasili: {
    opacity: 0.8,
  },
  cipDolgu: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bayrak: {
    fontSize: 13,
    lineHeight: 16,
  },
  cipYazi: {
    ...TipografiTokenlari.micro,
    fontWeight: '600',
    letterSpacing: 0,
    color: RenkTokenlari.text,
    flexShrink: 1,
  },
  cipYaziAktif: {
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
});
