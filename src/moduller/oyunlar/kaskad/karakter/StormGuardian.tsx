/**
 * The Storm Keeper — premium PNG karakter + animasyonlu aura / enerji overlay.
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CharacterImages } from '../assets/VisualAssets';
import type { CharacterState, PerformanceProfile } from '../tipler/KaskadTipleri';
import type { CharacterMachine } from './CharacterStateMachine';

type Props = {
  machine: CharacterMachine;
  size?: number;
  performance?: PerformanceProfile;
  reduceMotion?: boolean;
};

function StormGuardianInner({
  machine,
  size = 168,
  performance = 'HIGH',
  reduceMotion = false,
}: Props) {
  const [state, setState] = useState<CharacterState>('IDLE');
  const breath = useSharedValue(0);
  const lean = useSharedValue(0);
  const raise = useSharedValue(0);
  const flash = useSharedValue(0);
  const scale = useSharedValue(1);
  const aura = useSharedValue(0.4);
  const orbPulse = useSharedValue(0.5);
  const ringSpin = useSharedValue(0);
  const bolt = useSharedValue(0);
  const machineRef = useRef(machine);
  machineRef.current = machine;

  useEffect(() => machineRef.current.subscribe(setState), [machine]);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      aura.value = 0.35;
      orbPulse.value = 0.55;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    aura.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.4, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    ringSpin.value = withRepeat(
      withTiming(360, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [aura, breath, orbPulse, reduceMotion, ringSpin]);

  useEffect(() => {
    switch (state) {
      case 'WATCHING':
        lean.value = withTiming(-5, { duration: 280 });
        break;
      case 'CAST_SMALL':
        lean.value = withSequence(
          withTiming(-12, { duration: 100 }),
          withTiming(7, { duration: 140 }),
          withTiming(0, { duration: 280 }),
        );
        flash.value = withSequence(
          withTiming(0.9, { duration: 60 }),
          withTiming(0, { duration: 340 }),
        );
        scale.value = withSequence(
          withTiming(1.07, { duration: 90 }),
          withSpring(1),
        );
        bolt.value = withSequence(
          withTiming(1, { duration: 50 }),
          withTiming(0, { duration: 380 }),
        );
        aura.value = withSequence(
          withTiming(1, { duration: 70 }),
          withTiming(0.4, { duration: 400 }),
        );
        break;
      case 'CAST_MEDIUM':
        lean.value = withSequence(
          withTiming(-16, { duration: 120 }),
          withTiming(10, { duration: 160 }),
          withTiming(0, { duration: 360 }),
        );
        flash.value = withSequence(
          withTiming(1, { duration: 70 }),
          withTiming(0, { duration: 400 }),
        );
        scale.value = withSequence(
          withTiming(1.11, { duration: 110 }),
          withSpring(1),
        );
        bolt.value = withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(0.3, { duration: 200 }),
          withTiming(0, { duration: 320 }),
        );
        break;
      case 'CAST_LARGE':
      case 'BONUS_TRIGGER':
        raise.value = withSequence(
          withSpring(1, { damping: 7, stiffness: 140 }),
          withTiming(0, { duration: 700 }),
        );
        lean.value = withSequence(
          withTiming(-18, { duration: 140 }),
          withTiming(14, { duration: 170 }),
          withTiming(0, { duration: 460 }),
        );
        flash.value = withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0, { duration: 540 }),
        );
        scale.value = withSequence(
          withTiming(1.16, { duration: 130 }),
          withSpring(1),
        );
        bolt.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 80 }),
            withTiming(0.2, { duration: 120 }),
          ),
          4,
          false,
        );
        aura.value = withSequence(
          withTiming(1, { duration: 90 }),
          withTiming(0.45, { duration: 580 }),
        );
        break;
      case 'BIG_WIN':
      case 'SUPER_WIN':
        raise.value = withSequence(
          withSpring(1.25, { damping: 7, stiffness: 120 }),
          withTiming(0.5, { duration: 1100 }),
          withTiming(0, { duration: 480 }),
        );
        flash.value = withSequence(
          withTiming(1, { duration: 70 }),
          withTiming(0.5, { duration: 380 }),
          withTiming(0, { duration: 650 }),
        );
        scale.value = withRepeat(
          withSequence(
            withTiming(1.09, { duration: 190 }),
            withTiming(1, { duration: 190 }),
          ),
          5,
          true,
        );
        aura.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 200 }),
            withTiming(0.5, { duration: 200 }),
          ),
          6,
          true,
        );
        bolt.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 90 }),
            withTiming(0.15, { duration: 110 }),
          ),
          8,
          false,
        );
        break;
      default:
        lean.value = withTiming(0, { duration: 300 });
        raise.value = withTiming(0, { duration: 300 });
        flash.value = withTiming(0, { duration: 180 });
        bolt.value = withTiming(0, { duration: 200 });
        scale.value = withSpring(1);
        break;
    }
  }, [aura, bolt, flash, lean, raise, scale, state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: breath.value * 5 - raise.value * 16 },
      { rotate: `${lean.value}deg` },
      { scale: scale.value * (1 + breath.value * 0.014) },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.65,
  }));

  const auraStyle = useAnimatedStyle(() => ({
    opacity: aura.value * 0.7,
    transform: [{ scale: 0.88 + aura.value * 0.22 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringSpin.value}deg` }],
    opacity: 0.35 + orbPulse.value * 0.45,
  }));

  const boltStyle = useAnimatedStyle(() => ({
    opacity: bolt.value * 0.9,
  }));

  const coreGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + orbPulse.value * 0.55,
    transform: [{ scale: 0.9 + orbPulse.value * 0.2 }],
  }));

  const w = size * 1.05;
  const h = size * 1.55;
  const low = performance === 'LOW';

  return (
    <View
      pointerEvents="none"
      style={{ width: w, height: h }}
      accessibilityLabel="The Storm Keeper"
    >
      {!low ? (
        <Animated.View
          style={[
            styles.aura,
            { width: w * 1.35, height: h * 0.9, borderRadius: w },
            auraStyle,
          ]}
        >
          <LinearGradient
            colors={[
              'rgba(111,227,255,0.55)',
              'rgba(201,162,74,0.22)',
              'transparent',
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0.2 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      ) : null}

      {!low ? (
        <Animated.View
          style={[
            styles.flash,
            { width: w * 1.1, height: h * 1.05, borderRadius: w / 2 },
            flashStyle,
          ]}
        />
      ) : null}

      <Animated.View style={[{ width: w, height: h }, bodyStyle]}>
        {!low ? (
          <Animated.View
            style={[
              styles.energyRing,
              {
                width: w * 0.72,
                height: w * 0.72,
                borderRadius: w,
                top: h * 0.18,
                left: w * 0.14,
              },
              ringStyle,
            ]}
          />
        ) : null}

        <Image
          source={CharacterImages.stormKeeper}
          style={{
            width: w,
            height: h,
            resizeMode: 'contain',
          }}
          fadeDuration={0}
        />

        {!low ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.chestCore,
              {
                width: w * 0.14,
                height: w * 0.14,
                borderRadius: w,
                top: h * 0.42,
                left: w * 0.43,
              },
              coreGlowStyle,
            ]}
          />
        ) : null}

        {!low ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.boltLayer, { width: w, height: h }, boltStyle]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(111,227,255,0.85)', 'transparent']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={[
                styles.bolt,
                {
                  width: w * 0.08,
                  height: h * 0.55,
                  top: h * 0.12,
                  left: w * 0.18,
                  transform: [{ rotate: '-18deg' }],
                },
              ]}
            />
            <LinearGradient
              colors={['transparent', 'rgba(255,224,138,0.9)', 'transparent']}
              start={{ x: 0.8, y: 0 }}
              end={{ x: 0.1, y: 1 }}
              style={[
                styles.bolt,
                {
                  width: w * 0.06,
                  height: h * 0.42,
                  top: h * 0.2,
                  right: w * 0.12,
                  transform: [{ rotate: '22deg' }],
                },
              ]}
            />
          </Animated.View>
        ) : null}

        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(8,10,20,0.35)']}
          style={[
            styles.floorFade,
            { width: w * 1.1, height: h * 0.22, bottom: 0, left: -w * 0.05 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

export const StormGuardian = memo(StormGuardianInner);

const styles = StyleSheet.create({
  aura: {
    position: 'absolute',
    alignSelf: 'center',
    top: '6%',
    overflow: 'hidden',
  },
  flash: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    backgroundColor: 'rgba(111,227,255,0.45)',
  },
  energyRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(111,227,255,0.45)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  chestCore: {
    position: 'absolute',
    backgroundColor: 'rgba(111,227,255,0.55)',
    shadowColor: '#6FE3FF',
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  boltLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  bolt: {
    position: 'absolute',
    borderRadius: 8,
  },
  floorFade: {
    position: 'absolute',
  },
});
