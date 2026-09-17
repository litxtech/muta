/**
 * Profil avatar çerçevesi — altın halka + üstte taç motifleri.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const GOLD = ['#F8E7A0', '#D4AF37', '#B8860B', '#F0D78C'] as const;
const GOLD_SOFT = 'rgba(212, 175, 55, 0.55)';

type Props = {
  size: number;
  children: React.ReactNode;
};

export function ProfilAvatarCerceve({ size, children }: Props) {
  const ring = size + 14;
  const outer = size + 28;

  return (
    <View style={[styles.wrap, { width: outer, height: outer + 18 }]}>
      {/* Üst taç */}
      <View style={[styles.tacWrap, { width: outer }]} pointerEvents="none">
        <LinearGradient colors={[...GOLD]} style={styles.tacMerkez}>
          <Ionicons name="diamond" size={11} color="#3A2A08" />
        </LinearGradient>
        <View style={[styles.tacDis, styles.tacSol]}>
          <LinearGradient colors={[...GOLD]} style={styles.tacUc}>
            <View style={styles.tacNokta} />
          </LinearGradient>
        </View>
        <View style={[styles.tacDis, styles.tacSag]}>
          <LinearGradient colors={[...GOLD]} style={styles.tacUc}>
            <View style={styles.tacNokta} />
          </LinearGradient>
        </View>
      </View>

      {/* Altın halka */}
      <LinearGradient
        colors={[...GOLD]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.halka,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
          },
        ]}
      >
        <View
          style={[
            styles.halkaIc,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: (size + 4) / 2,
            },
          ]}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
            }}
          >
            {children}
          </View>
        </View>
      </LinearGradient>

      {/* Yan süs taçlar */}
      <View style={[styles.yanSus, styles.yanSol]} pointerEvents="none">
        <LinearGradient colors={[...GOLD]} style={styles.yanKutu}>
          <Ionicons name="sparkles" size={10} color="#3A2A08" />
        </LinearGradient>
      </View>
      <View style={[styles.yanSus, styles.yanSag]} pointerEvents="none">
        <LinearGradient colors={[...GOLD]} style={styles.yanKutu}>
          <Ionicons name="sparkles" size={10} color="#3A2A08" />
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tacWrap: {
    position: 'absolute',
    top: 0,
    height: 28,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 3,
  },
  tacMerkez: {
    width: 28,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,236,180,0.7)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tacDis: {
    position: 'absolute',
    top: 10,
  },
  tacSol: { left: '28%', transform: [{ rotate: '-28deg' }] },
  tacSag: { right: '28%', transform: [{ rotate: '28deg' }] },
  tacUc: {
    width: 14,
    height: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  tacNokta: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF6D0',
  },
  halka: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  halkaIc: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121018',
    borderWidth: 1,
    borderColor: GOLD_SOFT,
  },
  yanSus: {
    position: 'absolute',
    bottom: 18,
    zIndex: 2,
  },
  yanSol: { left: 0 },
  yanSag: { right: 0 },
  yanKutu: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,236,180,0.55)',
  },
});
