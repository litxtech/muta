/**
 * LightningLayer — gerçekçi çok kollu şimşek + ekran flaşı.
 * Ambient (kozmetik) + event controlled (asa vuruşu / multiplier) strike.
 */

import React, {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type LightningHandle = {
  strike(intensity?: 'small' | 'large'): void;
};

type Props = {
  ambient?: boolean;
  ambientIntervalMs?: number;
  reduceFlash?: boolean;
};

type BoltSeg = { dx: number; rotate: string; w: number };
type Bolt = { id: number; x: number; segs: BoltSeg[]; bright: number };

const FLASH_SMALL = 0.22;
const FLASH_LARGE = 0.42;
const FLASH_REDUCED = 0.1;

function buildSegs(count: number, jagged: number): BoltSeg[] {
  const segs: BoltSeg[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    segs.push({
      dx: side * (6 + Math.random() * jagged),
      rotate: `${side * (10 + Math.random() * 18)}deg`,
      w: 2 + Math.random() * 2.5,
    });
  }
  return segs;
}

function LightningLayerInner(
  { ambient = true, ambientIntervalMs = 9000, reduceFlash = false }: Props,
  ref: React.Ref<LightningHandle>,
) {
  const { width, height } = useWindowDimensions();
  const flash = useSharedValue(0);
  const [bolts, setBolts] = useState<Bolt[]>([]);
  const boltId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doStrike = (intensity: 'small' | 'large') => {
    const peak = reduceFlash
      ? FLASH_REDUCED
      : intensity === 'large'
        ? FLASH_LARGE
        : FLASH_SMALL;

    flash.value = withSequence(
      withTiming(peak, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(peak * 0.35, { duration: 70 }),
      withTiming(peak * 0.85, { duration: 40 }),
      withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
    );

    const mainX = 0.12 + Math.random() * 0.76;
    const segCount = intensity === 'large' ? 7 : 5;
    const next: Bolt[] = [
      {
        id: ++boltId.current,
        x: mainX,
        segs: buildSegs(segCount, intensity === 'large' ? 14 : 9),
        bright: 1,
      },
    ];
    // Yan dal
    if (intensity === 'large' || Math.random() > 0.45) {
      next.push({
        id: ++boltId.current,
        x: Math.min(0.92, Math.max(0.08, mainX + (Math.random() > 0.5 ? 0.12 : -0.12))),
        segs: buildSegs(4, 11),
        bright: 0.7,
      });
    }

    setBolts(next);
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setBolts([]), 220);
  };

  useImperativeHandle(ref, () => ({
    strike: (intensity = 'large') => doStrike(intensity),
  }));

  useEffect(() => {
    if (!ambient) return;
    let alive = true;
    const loop = () => {
      const jitter = ambientIntervalMs * (0.55 + Math.random() * 0.9);
      timerRef.current = setTimeout(() => {
        if (!alive) return;
        doStrike(Math.random() > 0.7 ? 'large' : 'small');
        loop();
      }, jitter);
    };
    loop();
    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (clearRef.current) clearTimeout(clearRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambient, ambientIntervalMs, reduceFlash]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  const segH = height * 0.085;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.flash, flashStyle]} />
      {bolts.map((b) => (
        <View
          key={b.id}
          style={[
            styles.bolt,
            {
              left: b.x * width,
              opacity: b.bright,
            },
          ]}
        >
          {/* Glow gövde */}
          <View style={styles.boltGlow}>
            {b.segs.map((seg, i) => (
              <View
                key={`g-${i}`}
                style={[
                  styles.boltSegmentGlow,
                  {
                    height: segH,
                    width: seg.w + 5,
                    transform: [
                      { translateX: seg.dx },
                      { rotate: seg.rotate },
                    ],
                  },
                ]}
              />
            ))}
          </View>
          {b.segs.map((seg, i) => (
            <View
              key={i}
              style={[
                styles.boltSegment,
                {
                  height: segH,
                  width: seg.w,
                  transform: [
                    { translateX: seg.dx },
                    { rotate: seg.rotate },
                  ],
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export const LightningLayer = memo(forwardRef(LightningLayerInner));

const styles = StyleSheet.create({
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E8F2FF',
  },
  bolt: {
    position: 'absolute',
    top: 0,
    width: 8,
    alignItems: 'center',
  },
  boltGlow: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  boltSegment: {
    backgroundColor: '#F4FAFF',
    borderRadius: 2,
    marginTop: -3,
    shadowColor: '#9ED4FF',
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  boltSegmentGlow: {
    backgroundColor: 'rgba(120,190,255,0.45)',
    borderRadius: 4,
    marginTop: -3,
  },
});
