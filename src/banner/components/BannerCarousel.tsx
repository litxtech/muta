import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { BannerCampaign } from '../core/BannerTypes';
import { BannerCard } from './BannerCard';
import {
  BANNER_CAROUSEL_DEFAULT_MS,
} from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  banners: BannerCampaign[];
  placement: string;
  screen?: string;
  sessionId: string;
  compact?: boolean;
  onDismiss?: (bannerId: string) => void;
  debug?: boolean;
};

export function BannerCarousel({
  banners,
  placement,
  screen,
  sessionId,
  compact,
  onDismiss,
  debug,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width - BoslukTokenlari.lg * 2;
  const autoMs =
    banners[0]?.carousel_auto_slide_ms ?? BANNER_CAROUSEL_DEFAULT_MS;

  useEffect(() => {
    if (banners.length <= 1 || paused || !autoMs || autoMs <= 0) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, autoMs);
    return () => clearInterval(id);
  }, [banners.length, paused, autoMs, width]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    setIndex(i);
  };

  if (banners.length === 0) return null;
  if (banners.length === 1) {
    return (
      <BannerCard
        banner={banners[0]}
        placement={placement}
        screen={screen}
        sessionId={sessionId}
        compact={compact}
        isVideoActive
        onDismiss={onDismiss}
        debug={debug}
      />
    );
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={(e) => {
          onScrollEnd(e);
          setPaused(false);
        }}
        decelerationRate="fast"
        style={{ width }}
      >
        {banners.map((b, i) => (
          <View key={b.id} style={{ width }}>
            <BannerCard
              banner={b}
              placement={placement}
              screen={screen}
              sessionId={sessionId}
              compact={compact}
              isVideoActive={i === index}
              onDismiss={onDismiss}
              debug={debug}
            />
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {banners.map((b, i) => (
          <View
            key={b.id}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: RenkTokenlari.primarySoft,
    width: 14,
  },
});
