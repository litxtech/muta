import React, { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { BannerCampaign } from '../core/BannerTypes';
import { BannerCard } from './BannerCard';
import { BANNER_CAROUSEL_DEFAULT_MS } from '../core/BannerConstants';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';

type Props = {
  banners: BannerCampaign[];
  placement: string;
  screen?: string;
  sessionId: string;
  compact?: boolean;
  onDismiss?: (bannerId: string) => void;
};

export function BannerCarousel({
  banners,
  placement,
  screen,
  sessionId,
  compact,
  onDismiss,
}: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const autoMs = BANNER_CAROUSEL_DEFAULT_MS;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (banners.length <= 1 || paused || width <= 0) return;
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, autoMs);
    return () => clearInterval(id);
  }, [banners.length, paused, autoMs, width]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.max(0, Math.min(banners.length - 1, Math.round(x / width)));
    indexRef.current = i;
    setIndex(i);
  };

  if (banners.length === 0) return null;
  if (banners.length === 1) {
    return (
      <View style={styles.center} onLayout={onLayout}>
        <BannerCard
          banner={banners[0]}
          placement={placement}
          screen={screen}
          sessionId={sessionId}
          compact={compact}
          isVideoActive
          onDismiss={onDismiss}
        />
      </View>
    );
  }

  return (
    <View style={styles.center} onLayout={onLayout}>
      {width > 0 ? (
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
              />
            </View>
          ))}
        </ScrollView>
      ) : null}
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
  center: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'center',
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
