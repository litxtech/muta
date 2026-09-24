/**
 * Arka planda kalan ses odası — odaya dönüş şeridi.
 * Profil ziyaretinde LiveKit açık kalır; X ile normal çıkış (ses kesilir).
 */

import React, { useCallback, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { yuzenTabBarToplamYukseklik } from '../../../components/YuzenTabBosluk';
import { AktifSesOdasiOneCikar } from '../oturum/AktifSesOdasiOturumu';
import { useAktifSesOdasi } from '../oturum/useAktifSesOdasi';
import { SesOdasiArkaPlanTamamenCik } from '../arka-plan/SesOdasiArkaPlanServisi';
import { useCeviri } from '../../../i18n/useCeviri';

export function AktifSesOdasiMiniBar() {
  const { t } = useCeviri();
  const durum = useAktifSesOdasi();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const tabAlt = yuzenTabBarToplamYukseklik(insets.bottom);

  const odaEkraninda =
    !!durum &&
    (pathname === `/room/${durum.roomId}` ||
      pathname?.startsWith(`/room/${durum.roomId}`) ||
      pathname === '/room/[id]');

  const gorunur = !!durum?.arkaPlanda && !odaEkraninda;

  /** Arka plandayken yönetim odayı kapatırsa sesi kes */
  useEffect(() => {
    if (!durum?.arkaPlanda) return;
    const roomId = durum.roomId;
    const topic = `aktif-ses-oda-end-${roomId}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }
    const kanal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const next = payload.new as { is_live?: boolean } | null;
          if (next && next.is_live === false) {
            void (async () => {
              await SesOdasiArkaPlanTamamenCik();
              Alert.alert(t('sesOda.sesOdasi'), t('sesOda.yonetimKapatti'));
            })();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [durum?.arkaPlanda, durum?.roomId]);

  const odayaDon = useCallback(() => {
    if (!durum) return;
    AktifSesOdasiOneCikar();
    router.push(`/room/${durum.roomId}` as any);
  }, [durum]);

  const tamamenCik = useCallback(() => {
    if (!durum) return;
    Alert.alert(t('sesOda.odadanCik'), t('sesOda.ayrilSoru'), [
      { text: t('sesOda.kal'), style: 'cancel' },
      {
        text: t('sesOda.cik'),
        style: 'destructive',
        onPress: () => {
          void SesOdasiArkaPlanTamamenCik();
        },
      },
    ]);
  }, [durum, t]);

  if (!gorunur || !durum) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom: tabAlt + Math.max(8, insets.bottom * 0.15),
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable style={styles.bar} onPress={odayaDon}>
        <View style={styles.dot} />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {durum.title}
          </Text>
          <Text style={styles.alt} numberOfLines={1}>
            {t('sesOda.sesDevamOdayaDon')}
          </Text>
        </View>
        <Ionicons name="mic" size={16} color={RenkTokenlari.mint} />
        <Pressable
          onPress={tamamenCik}
          hitSlop={10}
          style={styles.kapat}
          accessibilityLabel={t('sesOda.odadanCik')}
        >
          <Ionicons name="close" size={18} color={RenkTokenlari.text} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: BoslukTokenlari.lg,
    right: BoslukTokenlari.lg,
    zIndex: 80,
    elevation: 80,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    backgroundColor: 'rgba(22,14,28,0.96)',
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    paddingLeft: BoslukTokenlari.md,
    paddingRight: BoslukTokenlari.sm,
    paddingVertical: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.live,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  kapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginLeft: 4,
  },
});
