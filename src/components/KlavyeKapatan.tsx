import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Form sarmalayici — dokunmayı / TextInput focus'unu ASLA kesmez.
 * Klavyeyi kapatmak için ScrollView: keyboardShouldPersistTaps="handled"
 * + keyboardDismissMode="on-drag" kullan.
 *
 * Eski capture+dismiss Android'de input'u kapatıyordu.
 */
export function KlavyeKapatan({ children, style }: Props) {
  return <View style={[styles.wrap, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
  },
});
