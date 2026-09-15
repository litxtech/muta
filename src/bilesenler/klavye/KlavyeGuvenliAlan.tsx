import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKlavyeYuksekligi } from './useKlavyeYuksekligi';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS KeyboardAvoidingView offset / Android ekstra pad */
  offset?: number;
};

/**
 * Form / sohbet klavye güvenliği.
 * iOS: KeyboardAvoidingView padding.
 * Android: ölçülen klavye yüksekliği (resize yoksa); çift yükseltmeyi engeller.
 *
 * Caller `flex` / `flexGrow` / `flexBasis` verdiyse varsayılan `flex:1` uygulanmaz.
 * Aksi halde `flex:1` + `flexGrow:0` birleşimi Android’de yüksekliği 0 yapar
 * (overflow:hidden → kart görünmez, sadece overlay kalır).
 */
export function KlavyeGuvenliAlan({ children, style, offset = 0 }: Props) {
  const { yukseklik, acik } = useKlavyeYuksekligi(offset);

  const rootStyle = useMemo(() => {
    const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
    const callerControlsFlex =
      flat != null &&
      (flat.flex != null || flat.flexGrow != null || flat.flexBasis != null);
    return [!callerControlsFlex && styles.flex, style];
  }, [style]);

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={rootStyle}
        behavior="padding"
        keyboardVerticalOffset={offset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[rootStyle, acik ? { paddingBottom: yukseklik } : null]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
