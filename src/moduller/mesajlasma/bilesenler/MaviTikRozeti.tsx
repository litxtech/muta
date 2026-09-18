import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  size?: number;
  /** Platform resmi / yargıç — mavi tik */
  platformMu?: boolean;
};

/** Modern mavi doğrulama rozeti (yargıç / platform resmi hesap) */
export function MaviTikRozeti({ size = 16, platformMu = true }: Props) {
  if (!platformMu) return null;
  const ikon = Math.max(10, Math.round(size * 0.72));
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['#4DA3FF', '#1D6FE8', '#0B4EC4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.grad, { borderRadius: size / 2 }]}
      >
        <Ionicons name="checkmark" size={ikon} color="#fff" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grad: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
