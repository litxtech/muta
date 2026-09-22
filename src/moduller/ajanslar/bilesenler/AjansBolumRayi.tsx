import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { ajansHref } from '../kancalar/useAjansRouteId';

export const AJANS_BOLUMLER: Array<{
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: string;
}> = [
  { key: 'ozet', label: 'Genel', icon: 'grid-outline', path: '' },
  { key: 'canli', label: 'Canlı', icon: 'radio-outline', path: 'canli' },
  { key: 'uyeler', label: 'Üyeler', icon: 'people-outline', path: 'uyeler' },
  { key: 'basvurular', label: 'Başvuru', icon: 'mail-outline', path: 'basvurular' },
  { key: 'davetler', label: 'Davet', icon: 'person-add-outline', path: 'davetler' },
  { key: 'ekipler', label: 'Ekip', icon: 'git-network-outline', path: 'ekipler' },
  { key: 'program', label: 'Program', icon: 'calendar-outline', path: 'program' },
  { key: 'etkinlikler', label: 'Etkinlik', icon: 'sparkles-outline', path: 'etkinlikler' },
  { key: 'duyurular', label: 'Duyuru', icon: 'megaphone-outline', path: 'duyurular' },
  { key: 'gorevler', label: 'Görev', icon: 'checkbox-outline', path: 'gorevler' },
  { key: 'analitik', label: 'Analitik', icon: 'stats-chart-outline', path: 'analitik' },
  { key: 'islemler', label: 'İşlem', icon: 'wallet-outline', path: 'islemler' },
  { key: 'destek', label: 'Destek', icon: 'help-buoy-outline', path: 'destek' },
  { key: 'guvenlik', label: 'Güvenlik', icon: 'shield-checkmark-outline', path: 'guvenlik' },
  { key: 'ayarlar', label: 'Ayarlar', icon: 'settings-outline', path: 'ayarlar' },
];

export function AjansBolumRayi({
  agencyId,
  aktif,
}: {
  agencyId: string;
  aktif?: string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const aktifKey = aktif ?? 'ozet';

  useEffect(() => {
    const x = offsets.current[aktifKey];
    if (typeof x === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 24), animated: true });
    }
  }, [aktifKey]);

  const onChipLayout = (key: string) => (e: LayoutChangeEvent) => {
    offsets.current[key] = e.nativeEvent.layout.x;
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {AJANS_BOLUMLER.map((b) => {
          const secili = aktifKey === b.key;
          return (
            <Pressable
              key={b.key}
              onLayout={onChipLayout(b.key)}
              style={[styles.chip, secili && styles.chipAktif]}
              onPress={() => router.push(ajansHref(agencyId, b.path) as any)}
            >
              <Ionicons
                name={b.icon}
                size={15}
                color={secili ? RenkTokenlari.primarySoft : RenkTokenlari.textDim}
              />
              <Text style={[styles.yazi, secili && styles.yaziAktif]} numberOfLines={1}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Geriye uyumluluk */
export { AjansBolumRayi as AjansBolumGrid };

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -BoslukTokenlari.lg,
  },
  rail: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  yaziAktif: {
    color: RenkTokenlari.text,
  },
});
