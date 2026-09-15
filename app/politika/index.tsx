import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { PolitikaOkumaPaneli } from '../../src/moduller/politikalar/bilesenler/PolitikaOkumaPaneli';
import {
  POLITIKA_LISTESI,
  type PolitikaTanimi,
} from '../../src/moduller/politikalar/icerik/PolitikaMetinleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function PolitikaEkrani() {
  const [okunan, setOkunan] = useState<PolitikaTanimi | null>(null);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="politikalar">
        <EkranBasligi
          title="Politikalar"
          subtitle="Kullanım · gizlilik · çocuk koruma (af yok)"
        />
        <ScrollView contentContainerStyle={styles.list}>
          {POLITIKA_LISTESI.map((p) => (
            <Pressable
              key={p.kod}
              style={styles.card}
              onPress={() => setOkunan(p)}
            >
              <View style={styles.cardIcon}>
                <Ionicons
                  name={
                    p.kod === 'child_safety'
                      ? 'shield-checkmark-outline'
                      : p.kod === 'privacy'
                        ? 'lock-closed-outline'
                        : 'document-text-outline'
                  }
                  size={20}
                  color={RenkTokenlari.primarySoft}
                />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{p.baslik}</Text>
                <Text style={styles.cardAlt}>{p.kisa}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={RenkTokenlari.textDim}
              />
            </Pressable>
          ))}
          <Pressable
            style={styles.link}
            onPress={() => router.push('/destek' as any)}
          >
            <Text style={styles.linkYazi}>Sorun mu var? Canlı destek</Text>
          </Pressable>
        </ScrollView>

        <PolitikaOkumaPaneli
          politika={okunan}
          onKapat={() => setOkunan(null)}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.12)',
  },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardAlt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  link: { alignItems: 'center', paddingVertical: BoslukTokenlari.md },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
