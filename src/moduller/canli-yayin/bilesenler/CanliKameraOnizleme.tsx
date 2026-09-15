import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  aktif: boolean;
  facing?: 'front' | 'back';
};

/**
 * Canli yayin lokal onizleme — LiveKit remote video ayri katman.
 * Expo Go / izin yoksa placeholder gosterir.
 */
export function CanliKameraOnizleme({ aktif, facing = 'front' }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!aktif) return;
    if (!permission) return;
    if (!permission.granted) {
      void requestPermission()
        .then((r) => {
          if (!r.granted) setHata('Kamera izni gerekli');
        })
        .catch(() => setHata('Kamera kullanılamıyor (native build gerekebilir)'));
    }
  }, [aktif, permission, requestPermission]);

  if (!aktif) return null;

  if (hata || !permission?.granted) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {hata ?? 'Kamera izni bekleniyor…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <CameraView style={styles.camera} facing={facing} mode="video" />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>CANLI ÖNİZLEME</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  camera: { flex: 1 },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: 16,
  },
  placeholderText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
});
