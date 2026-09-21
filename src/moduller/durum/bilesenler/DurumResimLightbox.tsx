import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  uri: string | null;
  onClose: () => void;
};

function httpsUriMi(uri: string | null | undefined): uri is string {
  return typeof uri === 'string' && /^https?:\/\//i.test(uri.trim());
}

/**
 * Tam ekran durum resmi.
 * Geçersiz/boş uri → modal açılmaz (Image crash yok).
 * fullScreenModal üstünde de güvenli: overFullScreen + ayrı backdrop.
 */
export function DurumResimLightbox({ uri, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeUri = httpsUriMi(uri) ? uri.trim() : null;

  // visible=false Modal Android/iOS'ta siyah overlay bırakabiliyor — unmount.
  if (!safeUri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root} accessibilityViewIsModal>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Resmi kapat"
        />

        <View style={styles.icerik} pointerEvents="box-none">
          <Image
            source={{ uri: safeUri }}
            style={{
              width,
              height: Math.max(120, height - insets.top - insets.bottom),
            }}
            resizeMode="contain"
            accessibilityLabel="Büyütülmüş durum resmi"
          />
        </View>

        <Pressable
          style={[styles.kapatBtn, { top: Math.max(12, insets.top + 8) }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Kapat"
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <Text style={[styles.ipucu, { bottom: Math.max(16, insets.bottom + 12) }]}>
          Boşluğa dokunarak kapat
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  icerik: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kapatBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ipucu: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 3,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
});
