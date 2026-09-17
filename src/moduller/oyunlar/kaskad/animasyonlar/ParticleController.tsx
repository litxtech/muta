/**

 * ParticleController — AAA cascade partikül sistemi.

 * Kristal shard + kıvılcım + yerçekimi; düşük profilde otomatik sadeleşir.

 */



import React, { memo, useEffect, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';

import Animated, {

  Easing,

  useAnimatedStyle,

  useSharedValue,

  withDelay,

  withTiming,

} from 'react-native-reanimated';

import type { PerformanceProfile } from '../tipler/KaskadTipleri';



export type ParticlePreset =

  | 'CRYSTAL_BREAK'

  | 'STORM_SPARK'

  | 'MULTIPLIER_ENERGY'

  | 'SCATTER_PORTAL'

  | 'BIG_WIN'

  | 'SUPER_WIN';



type PresetDef = {

  count: number;

  colors: string[];

  minDistance: number;

  maxDistance: number;

  sizeMin: number;

  sizeMax: number;

  durationMs: number;

  gravity: number;

  shardRatio: number;

};



const PRESETS: Record<ParticlePreset, PresetDef> = {

  CRYSTAL_BREAK: {

    count: 8,

    colors: ['#8FD0FF', '#C7E7FF', '#E8F6FF', '#5BA8FF', '#FFE08A'],

    minDistance: 22,

    maxDistance: 58,

    sizeMin: 3,

    sizeMax: 9,

    durationMs: 520,

    gravity: 42,

    shardRatio: 0.65,

  },

  STORM_SPARK: {

    count: 8,

    colors: ['#6FE3FF', '#CFF6FF', '#FFFFFF', '#9ED4FF'],

    minDistance: 24,

    maxDistance: 72,

    sizeMin: 2,

    sizeMax: 6,

    durationMs: 560,

    gravity: 18,

    shardRatio: 0.25,

  },

  MULTIPLIER_ENERGY: {

    count: 10,

    colors: ['#FF6B9D', '#FFB3C9', '#FFE08A', '#6FE3FF', '#FFFFFF'],

    minDistance: 28,

    maxDistance: 86,

    sizeMin: 3,

    sizeMax: 10,

    durationMs: 720,

    gravity: 28,

    shardRatio: 0.4,

  },

  SCATTER_PORTAL: {

    count: 10,

    colors: ['#A78BFA', '#C4B5FD', '#EDE9FE', '#6FE3FF', '#FFE08A'],

    minDistance: 30,

    maxDistance: 90,

    sizeMin: 3,

    sizeMax: 8,

    durationMs: 760,

    gravity: 12,

    shardRatio: 0.35,

  },

  BIG_WIN: {

    count: 18,

    colors: ['#C9A24A', '#FFE28A', '#FFF6D0', '#FFFFFF', '#6FE3FF'],

    minDistance: 50,

    maxDistance: 180,

    sizeMin: 4,

    sizeMax: 12,

    durationMs: 2400,

    gravity: 88,

    shardRatio: 0.45,

  },

  SUPER_WIN: {

    count: 24,

    colors: ['#C9A24A', '#FFE28A', '#FFFFFF', '#FF6B9D', '#6FE3FF', '#A78BFA'],

    minDistance: 70,

    maxDistance: 240,

    sizeMin: 4,

    sizeMax: 14,

    durationMs: 2800,

    gravity: 108,

    shardRatio: 0.5,

  },

};



const PROFILE_FACTOR: Record<PerformanceProfile, number> = {

  HIGH: 0.7,

  MEDIUM: 0.4,

  LOW: 0.2,

};



type ParticleSpec = {

  dx: number;

  dy: number;

  size: number;

  color: string;

  delayMs: number;

  rotate: number;

  isShard: boolean;

  gravity: number;

};



function buildSpecs(preset: PresetDef, profile: PerformanceProfile): ParticleSpec[] {

  const count = Math.max(3, Math.round(preset.count * PROFILE_FACTOR[profile]));

  const specs: ParticleSpec[] = [];

  for (let i = 0; i < count; i += 1) {

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.7;

    const dist =

      preset.minDistance + Math.random() * (preset.maxDistance - preset.minDistance);

    const isShard = Math.random() < preset.shardRatio;

    specs.push({

      dx: Math.cos(angle) * dist,

      dy: Math.sin(angle) * dist - 8 - Math.random() * 18,

      size: preset.sizeMin + Math.random() * (preset.sizeMax - preset.sizeMin),

      color: preset.colors[i % preset.colors.length]!,

      delayMs: Math.random() * 90,

      rotate: (Math.random() - 0.5) * 420,

      isShard,

      gravity: preset.gravity * (0.7 + Math.random() * 0.6),

    });

  }

  return specs;

}



function Particle({ spec, durationMs }: { spec: ParticleSpec; durationMs: number }) {

  const progress = useSharedValue(0);



  useEffect(() => {

    progress.value = withDelay(

      spec.delayMs,

      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) }),

    );

  }, [durationMs, progress, spec.delayMs]);



  const style = useAnimatedStyle(() => {

    const p = progress.value;

    const g = spec.gravity * p * p;

    return {

      transform: [

        { translateX: spec.dx * p },

        { translateY: spec.dy * p + g },

        { rotate: `${spec.rotate * p}deg` },

        { scale: 1 - p * 0.55 },

      ],

      opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,

    };

  });



  const w = spec.isShard ? spec.size * 0.55 : spec.size;

  const h = spec.isShard ? spec.size * 1.7 : spec.size;



  return (

    <Animated.View

      pointerEvents="none"

      style={[

        styles.particle,

        {

          width: w,

          height: h,

          borderRadius: spec.isShard ? 2 : spec.size / 2,

          backgroundColor: spec.color,

          shadowColor: spec.color,

          shadowOpacity: 0.85,

          shadowRadius: 4,

        },

        style,

      ]}

    />

  );

}



type BurstProps = {

  preset: ParticlePreset;

  performance?: PerformanceProfile;

  x: number;

  y: number;

  onDone?: () => void;

};



function ParticleBurstInner({ preset, performance = 'HIGH', x, y, onDone }: BurstProps) {

  const def = PRESETS[preset];

  const specs = useMemo(() => buildSpecs(def, performance), [def, performance]);



  useEffect(() => {

    const t = setTimeout(() => onDone?.(), def.durationMs + 140);

    return () => clearTimeout(t);

  }, [def.durationMs, onDone]);



  return (

    <View pointerEvents="none" style={[styles.origin, { left: x, top: y }]}>

      {specs.map((spec, i) => (

        // eslint-disable-next-line react/no-array-index-key

        <Particle key={i} spec={spec} durationMs={def.durationMs} />

      ))}

    </View>

  );

}



export const ParticleBurst = memo(ParticleBurstInner);



export type ActiveBurst = {

  id: string;

  preset: ParticlePreset;

  x: number;

  y: number;

};



let burstCounter = 0;

export function newBurstId(): string {

  burstCounter += 1;

  return `burst_${burstCounter}`;

}



const styles = StyleSheet.create({

  origin: {

    position: 'absolute',

    width: 1,

    height: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },

  particle: {

    position: 'absolute',

  },

});


