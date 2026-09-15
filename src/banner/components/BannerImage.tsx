import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { BANNER_BORDER_RADIUS } from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  uri?: string | null;
  alt?: string | null;
  aspectRatio: number;
};

export function BannerImage({ uri, alt, aspectRatio }: Props) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return <View style={[styles.fallback, { aspectRatio }]} />;
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.img, { aspectRatio }]}
      resizeMode="cover"
      accessibilityLabel={alt ?? 'Banner görseli'}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  img: {
    width: '100%',
    borderTopLeftRadius: BANNER_BORDER_RADIUS,
    borderTopRightRadius: BANNER_BORDER_RADIUS,
    backgroundColor: RenkTokenlari.surface,
  },
  fallback: {
    width: '100%',
    backgroundColor: RenkTokenlari.surface,
    borderTopLeftRadius: BANNER_BORDER_RADIUS,
    borderTopRightRadius: BANNER_BORDER_RADIUS,
  },
});
