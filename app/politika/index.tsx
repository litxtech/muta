import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { PolitikalariListele } from '../../src/moduller/politikalar/islemler/PolitikaIslemleri';
import type { PolitikaGorunum } from '../../src/moduller/politikalar/tipler/PolitikaTipleri';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function PolitikaListeEkrani() {
  const [liste, setListe] = useState<PolitikaGorunum[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      void (async () => {
        setYukleniyor(true);
        try {
          const rows = await PolitikalariListele('all');
          if (!iptal) setListe(rows);
        } catch {
          if (!iptal) setListe([]);
        } finally {
          if (!iptal) setYukleniyor(false);
        }
      })();
      return () => {
        iptal = true;
      };
    }, []),
  );

  return (
    <Screen edges={['top']} style={styles.screen}>
      <ModulHataSiniri modulAdi="politikalar">
        <EkranBasligi
          title="Politikalar"
          subtitle="Yasal metinler"
          fallbackHref={'/(tabs)/profile' as any}
        />
        <ScrollView contentContainerStyle={styles.pad}>
          {yukleniyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            liste.map((p) => (
              <Pressable
                key={p.kod}
                style={styles.kart}
                onPress={() => router.push(`/politika/${p.kod}` as any)}
              >
                <Text style={styles.baslik}>{p.baslik}</Text>
                {p.kisa ? <Text style={styles.kisa}>{p.kisa}</Text> : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0c0c0c' },
  pad: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: 10,
  },
  kart: {
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: '#ffffff',
    fontWeight: '700',
  },
  kisa: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
  },
});
