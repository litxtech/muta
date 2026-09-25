/**
 * Ayarlar → Kişiler & Aramalar — keşif gizliliği + fiyatlar
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { CamArkaplan } from '../../src/bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  KisilerAyarlariGetir,
  KisilerAyarlariGuncelle,
} from '../../src/moduller/kisiler-kesif/islemler/KisilerKesifIslemleri';
import type {
  KisilerAyarlari,
  KisilerCallPermission,
  KisilerDiscoveryPreference,
} from '../../src/moduller/kisiler-kesif/tipler';
import { useCeviri } from '../../src/i18n/useCeviri';

function FiyatAdim({
  value,
  min,
  max,
  tint,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  tint: string;
  onChange: (v: number) => void;
}) {
  const { t } = useCeviri();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.fiyatDeger, { color: tint }]}>
        {t('kisilerAyar.coinDk', { n: Math.round(value) })}
      </Text>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: tint }]} />
      </View>
      <View style={styles.adimSatir}>
        <Pressable
          style={styles.adimBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityLabel={t('kisilerAyar.azalt')}
        >
          <Ionicons name="remove" size={18} color={RenkTokenlari.text} />
        </Pressable>
        <Text style={styles.aralik}>
          {min} – {max}
        </Text>
        <Pressable
          style={styles.adimBtn}
          onPress={() => onChange(Math.min(max, value + 1))}
          accessibilityLabel={t('kisilerAyar.artir')}
        >
          <Ionicons name="add" size={18} color={RenkTokenlari.text} />
        </Pressable>
      </View>
    </View>
  );
}

export default function KisilerAramalarAyarlari() {
  const { t } = useCeviri();
  const [ayar, setAyar] = useState<KisilerAyarlari | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [voiceDraft, setVoiceDraft] = useState(25);
  const [videoDraft, setVideoDraft] = useState(45);
  const [kaydediyor, setKaydediyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const a = await KisilerAyarlariGetir();
      setAyar(a);
      setVoiceDraft(a.voice_price_per_minute);
      setVideoDraft(a.video_price_per_minute);
    } catch (e) {
      Alert.alert(
        t('profil.ayarlar'),
        e instanceof Error ? e.message : t('kisilerAyar.yuklenemedi'),
      );
    } finally {
      setYukleniyor(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const toggle = async (key: keyof KisilerAyarlari, value: boolean) => {
    if (!ayar) return;
    setAyar({ ...ayar, [key]: value } as KisilerAyarlari);
    const r = await KisilerAyarlariGuncelle({ [key]: value });
    if (!r.ok) {
      Alert.alert(t('profil.ayarlar'), r.hata);
      void yukle();
      return;
    }
    setAyar(r.ayar);
  };

  const tercihSec = async (v: KisilerDiscoveryPreference) => {
    const r = await KisilerAyarlariGuncelle({ discovery_preference: v });
    if (!r.ok) {
      Alert.alert(t('kisilerAyar.kesifTercihi'), r.hata);
      return;
    }
    setAyar(r.ayar);
  };

  const izinSec = async (v: KisilerCallPermission) => {
    const r = await KisilerAyarlariGuncelle({ call_permission: v });
    if (!r.ok) {
      Alert.alert(t('kisilerAyar.aramaIzni'), r.hata);
      return;
    }
    setAyar(r.ayar);
  };

  const fiyatKaydet = async () => {
    if (!ayar) return;
    setKaydediyor(true);
    try {
      const r = await KisilerAyarlariGuncelle({
        voice_price_per_minute: Math.round(voiceDraft),
        video_price_per_minute: Math.round(videoDraft),
      });
      if (!r.ok) {
        Alert.alert(t('kisilerAyar.fiyat'), r.hata);
        return;
      }
      setAyar(r.ayar);
      setVoiceDraft(r.ayar.voice_price_per_minute);
      setVideoDraft(r.ayar.video_price_per_minute);
      Alert.alert(t('ortak.kaydedildi'), t('kisilerAyar.ucretlerGuncellendi'));
    } finally {
      setKaydediyor(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="kisiler-ayarlar">
        <EkranBasligi
          title={t('ayarlar.kisilerAramalar')}
          subtitle={t('kisilerAyar.altBaslik')}
          fallbackHref="/ayarlar"
        />
        {yukleniyor || !ayar ? (
          <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {ayar.discovery_restricted ? (
              <View style={styles.uyariKutu}>
                <Text style={styles.uyari}>
                  {t('kisilerAyar.kisitliUyari')}
                </Text>
              </View>
            ) : null}

            <Bolum baslik={t('kisilerAyar.kesif')}>
              <Satir
                label={t('kisilerAyar.beniGoster')}
                value={ayar.discoverable}
                onChange={(v) => void toggle('discoverable', v)}
                disabled={ayar.discovery_restricted}
              />
              <Satir
                label={t('kisilerAyar.cevrimiciGoster')}
                value={ayar.show_online_status}
                onChange={(v) => void toggle('show_online_status', v)}
              />
              <Satir
                label={t('kisilerAyar.bayrakGoster')}
                value={ayar.show_country}
                onChange={(v) => void toggle('show_country', v)}
              />
            </Bolum>

            <Bolum baslik={t('kisilerAyar.kesifTercihim')}>
              {(
                [
                  ['female', t('kisilerAyar.kadinlar')],
                  ['male', t('kisilerAyar.erkekler')],
                  ['everyone', t('kisilerAyar.herkes')],
                ] as const
              ).map(([id, label]) => (
                <Secenek
                  key={id}
                  label={label}
                  aktif={ayar.discovery_preference === id}
                  onPress={() => void tercihSec(id)}
                />
              ))}
            </Bolum>

            <Bolum baslik={t('kisilerAyar.aramalar')}>
              <Satir
                label={t('kisilerAyar.beniAra')}
                value={ayar.calls_open}
                onChange={(v) => void toggle('calls_open', v)}
              />
              <Satir
                label={t('kisilerAyar.sesliKabul')}
                value={ayar.voice_calls_enabled}
                onChange={(v) => void toggle('voice_calls_enabled', v)}
              />
              <Satir
                label={t('kisilerAyar.goruntuluKabul')}
                value={ayar.video_calls_enabled}
                onChange={(v) => void toggle('video_calls_enabled', v)}
              />
            </Bolum>

            <Bolum baslik={t('kisilerAyar.kimlerArayabilir')}>
              {(
                [
                  ['everyone', t('kisilerAyar.herkes')],
                  ['following', t('kisilerAyar.takipEttiklerim')],
                  ['nobody', t('kisilerAyar.kimse')],
                ] as const
              ).map(([id, label]) => (
                <Secenek
                  key={id}
                  label={label}
                  aktif={ayar.call_permission === id}
                  onPress={() => void izinSec(id)}
                />
              ))}
            </Bolum>

            <Bolum baslik={t('kisilerAyar.ucretsizHakBaslik')}>
              <Text style={styles.ucretsizHakYazi}>
                {t('kisilerAyar.ucretsizHakKaldi', {
                  sure: (() => {
                    const sn = ayar.free_call_seconds_remaining ?? 0;
                    const dk = Math.floor(sn / 60);
                    const s = sn % 60;
                    if (dk <= 0) return t('kisilerX.sn', { n: s });
                    return t('kisilerX.dkSn', { dk, sn: s });
                  })(),
                })}
              </Text>
              <Text style={styles.ucretsizHakAlt}>
                {t('kisilerAyar.ucretsizHakAciklama')}
              </Text>
            </Bolum>

            <Bolum baslik={t('kisilerAyar.sesliUcret')}>
              <FiyatAdim
                value={voiceDraft}
                min={ayar.voice_price_min}
                max={ayar.voice_price_max}
                tint={RenkTokenlari.mint}
                onChange={setVoiceDraft}
              />
            </Bolum>

            <Bolum baslik={t('kisilerAyar.goruntuluUcret')}>
              <FiyatAdim
                value={videoDraft}
                min={ayar.video_price_min}
                max={ayar.video_price_max}
                tint={RenkTokenlari.magenta}
                onChange={setVideoDraft}
              />
            </Bolum>

            <Pressable
              style={[styles.kaydet, kaydediyor && { opacity: 0.6 }]}
              disabled={kaydediyor}
              onPress={() => void fiyatKaydet()}
            >
              <Text style={styles.kaydetYazi}>
                {t('kisilerAyar.ucretleriKaydet')}
              </Text>
            </Pressable>

            <Pressable
              style={styles.link}
              onPress={() => router.push('/ayarlar/gizlilik' as any)}
            >
              <Text style={styles.linkYazi}>
                {t('kisilerAyar.digerGizlilik')}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

function Bolum({
  baslik,
  children,
}: {
  baslik: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.bolum}>
      <CamArkaplan intensity={24} hafif style={StyleSheet.absoluteFill} />
      <Text style={styles.bolumBaslik}>{baslik}</Text>
      {children}
    </View>
  );
}

function Satir({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.satir, disabled && { opacity: 0.5 }]}>
      <Text style={styles.satirLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#333', true: RenkTokenlari.primary }}
      />
    </View>
  );
}

function Secenek({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.secenek, aktif && styles.secenekAktif]}>
      <Text style={[styles.secenekYazi, aktif && styles.secenekYaziAktif]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    paddingBottom: 120,
  },
  bolum: {
    borderRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: BoslukTokenlari.md,
    gap: 8,
  },
  bolumBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  ucretsizHakYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  ucretsizHakAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0,
    lineHeight: 15,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  satirLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
    paddingRight: 12,
  },
  secenek: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secenekAktif: {
    backgroundColor: `${RenkTokenlari.primary}33`,
  },
  secenekYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  secenekYaziAktif: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  fiyatDeger: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  aralik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  adimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adimBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  kaydet: {
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  kaydetYazi: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '700',
  },
  link: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
  },
  uyariKutu: {
    backgroundColor: `${RenkTokenlari.danger}22`,
    borderRadius: YaricapTokenlari.lg,
    padding: 12,
  },
  uyari: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
  },
});
