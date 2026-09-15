import React, { useCallback, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  BANNER_BG,
  BANNER_BORDER,
  BANNER_BORDER_RADIUS,
  BANNER_TAP_MAX_MOVE_PX,
  resolveBannerAspect,
} from '../core/BannerConstants';
import type { BannerAction, BannerCampaign } from '../core/BannerTypes';
import { BannerImage } from './BannerImage';
import { BannerVideo } from './BannerVideo';
import { BannerContent } from './BannerContent';
import { BannerCTA } from './BannerCTA';
import { useBannerTracking } from '../hooks/useBannerTracking';
import { BannerActionService } from '../services/BannerActionService';
import { BannerTrackingService } from '../services/BannerTrackingService';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  banner: BannerCampaign;
  placement: string;
  screen?: string;
  sessionId: string;
  compact?: boolean;
  isVideoActive?: boolean;
  onDismiss?: (bannerId: string) => void;
  debug?: boolean;
};

export function BannerCard({
  banner,
  placement,
  screen,
  sessionId,
  compact,
  isVideoActive = true,
  onDismiss,
  debug,
}: Props) {
  const aspect = useMemo(
    () => resolveBannerAspect(banner.size_type, banner.aspect_ratio),
    [banner.size_type, banner.aspect_ratio],
  );

  const { onVisibilityChange, trackEvent } = useBannerTracking({
    bannerId: banner.id,
    sessionId,
    placement,
    screen,
  });

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const heightRef = useRef(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      heightRef.current = e.nativeEvent.layout.height;
      // Layout anında kısmi görünürlük varsay — parent ScrollView offset yoksa
      onVisibilityChange(0.6);
    },
    [onVisibilityChange],
  );

  const mediaType = banner.media_type;
  const showVideo =
    (mediaType === 'VIDEO' || mediaType === 'VIDEO_TEXT') && !!banner.media_url;
  const showImage =
    (mediaType === 'IMAGE' ||
      mediaType === 'IMAGE_TEXT' ||
      mediaType === 'VIDEO_TEXT') &&
    !!banner.media_url &&
    !showVideo;
  const showGradient = mediaType === 'GRADIENT';
  const showText =
    mediaType === 'IMAGE_TEXT' ||
    mediaType === 'VIDEO_TEXT' ||
    mediaType === 'GRADIENT' ||
    !!banner.title;

  const actions = (banner.actions ?? []).filter(
    (a) => a.action_type !== 'NONE',
  );

  const runAction = useCallback(
    async (action: BannerAction) => {
      await BannerActionService.execute({
        bannerId: banner.id,
        action,
        placement,
        screen,
      });
    },
    [banner.id, placement, screen],
  );

  const onCardPress = useCallback(() => {
    const primary = actions[0];
    if (primary) void runAction(primary);
  }, [actions, runAction]);

  const handleDismiss = useCallback(() => {
    void BannerTrackingService.trackEvent({
      bannerId: banner.id,
      eventType: 'dismiss',
      placement,
      screen,
    });
    onDismiss?.(banner.id);
  }, [banner.id, onDismiss, placement, screen]);

  return (
    <Animated.View
      entering={FadeInDown.duration(280).springify().damping(18)}
      style={[
        styles.card,
        compact && styles.compact,
        Platform.OS === 'ios' ? styles.shadowIos : styles.elevationAndroid,
      ]}
      onLayout={onLayout}
      accessibilityLabel={banner.title ?? banner.name ?? 'Tanıtım bannerı'}
    >
      <Pressable
        onPressIn={(e) => {
          touchStart.current = {
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
        }}
        onPress={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (start) {
            const dx = Math.abs(e.nativeEvent.pageX - start.x);
            const dy = Math.abs(e.nativeEvent.pageY - start.y);
            if (dx > BANNER_TAP_MAX_MOVE_PX || dy > BANNER_TAP_MAX_MOVE_PX) {
              return;
            }
          }
          onCardPress();
        }}
      >
        {showGradient && (
          <LinearGradient
            colors={
              (banner.gradient_json?.colors as [string, string]) ??
              ([RenkTokenlari.deepPlum, RenkTokenlari.primary] as [
                string,
                string,
              ])
            }
            style={[styles.gradient, { aspectRatio: aspect }]}
          />
        )}
        {showVideo && (
          <BannerVideo
            uri={banner.media_url}
            thumbnailUrl={banner.thumbnail_url}
            alt={banner.media_alt}
            aspectRatio={aspect}
            autoplay={banner.autoplay_video}
            loop={banner.loop_video}
            isActive={isVideoActive}
            onStart={() => trackEvent('video_start')}
            onComplete={() => trackEvent('video_complete')}
          />
        )}
        {showImage && (
          <BannerImage
            uri={banner.media_url}
            alt={banner.media_alt}
            aspectRatio={aspect}
          />
        )}
        {!showVideo && !showImage && !showGradient && (
          <View style={[styles.gradient, { aspectRatio: aspect, backgroundColor: RenkTokenlari.surface }]} />
        )}
      </Pressable>

      {showText && <BannerContent banner={banner} compact={compact} />}
      <BannerCTA actions={actions} onPress={(a) => void runAction(a)} />

      {banner.dismissible && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bannerı kapat"
          style={styles.dismiss}
          onPress={handleDismiss}
          hitSlop={10}
        >
          <Ionicons name="close" size={16} color={RenkTokenlari.textMuted} />
        </Pressable>
      )}

      {debug && (
        <View style={styles.debug} pointerEvents="none">
          {/* production'da kapalı */}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: BANNER_BORDER_RADIUS,
    backgroundColor: BANNER_BG,
    borderWidth: 1,
    borderColor: BANNER_BORDER,
    overflow: 'hidden',
  },
  compact: {
    maxHeight: 160,
  },
  shadowIos: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  elevationAndroid: {
    elevation: 3,
  },
  gradient: {
    width: '100%',
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  debug: {
    position: 'absolute',
    bottom: 4,
    left: 8,
  },
});
