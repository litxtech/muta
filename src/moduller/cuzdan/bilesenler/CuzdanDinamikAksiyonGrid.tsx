import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CuzdanUiAction } from '../ui-config/CuzdanUiTipleri';

type Props = {
  actions: CuzdanUiAction[];
  onPress: (action: CuzdanUiAction) => void;
};

/**
 * Dinamik aksiyon grid — gizlenen buton boşluk bırakmaz.
 * 1 → full width, 2 → 2 kolon, 3+ → wrap.
 */
export function CuzdanDinamikAksiyonGrid({ actions, onPress }: Props) {
  if (!actions.length) return null;
  const n = actions.length;
  const kolon = n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 2;

  return (
    <View style={styles.grid}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => onPress(a)}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: a.background_color || 'rgba(255,255,255,0.06)',
              flexBasis: `${Math.floor(100 / kolon) - 2}%`,
              flexGrow: 1,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={a.title}
        >
          <Ionicons
            name={
              a.icon && a.icon in Ionicons.glyphMap
                ? (a.icon as keyof typeof Ionicons.glyphMap)
                : 'ellipse-outline'
            }
            size={18}
            color={a.icon_color || '#fff'}
          />
          <View style={styles.metin}>
            <Text
              style={[styles.title, { color: a.text_color || '#fff' }]}
              numberOfLines={2}
            >
              {a.title}
            </Text>
            {a.subtitle ? (
              <Text style={styles.sub} numberOfLines={1}>
                {a.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: '46%',
  },
  metin: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
});
