import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Heart = {
  id: string;
  x: number;
  y: number;
};

type Props = {
  burst?: { id: string; x: number; y: number } | null;
};

function Kalp({
  item,
  onDone,
}: {
  item: Heart;
  onDone: (id: string) => void;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(
      1,
      { duration: 900, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onDone)(item.id);
      },
    );
  }, [item.id, onDone, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateY: -t.value * 120 },
      { translateX: Math.sin(t.value * 6) * 18 },
      { scale: 0.7 + t.value * 0.6 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.kalp,
        { left: item.x - 12, top: item.y - 12 },
        style,
      ]}
    >
      <Text style={styles.emoji}>❤️</Text>
    </Animated.View>
  );
}

/** Ekrana dokununca yükselen kalpler */
export function CanliBegeniEfekti({ burst }: Props) {
  const [items, setItems] = useState<Heart[]>([]);

  useEffect(() => {
    if (!burst) return;
    setItems((prev) => [...prev.slice(-12), burst]);
  }, [burst]);

  const sil = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item) => (
        <Kalp key={item.id} item={item} onDone={sil} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kalp: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
});
