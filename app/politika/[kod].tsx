import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { PolitikaKodundanGetir } from '../../src/moduller/politikalar/icerik/PolitikaMetinleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function PolitikaDetayEkrani() {
  const { kod } = useLocalSearchParams<{ kod: string }>();
  const politika = useMemo(
    () => PolitikaKodundanGetir(String(kod ?? '')),
    [kod],
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="politikalar">
        <EkranBasligi
          title={politika?.baslik ?? 'Politika'}
          subtitle={politika?.kisa}
          fallbackHref={'/politika' as any}
        />
        <ScrollView
          contentContainerStyle={styles.pad}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.govde}>
            {politika?.govde ?? 'Politika bulunamadı.'}
          </Text>
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
  },
  govde: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
});
