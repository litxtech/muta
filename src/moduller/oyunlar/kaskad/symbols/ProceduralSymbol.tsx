/**
 * Prosedürel sembol grafikleri — PNG yerine katmanlı gradient / metal / kristal.
 * Gates of Olympus kalitesinde okunabilir silüet; özgün storm paleti.
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { KaskadSymbolType } from '../tipler/KaskadTipleri';
import { isMultiplier, isScatter } from './SymbolRules';

type GemSpec = {
  core: readonly [string, string, string];
  rim: string;
  facet: string;
  mark: string;
};

const GEMS: Record<
  Exclude<KaskadSymbolType, 'portalScatter' | 'stormMultiplier'>,
  GemSpec
> = {
  blueCrystal: {
    core: ['#9AD4FF', '#3B8CFF', '#1A4A9A'],
    rim: '#C9E7FF',
    facet: 'rgba(255,255,255,0.55)',
    mark: '◆',
  },
  greenCrystal: {
    core: ['#A8F5C8', '#2DB87A', '#0F5C3A'],
    rim: '#D4FFE8',
    facet: 'rgba(255,255,255,0.5)',
    mark: '⬡',
  },
  purpleCrystal: {
    core: ['#D4B8FF', '#8B5CF6', '#4C1D95'],
    rim: '#EDE4FF',
    facet: 'rgba(255,255,255,0.5)',
    mark: '◈',
  },
  redCrystal: {
    core: ['#FFB0A8', '#E84545', '#7F1D1D'],
    rim: '#FFD4D0',
    facet: 'rgba(255,255,255,0.48)',
    mark: '▲',
  },
  goldCrystal: {
    core: ['#FFE08A', '#C9A24A', '#6B4E12'],
    rim: '#FFF3C4',
    facet: 'rgba(255,255,255,0.55)',
    mark: '⬟',
  },
  stormRing: {
    core: ['#B8F0FF', '#3DB8E8', '#0E4A6B'],
    rim: '#E8FBFF',
    facet: 'rgba(255,224,138,0.65)',
    mark: '◎',
  },
  celestialCup: {
    core: ['#F5C4E8', '#B84A8C', '#5C1A45'],
    rim: '#FFE0F2',
    facet: 'rgba(255,255,255,0.5)',
    mark: '♛',
  },
  timeCore: {
    core: ['#D4F58A', '#7AB82D', '#3A5C10'],
    rim: '#F0FFC8',
    facet: 'rgba(255,255,255,0.5)',
    mark: '✪',
  },
  energyCrown: {
    core: ['#FFE9A0', '#E8C878', '#8A6A20'],
    rim: '#FFF8D8',
    facet: 'rgba(255,255,255,0.6)',
    mark: '♔',
  },
};

type Props = {
  symbolType: KaskadSymbolType;
  size: number;
  multiplierValue?: number | null;
};

function ProceduralSymbolInner({
  symbolType,
  size,
  multiplierValue,
}: Props) {
  const pad = size * 0.04;
  const inner = size - pad * 2;

  if (isScatter(symbolType)) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#C4B5FD', '#7C3AED', '#2E1065']}
          style={[
            styles.scatterOuter,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              borderColor: 'rgba(232,200,120,0.85)',
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(111,227,255,0.95)', 'rgba(167,139,250,0.55)', 'rgba(20,10,40,0.9)']}
            style={{
              width: inner * 0.62,
              height: inner * 0.62,
              borderRadius: inner,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: inner * 0.22,
                height: inner * 0.22,
                borderRadius: inner,
                backgroundColor: '#E8F6FF',
                shadowColor: '#6FE3FF',
                shadowOpacity: 0.9,
                shadowRadius: 8,
              }}
            />
          </LinearGradient>
        </LinearGradient>
      </View>
    );
  }

  if (isMultiplier(symbolType)) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#FFE08A', '#FF6B9D', '#6FE3FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.multOuter,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
            },
          ]}
        >
          <LinearGradient
            colors={['#1A1028', '#0B1020']}
            style={{
              width: inner * 0.82,
              height: inner * 0.82,
              borderRadius: inner,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: 'rgba(255,224,138,0.55)',
            }}
          >
            <Text
              style={[
                styles.multText,
                { fontSize: Math.max(11, inner * 0.28) },
              ]}
            >
              {multiplierValue ? `${multiplierValue}×` : '×'}
            </Text>
          </LinearGradient>
        </LinearGradient>
      </View>
    );
  }

  const gem = GEMS[symbolType as keyof typeof GEMS] ?? GEMS.blueCrystal;
  const isHigh =
    symbolType === 'stormRing' ||
    symbolType === 'celestialCup' ||
    symbolType === 'timeCore' ||
    symbolType === 'energyCrown';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={[gem.rim, 'rgba(20,16,32,0.9)', gem.core[2]]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={[
          styles.frame,
          {
            width: inner,
            height: inner,
            borderRadius: isHigh ? inner * 0.22 : inner * 0.28,
            borderColor: gem.rim,
          },
        ]}
      >
        <LinearGradient
          colors={[...gem.core]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[
            styles.core,
            {
              width: inner * 0.78,
              height: inner * 0.78,
              borderRadius: isHigh ? inner * 0.16 : inner * 0.22,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.facet,
              {
                width: inner * 0.34,
                height: inner * 0.18,
                backgroundColor: gem.facet,
                top: inner * 0.1,
                left: inner * 0.12,
              },
            ]}
          />
          <Text
            style={[
              styles.mark,
              {
                fontSize: inner * (isHigh ? 0.34 : 0.38),
                textShadowColor: gem.core[2],
              },
            ]}
          >
            {gem.mark}
          </Text>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

export const ProceduralSymbol = memo(ProceduralSymbolInner);

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#6FE3FF',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  facet: {
    position: 'absolute',
    borderRadius: 20,
    transform: [{ rotate: '-18deg' }],
  },
  mark: {
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '800',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scatterOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    shadowColor: '#A78BFA',
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  multOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  multText: {
    color: '#FFF8E8',
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
