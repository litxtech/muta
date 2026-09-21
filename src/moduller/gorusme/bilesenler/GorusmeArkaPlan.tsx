/**
 * Görüşme edge-to-edge arka planı.
 * Gradient SafeArea'nın ARKASINDA — fiziksel ekranın tamamı.
 * İçerik flex:1 transparent; inset yalnızca children padding ile.
 */

import React, { type ReactNode } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const GORUSME_SAHNE_GRADIENT = [
  '#0B1A14',
  '#122820',
  '#0A0810',
] as const;

/** Native stack yedek — gradient üst tonu (sızıntı olursa aynı aile) */
export const GORUSME_STACK_BG = GORUSME_SAHNE_GRADIENT[0];

type Props = {
  children: ReactNode;
};

export function GorusmeArkaPlan({ children }: Props) {
  return (
    <View style={styles.root} collapsable={false}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <LinearGradient
        colors={[...GORUSME_SAHNE_GRADIENT]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />
      {/* flex:1 — absoluteFill + box-none overlay'leri yutuyordu */}
      <View style={styles.icerik} collapsable={false}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: GORUSME_STACK_BG,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  icerik: {
    flex: 1,
    width: '100%',
    zIndex: 1,
    elevation: 1,
    backgroundColor: 'transparent',
  },
});
