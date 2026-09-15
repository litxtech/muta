import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BANNER_BORDER,
  BANNER_BORDER_RADIUS,
  BANNER_BG,
  resolveBannerAspect,
} from '../core/BannerConstants';
import type { BannerSizeType } from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  sizeType?: BannerSizeType;
  aspectRatio?: string;
  compact?: boolean;
};

export function BannerSkeleton({
  sizeType = 'MEDIUM',
  aspectRatio,
  compact,
}: Props) {
  const ratio = resolveBannerAspect(sizeType, aspectRatio);
  return (
    <View
      style={[
        styles.box,
        { aspectRatio: ratio },
        compact && styles.compact,
      ]}
      accessibilityLabel="Banner yükleniyor"
    >
      <View style={styles.shimmer} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: BANNER_BORDER_RADIUS,
    backgroundColor: BANNER_BG,
    borderWidth: 1,
    borderColor: BANNER_BORDER,
    overflow: 'hidden',
  },
  compact: {
    maxHeight: 88,
  },
  shimmer: {
    flex: 1,
    backgroundColor: RenkTokenlari.surface,
    opacity: 0.45,
  },
});
