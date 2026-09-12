import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

type Props = ViewProps & {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function Screen({ children, style, edges = ['top', 'bottom'], ...rest }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={[...colors.gradientNight]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={[styles.safe, style]} edges={edges} {...rest}>
        {children}
      </SafeAreaView>
    </View>
  );
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
