import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { TakipciKarti } from '../../takip/bilesenler/TakipciKarti';
import { KesfetBolumBasligi } from './KesfetBolumBasligi';
import type { TakipOnerisi } from '../../takip/TakipTipleri';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

export function KesfetOnerilenKullanicilar({
  items,
  onFollow,
  busyId,
}: {
  items: TakipOnerisi[];
  onFollow: (id: string) => void;
  busyId?: string | null;
}) {
  const { t } = useCeviri();
  if (!items.length) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.baslik}>
        <KesfetBolumBasligi baslik={t('kesfet.onerilenKullanicilar')} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
      >
        {items.map((k) => (
          <View key={k.user_id} style={styles.kart}>
            <TakipciKarti
              kart={{
                ...k,
                i_follow: false,
                they_follow_me: k.state === 'FOLLOWS_YOU' || k.state === 'MUTUAL',
                is_mutual: k.state === 'MUTUAL',
                follows_you: k.state === 'FOLLOWS_YOU',
              }}
              onPress={() => router.push(`/kullanici/${k.user_id}` as any)}
              onFollowPress={() => onFollow(k.user_id)}
              followLoading={busyId === k.user_id}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: BoslukTokenlari.md },
  baslik: { paddingHorizontal: BoslukTokenlari.lg },
  serit: { paddingRight: BoslukTokenlari.lg },
  kart: { width: 320 },
});
