import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CuzdanUiIcon, CuzdanCoinDisplay } from '../ui-config/CuzdanUiTipleri';

type Props = {
  icon: CuzdanUiIcon | CuzdanCoinDisplay;
  fallbackIonicon?: keyof typeof Ionicons.glyphMap;
  style?: object;
};

/** Merkezi cüzdan / coin simgesi — URL fail → ionicon fallback */
export function CuzdanDinamikSimge({
  icon,
  fallbackIonicon = 'wallet-outline',
  style,
}: Props) {
  const visible = 'visible' in icon ? icon.visible !== false : true;
  const [urlFail, setUrlFail] = useState(false);
  if (!visible) return null;

  const size = Number(icon.size) || 22;
  const color = icon.color || '#FFFFFF';
  const opacity = 'opacity' in icon ? Number(icon.opacity ?? 1) : 1;
  const bg = 'background' in icon ? icon.background : undefined;
  const radius = 'radius' in icon ? Number(icon.radius ?? 12) : 12;
  const url = icon.url?.trim();
  const ionRaw = icon.ionicon;
  const ion: keyof typeof Ionicons.glyphMap =
    ionRaw && ionRaw in Ionicons.glyphMap
      ? (ionRaw as keyof typeof Ionicons.glyphMap)
      : fallbackIonicon;

  const showUrl =
    (icon.source === 'url' || (!!url && icon.source !== 'ionicon')) &&
    !!url &&
    !urlFail;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size + 12,
          height: size + 12,
          borderRadius: radius,
          backgroundColor: bg || 'transparent',
          opacity,
        },
        style,
      ]}
    >
      {showUrl ? (
        <Image
          source={{ uri: url! }}
          style={{ width: size, height: size }}
          onError={() => setUrlFail(true)}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name={ion || fallbackIonicon} size={size} color={color} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
