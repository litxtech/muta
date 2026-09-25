import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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
import { CihazPushTokeniniKaydet } from '../../src/moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import {
  BildirimIzniDurumuAl,
  BildirimIzniIste,
} from '../../src/moduller/bildirimler/kayit/BildirimIzniIste';
import {
  PushTercihiniKaydet,
  PushTercihleriniGetir,
  VarsayilanPushTercihleri,
} from '../../src/moduller/bildirimler/tercihler/PushTercihleriniYonet';
import {
  PUSH_TERCIH_KATALOGU,
  type PushTercihAnahtari,
  type PushTercihleri,
} from '../../src/moduller/bildirimler/tercihler/PushTercihTipleri';
import { PushBildirimAyariniKaydet } from '../../src/moduller/ayarlar/islemler/KullaniciAyarlariniYonet';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../src/i18n/useCeviri';

const KATEGORI_IKON: Record<
  PushTercihAnahtari,
  keyof typeof Ionicons.glyphMap
> = {
  all_enabled: 'notifications',
  messages: 'chatbubble-ellipses-outline',
  calls: 'call-outline',
  gifts: 'gift-outline',
  live: 'radio-outline',
  rooms: 'musical-notes-outline',
  social: 'heart-outline',
  wallet: 'wallet-outline',
  agency: 'briefcase-outline',
  system: 'shield-checkmark-outline',
};

