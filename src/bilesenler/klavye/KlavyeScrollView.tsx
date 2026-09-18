import React, { forwardRef, useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKlavyeYuksekligi } from './useKlavyeYuksekligi';

type Props = ScrollViewProps & {
  /** Android: klavye üstüne ek boşluk (px) */
  ekstraPad?: number;
};

/**
 * Form ScrollView — klavye input’u örtmesin.
 * iOS: automaticallyAdjustKeyboardInsets
 * Android: ölçülen klavye yüksekliği kadar content padding
 */
export const KlavyeScrollView = forwardRef<ScrollView, Props>(
  function KlavyeScrollView(
    { contentContainerStyle, ekstraPad = 28, style, ...rest },
    ref,
  ) {
    const { yukseklik, acik } = useKlavyeYuksekligi(0);

    const icerikStil = useMemo(() => {
      const flat = StyleSheet.flatten(contentContainerStyle) as
        | ViewStyle
        | undefined;
      const taban =
        typeof flat?.paddingBottom === 'number' ? flat.paddingBottom : 0;
      const androidPad =
        Platform.OS === 'android' && acik ? yukseklik + ekstraPad : 0;
      return [
        contentContainerStyle,
        androidPad > 0 ? { paddingBottom: taban + androidPad } : null,
      ] as StyleProp<ViewStyle>;
    }, [acik, contentContainerStyle, ekstraPad, yukseklik]);

    return (
      <ScrollView
        ref={ref}
        style={style}
        contentContainerStyle={icerikStil}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        {...rest}
      />
    );
  },
);

/** Odaklı input’u görünür alana kaydır (çekim / form alt alanları) */
export function KlavyeAlanaKaydir(
  scroll: ScrollView | null,
  opts?: { animated?: boolean; delayMs?: number },
) {
  const delay = opts?.delayMs ?? (Platform.OS === 'ios' ? 80 : 120);
  const animated = opts?.animated !== false;
  setTimeout(() => {
    scroll?.scrollToEnd({ animated });
  }, delay);
}
