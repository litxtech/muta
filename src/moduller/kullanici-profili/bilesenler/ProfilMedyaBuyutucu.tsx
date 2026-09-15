import React, { useEffect, useState } from 'react';
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
  onKapat: () => void;
  /** Kapak yatay, avatar kare — yalnızca erişilebilirlik / varsayılan oran */
  tur?: 'avatar' | 'cover';
};

/**
 * Profil / kapak tam ekran önizleme.
 * Boş (siyah) alana basınca kapanır; fotoğraf alanına basınca açık kalır.
 */
export function ProfilMedyaBuyutucu({ uri, onKapat, tur = 'avatar' }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const acik = Boolean(uri);
  const [boyut, setBoyut] = useState({ w: width * 0.92, h: height * 0.55 });

  useEffect(() => {
    if (!uri) return;
    const maxW = width;
    const maxH = height - insets.top - insets.bottom - 48;
    Image.getSize(
      uri,
      (iw, ih) => {
        if (iw <= 0 || ih <= 0) return;
        const scale = Math.min(maxW / iw, maxH / ih);
        setBoyut({
          w: Math.max(1, Math.round(iw * scale)),
          h: Math.max(1, Math.round(ih * scale)),
        });
      },
      () => {
        // Oran bilinmiyorsa türe göre makul kutu
        if (tur === 'cover') {
          setBoyut({ w: maxW, h: Math.round(maxW * 0.45) });
        } else {
          const side = Math.min(maxW * 0.88, maxH * 0.7);
          setBoyut({ w: side, h: side });
        }
      },
    );
  }, [uri, width, height, insets.top, insets.bottom, tur]);

  return (
    <Modal
      visible={acik}
      transparent
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
      onRequestClose={onKapat}
    >
      <View style={styles.root} accessibilityViewIsModal>
        {/* Tüm boşluk — kapat */}
        <Pressable
          style={styles.backdrop}
          onPress={onKapat}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />

        {uri ? (
          <View
            style={[styles.imageWrap, { width: boyut.w, height: boyut.h }]}
            pointerEvents="box-none"
          >
            {/* Fotoğraf — dokunuşu yutar, kapanmaz */}
            <View style={styles.imageHit} pointerEvents="auto">
              <Image
                source={{ uri }}
                style={{ width: boyut.w, height: boyut.h }}
                resizeMode="contain"
                accessibilityLabel={
                  tur === 'cover' ? 'Kapak fotoğrafı' : 'Profil fotoğrafı'
                }
              />
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.kapatBtn, { top: Math.max(12, insets.top + 8) }]}
          onPress={onKapat}
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  imageWrap: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageHit: {
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
