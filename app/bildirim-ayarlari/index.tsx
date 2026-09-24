import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { CihazPushTokeniniKaydet } from '../../src/moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
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

/** Kullanıcı istediği push bildirimlerini açıp kapatır */
export default function BildirimAyarlariEkrani() {
  const { t } = useCeviri();
  const [prefs, setPrefs] = useState<PushTercihleri>(VarsayilanPushTercihleri());
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyKey, setBusyKey] = useState<PushTercihAnahtari | null>(null);

  useFocusEffect(
    useCallback(() => {
      setYukleniyor(true);
      void CihazPushTokeniniKaydet();
      PushTercihleriniGetir()
        .then((p) => {
          setPrefs(p);
          void PushBildirimAyariniKaydet(p.all_enabled);
        })
        .catch(() => setPrefs(VarsayilanPushTercihleri()))
        .finally(() => setYukleniyor(false));
    }, []),
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

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="bildirim-ayarlari">
        <EkranBasligi
          title={t('ayarlar.bildirimAyarlari')}
          subtitle={t('ayarlar.bildirimAyarAlt')}
        />
        {yukleniyor ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 32 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.aciklama}>
              {t('ayarlar.bildirimAyarAciklama')}
            </Text>

            <View style={styles.liste}>
              {PUSH_TERCIH_KATALOGU.map((item, index) => {
                const masterKapali =
                  item.key !== 'all_enabled' && !prefs.all_enabled;
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.satir,
                      index < PUSH_TERCIH_KATALOGU.length - 1 && styles.border,
                      masterKapali && styles.soluk,
                    ]}
                  >
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
  },
  aciklama: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
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
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  soluk: { opacity: 0.45 },
  copy: { flex: 1, gap: 2 },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
});
