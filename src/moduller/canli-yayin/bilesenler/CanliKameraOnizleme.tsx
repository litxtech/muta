import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  aktif: boolean;
  facing?: 'front' | 'back';
};

/**
 * Canli yayin lokal onizleme — LiveKit remote video ayri katman.
 * Expo Go / izin yok / native hata → placeholder (asla çökme).
 */
export function CanliKameraOnizleme({ aktif, facing = 'front' }: Props) {
  const { t } = useCeviri();
  const [permission, requestPermission] = useCameraPermissions();
  const [hata, setHata] = useState<string | null>(null);
  const [kameraKirildi, setKameraKirildi] = useState(false);

  useEffect(() => {
    if (!aktif) return;
    if (!permission) return;
    if (!permission.granted) {
      void requestPermission()
        .then((r) => {
          if (!r.granted) setHata(t('canliYayin.kameraIzni'));
        })
        .catch(() =>
          setHata(t('canliYayin.kameraKullanilamiyor')),
        );
    }
  }, [aktif, permission, requestPermission, t]);

  if (!aktif) return null;

  if (hata || kameraKirildi || !permission?.granted) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {kameraKirildi
            ? t('canliYayin.kameraOnizlemeYok')
            : (hata ?? t('canliYayin.kameraIzniBekleniyor'))}
        </Text>
      </View>
    );
  }

  try {
    return (
      <View style={styles.wrap}>
        <CameraView
          style={styles.camera}
          facing={facing}
          onMountError={() => setKameraKirildi(true)}
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('canliYayin.canliOnizleme')}</Text>
        </View>
      </View>
    );
  } catch {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          {t('canliYayin.kameraOnizlemeKapali')}
        </Text>
      </View>
    );
  }
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
