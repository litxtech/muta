import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useBanners } from '../hooks/useBanners';
import { BannerCarousel } from './BannerCarousel';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  placement: string;
  screen?: string;
  compact?: boolean;
  style?: object;
};

/**
 * Merkezi banner bileşeni — sayfalar sadece placement verir.
 * @example <TamusoBanner placement="FEED_TOP" />
 *
 * Boş placement’ta iskelet GÖSTERİLMEZ (profil/feed’de flaş: iskelet → null).
 */
export function TamusoBanner({ placement, screen, compact, style }: Props) {
  const { banners, dismissLocal, sessionId } = useBanners(placement);

  // Boşken iskelet flaşı yok — null dön
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    marginVertical: BoslukTokenlari.xs,
  },
});
