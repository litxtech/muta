import React from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';

type Props = {
  uri: string | null;
  onClose: () => void;
};

const { width: W, height: H } = Dimensions.get('window');

/** Tam ekran resim — boş alana (veya ekrana) dokununca kapanır */
export function DurumResimLightbox({ uri, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.root}
        onPress={onClose}
        accessibilityLabel="Resmi kapat"
        accessibilityRole="button"
      >
        <Image
          source={{ uri }}
          style={styles.resim}
          resizeMode="contain"
        />
      </Pressable>
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
  resim: {
    width: W,
    height: H,
  },
});
