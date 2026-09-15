import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { BannerBadge } from './BannerBadge';
import type { BannerCampaign } from '../core/BannerTypes';

type Props = {
  banner: BannerCampaign;
  compact?: boolean;
};

export function BannerContent({ banner, compact }: Props) {
  const hasText =
    banner.title ||
    banner.subtitle ||
    banner.description ||
    banner.badge ||
    (banner.tags?.length ?? 0) > 0;

  if (!hasText) return null;

  return (
    <View style={[styles.wrap, compact && styles.compact]} pointerEvents="box-none">
      <BannerBadge text={banner.badge ?? banner.label} tags={banner.tags} />
      {!!banner.title && (
        <Text style={styles.title} numberOfLines={2}>
          {banner.title}
        </Text>
      )}
      {!!banner.subtitle && !compact && (
        <Text style={styles.subtitle} numberOfLines={2}>
          {banner.subtitle}
        </Text>
      )}
      {!!banner.description && !compact && (
        <Text style={styles.desc} numberOfLines={3}>
          {banner.description}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.sm,
  },
  compact: {
    paddingBottom: 4,
  },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 16,
  },
  subtitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  desc: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    lineHeight: 18,
  },
});
