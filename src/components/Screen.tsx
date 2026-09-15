import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type Edge = 'top' | 'bottom' | 'left' | 'right';

type Props = ViewProps & {
  edges?: Edge[];
};

/**
 * Uygulama ekran kabugu.
 * Android: klavye açıkken bottom safe-area kaldırılır (çift boşluk / input altta kalma).
 */
export function Screen({
  children,
  style,
  edges = ['top', 'bottom'],
  ...rest
}: Props) {
  const [klavyeAcik, setKlavyeAcik] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKlavyeAcik(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKlavyeAcik(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const aktifEdges = useMemo(() => {
    if (Platform.OS === 'android' && klavyeAcik) {
      return edges.filter((e) => e !== 'bottom');
    }
    return edges;
  }, [edges, klavyeAcik]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...colors.gradientNight]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={[styles.safe, style]} edges={aktifEdges} {...rest}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** Form/scroll ekranlarinda bos alana dokununca klavyeyi kapat (dokunmayi calmaz). */
export function klavyeBosluktaKapat(): void {
  Keyboard.dismiss();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
});
