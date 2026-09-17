/**
 * NOX REELS — DEV ONLY debug paneli.
 */

import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  onForce: (kind: 'small' | 'big' | 'scatter' | 'wild' | 'none' | 'slow' | 'skip') => void;
};

function SlotDebugPanelInner({ onForce }: Props) {
  if (!__DEV__) return null;
  const btn = (
    label: string,
    kind: Parameters<Props['onForce']>[0],
  ) => (
    <Pressable key={kind} onPress={() => onForce(kind)} style={styles.btn}>
      <Text style={styles.txt}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>DEV DEBUG</Text>
      {btn('Small Win', 'small')}
      {btn('Big Win', 'big')}
      {btn('3 Scatter', 'scatter')}
      {btn('Wild', 'wild')}
      {btn('No Win', 'none')}
      {btn('Slow Reels', 'slow')}
      {btn('Skip Anim', 'skip')}
    </View>
  );
}

export const SlotDebugPanel = memo(SlotDebugPanelInner);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
    borderRadius: 8,
    gap: 4,
    zIndex: 50,
  },
  title: { color: '#F66', fontSize: 9, fontWeight: '800' },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  txt: { color: '#EEE', fontSize: 9 },
});
