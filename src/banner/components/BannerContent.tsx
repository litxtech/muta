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
  overlay?: boolean;
};

export function BannerContent({ banner, compact, overlay }: Props) {
  const hasText =
    banner.title ||
    banner.subtitle ||
    banner.description ||
    banner.badge ||
    (banner.tags?.length ?? 0) > 0;

  if (!hasText) return null;

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compact,
        overlay && styles.overlay,
      ]}
      pointerEvents="box-none"
    >
      <BannerBadge text={banner.badge ?? banner.label} tags={banner.tags} />
      {!!banner.title && (
        <Text style={[styles.title, overlay && styles.titleOverlay]} numberOfLines={1}>
          {banner.title}
        </Text>
      )}
      {!!banner.subtitle && (overlay || !compact) && (
        <Text
          style={[styles.subtitle, overlay && styles.subtitleOverlay]}
          numberOfLines={1}
        >
          {banner.subtitle}
        </Text>
      )}
      {!!banner.description && !compact && !overlay && (
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
    gap: 2,
  },
  overlay: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: 10,
    paddingTop: 8,
  },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 16,
  },
  titleOverlay: {
    fontSize: 14,
    lineHeight: 18,
  },
  subtitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  subtitleOverlay: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
  },
  desc: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    lineHeight: 18,
  },
});
