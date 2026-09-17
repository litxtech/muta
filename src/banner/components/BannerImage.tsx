import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { BANNER_BORDER_RADIUS } from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  uri?: string | null;
  alt?: string | null;
  aspectRatio: number;
  /** Compact strip: köşeler kartla aynı (üst-only radius yok) */
  flush?: boolean;
};

export function BannerImage({ uri, alt, aspectRatio, flush }: Props) {
  const [failed, setFailed] = useState(false);
  const radius = flush
    ? undefined
    : {
        borderTopLeftRadius: BANNER_BORDER_RADIUS,
        borderTopRightRadius: BANNER_BORDER_RADIUS,
      };

  if (!uri || failed) {
    return <View style={[styles.fallback, { aspectRatio }, radius]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.img, { aspectRatio }, radius]}
      resizeMode="cover"
      accessibilityLabel={alt ?? 'Banner görseli'}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  img: {
    width: '100%',
    backgroundColor: RenkTokenlari.surface,
  },
  fallback: {
    width: '100%',
    backgroundColor: RenkTokenlari.surface,
  },
});
