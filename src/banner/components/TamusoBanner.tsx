import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useBanners } from '../hooks/useBanners';
import { BannerCarousel } from './BannerCarousel';
import { BannerSkeleton } from './BannerSkeleton';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { uretimOrtamiMi } from '../../yapilandirma/OrtamDegiskenleri';

type Props = {
  placement: string;
  screen?: string;
  compact?: boolean;
  style?: object;
};

/**
 * Merkezi banner bileşeni — sayfalar sadece placement verir.
 * @example <TamusoBanner placement="FEED_TOP" />
 */
export function TamusoBanner({ placement, screen, compact, style }: Props) {
  const { banners, loading, dismissLocal, sessionId, debug } =
    useBanners(placement);

  if (loading && banners.length === 0) {
    return (
      <View style={[styles.wrap, style]}>
        <BannerSkeleton compact={compact} />
      </View>
    );
  }

  if (banners.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <BannerCarousel
        banners={banners}
        placement={placement}
        screen={screen}
        sessionId={sessionId}
        compact={compact}
        onDismiss={dismissLocal}
        debug={debug}
      />
      {debug && !uretimOrtamiMi && (
        <Text style={styles.debug}>
          {placement} · {banners.length} banner
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.lg,
    marginVertical: BoslukTokenlari.sm,
  },
  debug: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 4,
  },
});
