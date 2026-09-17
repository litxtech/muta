/**
 * NOX REELS — bağımsız oyun ekranı (oda dışı).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { SlotOyunEkrani } from '../../src/moduller/oyunlar/slot/ekranlar/SlotOyunEkrani';
import { registerNoxReels } from '../../src/moduller/oyunlar/slot/SlotKayit';
import { isGameVisible } from '../../src/moduller/oyunlar/ortak/servisler/OyunKontrolServisi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import {
  koyuSahneKilidiCik,
  koyuSahneKilidiGir,
} from '../../src/tasarim-sistemi/tema/TemaDurumu';

type Durum = 'yukleniyor' | 'acik' | 'kapali';

export default function NoxOyunSayfasi() {
  const { user } = useAuth();
  const [durum, setDurum] = useState<Durum>('yukleniyor');

  useEffect(() => {
    registerNoxReels();
    koyuSahneKilidiGir();
    let alive = true;
    void (async () => {
      const acik = await isGameVisible('nox_reels');
      if (alive) setDurum(acik ? 'acik' : 'kapali');
    })();
    return () => {
      alive = false;
      koyuSahneKilidiCik();
    };
  }, []);

  const kapat = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, []);

  if (!user) {
    router.replace('/(auth)' as never);
    return null;
  }

  if (durum === 'yukleniyor') {
    return (
      <View style={styles.merkez}>
        <ActivityIndicator color={RenkTokenlari.accent} size="large" />
      </View>
    );
  }

  if (durum === 'kapali') {
    return (
      <View style={styles.merkez}>
        <Text style={styles.baslik}>NOX REELS</Text>
        <Text style={styles.mesaj}>
          Oyun şu an kapalı. Daha sonra tekrar dene.
        </Text>
        <Pressable style={styles.btn} onPress={kapat}>
          <Text style={styles.btnText}>Geri dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SlotOyunEkrani roomId={null} voiceActive={false} onClose={kapat} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060412' },
  merkez: {
    flex: 1,
    backgroundColor: '#060412',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  baslik: {
    color: '#B794F6',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 2,
  },
  mesaj: {
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  btn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.primary,
  },
  btnText: { color: RenkTokenlari.text, fontWeight: '700' },
});