/** Kullanıcı istediği push / uygulama bildirimlerini açıp kapatır */
export default function BildirimAyarlariEkrani() {
  const { t } = useCeviri();
  const [prefs, setPrefs] = useState<PushTercihleri>(VarsayilanPushTercihleri());
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyKey, setBusyKey] = useState<PushTercihAnahtari | null>(null);
  const [osIzin, setOsIzin] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );

  const osIzinYenile = useCallback(async () => {
    try {
      const status = await BildirimIzniDurumuAl();
      if (status === 'granted') setOsIzin('granted');
      else if (status === 'denied') setOsIzin('denied');
      else setOsIzin('undetermined');
    } catch {
      setOsIzin('undetermined');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setYukleniyor(true);
      void osIzinYenile();
      PushTercihleriniGetir()
        .then((p) => {
          setPrefs(p);
          void PushBildirimAyariniKaydet(p.all_enabled);
          if (p.all_enabled) void CihazPushTokeniniKaydet();
        })
        .catch(() => setPrefs(VarsayilanPushTercihleri()))
        .finally(() => setYukleniyor(false));
    }, [osIzinYenile]),
  );

  const degistir = async (key: PushTercihAnahtari, value: boolean) => {
    const onceki = prefs;
    setPrefs((p) => ({ ...p, [key]: value }));
    setBusyKey(key);
    try {
      const guncel = await PushTercihiniKaydet(key, value);
      setPrefs(guncel);
      if (key === 'all_enabled') {
        await PushBildirimAyariniKaydet(value);
        if (value) void CihazPushTokeniniKaydet();
      }
    } catch (e) {
      setPrefs(onceki);
      Alert.alert(
        t('ayarlar.bildirimler'),
        e instanceof Error ? e.message : t('ortak.kaydedilemedi'),
      );
    } finally {
      setBusyKey(null);
    }
  };

  const osIzinYonet = async () => {
    if (osIzin === 'granted') {
      await Linking.openSettings();
      return;
    }
    const ok = await BildirimIzniIste();
    await osIzinYenile();
    if (ok && prefs.all_enabled) void CihazPushTokeniniKaydet();
    if (!ok) {
      Alert.alert(t('bildirimAyar.osIzinBaslik'), t('bildirimAyar.osIzinRed'), [
        { text: t('ortak.iptal'), style: 'cancel' },
        {
          text: t('bildirimAyar.osAyarlar'),
          onPress: () => void Linking.openSettings(),
        },
      ]);
    }
  };

  const osDurumMetni =
    osIzin === 'granted'
      ? t('bildirimAyar.osIzinAcik')
      : osIzin === 'denied'
        ? t('bildirimAyar.osIzinKapali')
        : t('bildirimAyar.osIzinSor');

  const osIkonRengi =
    osIzin === 'granted' ? RenkTokenlari.success : RenkTokenlari.textDim;

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="bildirim-ayarlari">
        <EkranBasligi
          title={t('ayarlar.bildirimAyarlari')}
          subtitle={t('ayarlar.bildirimAyarAlt')}
          border
        />
        {yukleniyor ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.aciklama}>
              {t('ayarlar.bildirimAyarAciklama')}
            </Text>

            <Text style={styles.bolum}>{t('bildirimAyar.bolumCihaz')}</Text>
            <View style={styles.liste}>
              <Pressable
                onPress={() => void osIzinYonet()}
                style={({ pressed }) => [
                  styles.satir,
                  styles.border,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.ikonWrap, { backgroundColor: `${osIkonRengi}22` }]}>
                  <Ionicons
                    name={
                      osIzin === 'granted'
                        ? 'phone-portrait-outline'
                        : 'notifications-off-outline'
                    }
                    size={18}
                    color={osIkonRengi}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.baslik}>{t('bildirimAyar.osIzinBaslik')}</Text>
                  <Text style={styles.alt}>{osDurumMetni}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={RenkTokenlari.textDim}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push('/ayarlar/kisiler-aramalar' as any)}
                style={({ pressed }) => [styles.satir, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={styles.ikonWrap}>
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={RenkTokenlari.primarySoft}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.baslik}>{t('bildirimAyar.aramaTercih')}</Text>
                  <Text style={styles.alt}>{t('bildirimAyar.aramaTercihAlt')}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={RenkTokenlari.textDim}
                />
              </Pressable>
            </View>

            <Text style={styles.bolum}>{t('bildirimAyar.bolumKategori')}</Text>
            <View style={styles.liste}>
              {PUSH_TERCIH_KATALOGU.map((item, index) => {
                const masterKapali =
                  item.key !== 'all_enabled' && !prefs.all_enabled;
                const ikon = KATEGORI_IKON[item.key] ?? 'notifications-outline';
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.satir,
                      index < PUSH_TERCIH_KATALOGU.length - 1 && styles.border,
                      masterKapali && styles.soluk,
                    ]}
                  >
                    <View
                      style={[
                        styles.ikonWrap,
                        item.key === 'all_enabled' && styles.ikonWrapAccent,
                      ]}
                    >
                      <Ionicons
                        name={ikon}
                        size={18}
                        color={
                          item.key === 'all_enabled'
                            ? RenkTokenlari.primarySoft
                            : RenkTokenlari.textMuted
                        }
                      />
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.baslik}>{item.baslik}</Text>
                      <Text style={styles.alt}>{item.alt}</Text>
                    </View>
                    <Switch
                      value={prefs[item.key]}
                      disabled={masterKapali || busyKey === item.key}
                      onValueChange={(v) => void degistir(item.key, v)}
                      trackColor={{
                        true: RenkTokenlari.primarySoft,
                        false: RenkTokenlari.border,
                      }}
                    />
                  </View>
                );
              })}
            </View>

            {Platform.OS === 'ios' ? (
              <Text style={styles.dipnot}>{t('bildirimAyar.iosDipnot')}</Text>
            ) : (
              <Text style={styles.dipnot}>{t('bildirimAyar.androidDipnot')}</Text>
            )}
          </ScrollView>
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.sm,
  },
  aciklama: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
  bolum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: BoslukTokenlari.sm,
    marginStart: 4,
  },
  liste: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    overflow: 'hidden',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.78 },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  soluk: { opacity: 0.45 },
  ikonWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.chipFill,
  },
  ikonWrapAccent: {
    backgroundColor: `${RenkTokenlari.primarySoft}22`,
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 15,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0,
    lineHeight: 15,
  },
  dipnot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
    letterSpacing: 0,
    paddingHorizontal: 4,
  },
});
