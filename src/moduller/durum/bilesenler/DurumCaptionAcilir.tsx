import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, type TextStyle } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

/** Kapalıyken gösterilecek satır üst sınırı */
const KAPALI_SATIR = 5;

type Props = {
  metin: string;
  style?: TextStyle;
  kapaliSatir?: number;
};

/**
 * Uzun caption / metin gönderisi — önce ölçer, gerekirse
 * «devamını gör» ile yerinde açar.
 */
export function DurumCaptionAcilir({
  metin,
  style,
  kapaliSatir = KAPALI_SATIR,
}: Props) {
  const { t } = useCeviri();
  const [acik, setAcik] = useState(false);
  /** null = henüz ölçülmedi; true = kırpılmalı; false = kısa */
  const [kirpikGerekli, setKirpikGerekli] = useState<boolean | null>(null);
  const temiz = metin.trim();
  if (!temiz) return null;

  const kirpik = kirpikGerekli === true && !acik;

  return (
    <>
      <Text
        style={[styles.caption, style]}
        numberOfLines={kirpik ? kapaliSatir : undefined}
        onTextLayout={(e) => {
          if (kirpikGerekli !== null || acik) return;
          const n = e.nativeEvent.lines?.length ?? 0;
          setKirpikGerekli(n > kapaliSatir);
        }}
      >
        {temiz}
      </Text>
      {kirpikGerekli === true && !acik ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setAcik(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('durumX.devaminiGor')}
        >
          <Text style={styles.devam}>{t('durumX.devaminiGor')}</Text>
        </Pressable>
      ) : null}
      {kirpikGerekli === true && acik ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setAcik(false);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('durumX.dahaAzGoster')}
        >
          <Text style={styles.devam}>{t('durumX.dahaAzGoster')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  caption: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 21,
  },
  devam: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    marginTop: 2,
  },
});
