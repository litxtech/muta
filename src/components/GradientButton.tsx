import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, typography } from '../theme/colors';

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'gold';
  style?: ViewStyle;
};

export function GradientButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: Props) {
  const isGhost = variant === 'ghost';
  const gradient =
    variant === 'gold' ? colors.gradientGold : colors.gradientPrimary;

  if (isGhost) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.ghost, (disabled || loading) && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.press, (disabled || loading) && styles.disabled, style]}
    >
      <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradient}>
        {loading ? (
          <ActivityIndicator color="#0B0614" />
        ) : (
          <Text style={[styles.title, styles.titleDark]}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  gradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ghost: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgGlass,
    paddingHorizontal: 20,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  titleDark: {
    color: '#12040C',
  },
  disabled: {
    opacity: 0.45,
  },
});
