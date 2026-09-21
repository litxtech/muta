/**
 * Android PiP penceresinde gösterilen kompakt ses odası kartı.
 * Root'ta tutulur — expo-router PiP boş ekran riskini azaltır.
 */

import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useAktifSesOdasi } from '../oturum/useAktifSesOdasi';
import { SesOdasiArkaPlanTamamenCik } from '../arka-plan/SesOdasiArkaPlanServisi';
import { useSesOdasiPipModu } from '../pip/useSesOdasiPip';

export function AktifSesOdasiPipKart() {
  const durum = useAktifSesOdasi();
  const isInPipMode = useSesOdasiPipModu();

  const tamamenCik = useCallback(() => {
    void SesOdasiArkaPlanTamamenCik();
  }, []);

  if (Platform.OS !== 'android' || !isInPipMode || !durum) return null;

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <View style={styles.kart}>
        <View style={styles.ust}>
          <View style={styles.dot} />
          <Text style={styles.canli}>CANLI</Text>
          <Pressable
            onPress={tamamenCik}
            hitSlop={12}
            style={styles.kapat}
            accessibilityLabel="Odadan çık"
          >
            <Ionicons name="close" size={18} color={RenkTokenlari.text} />
          </Pressable>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {durum.title || 'Ses odası'}
        </Text>
        <Text style={styles.alt} numberOfLines={1}>
          Ses devam ediyor
        </Text>
        {durum.dinleyiciSayisi > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>
            {durum.dinleyiciSayisi} dinleyici
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: 200,
    elevation: 200,
    backgroundColor: '#12040C',
    justifyContent: 'center',
    alignItems: 'center',
    padding: BoslukTokenlari.md,
  },
  kart: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: 'rgba(22,14,28,0.98)',
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    padding: BoslukTokenlari.md,
    gap: 6,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.live,
  },
  canli: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.live,
    fontWeight: '800',
    letterSpacing: 0.6,
    flex: 1,
  },
  kapat: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 2,
  },
});
