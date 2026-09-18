import React, { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  DilAyariniKaydet,
  KullaniciAyarlariniGetir,
  PushBildirimAyariniKaydet,
} from '../../src/moduller/ayarlar/islemler/KullaniciAyarlariniYonet';
import {
  GIZLILIK_ALAN_ETIKETLERI,
  PROFIL_GOSTERGE_GIZLILIK,
  GizlilikAyariKaydet,
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { useKullanimSuresi } from '../../src/moduller/kullanim-suresi/baglam/KullanimSuresiSaglayici';
import { UygulamaKimligi } from '../../src/yapilandirma/UygulamaKimligi';
import { OrtamDegiskenleri } from '../../src/yapilandirma/OrtamDegiskenleri';
import { GorunumSecimKartlari } from '../../src/moduller/gorunum/bilesenler/GorunumSecimKartlari';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const EMPTY_PRIVACY: GizlilikAyarlari = {
  hide_recharge_rank: false,
  hide_gifter_rank: false,
  hide_current_room: false,
  hide_last_seen: false,
  hide_agency: false,
  hide_gift_collection: false,
  hide_top_supporter: false,
  hide_level: false,
  hide_topup_coin: false,
  hide_prestige: false,
  hide_account_value: false,
  is_private: false,
};

export default function AyarlarEkrani() {
  const [push, setPush] = useState(true);
  const [dil, setDil] = useState('tr');
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY_PRIVACY);
  const { formatli: kullanimFormatli, yenile: kullanimYenile } =
    useKullanimSuresi();
  const { palet } = useTema();

  useFocusEffect(
    useCallback(() => {
      void KullaniciAyarlariniGetir().then((a) => {
        setPush(a.pushEnabled);
        setDil(a.dil);
      });
      void GizlilikAyarlariniGetir().then(setPrivacy);
      void kullanimYenile();
    }, [kullanimYenile]),
  );

  const pushDegistir = async (v: boolean) => {
    setPush(v);
    await PushBildirimAyariniKaydet(v);
    try {
      const { PushTercihiniKaydet } = await import(
        '../../src/moduller/bildirimler/tercihler/PushTercihleriniYonet'
      );
      await PushTercihiniKaydet('all_enabled', v);
    } catch {
      /* migration 022 yoksa yerel ayar yeterli */
    }
  };

  const privacyDegistir = async (key: keyof GizlilikAyarlari, v: boolean) => {
    setPrivacy((p) => ({ ...p, [key]: v }));
    const r = await GizlilikAyariKaydet(key, v);
    if (!r.ok) Alert.alert('Gizlilik', r.hata ?? 'Kaydedilemedi');
  };

  const dilSec = () => {
    Alert.alert('Dil', 'Arayüz dili (yerel ayar)', [
      {
        text: 'Türkçe',
        onPress: async () => {
          setDil('tr');
          await DilAyariniKaydet('tr');
        },
      },
      {
        text: 'English',
        onPress: async () => {
          setDil('en');
          await DilAyariniKaydet('en');
        },
      },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const ac = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link açılamadı', url);
    }
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ayarlar">
        <EkranBasligi
          title="Ayarlar"
          subtitle={`${UygulamaKimligi.APP_NAME} · ${OrtamDegiskenleri.ortam}`}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={[styles.sectionLabel, { color: palet.textDim }]}>
            Görünüm
          </Text>
          <Text style={[styles.sectionHint, { color: palet.textMuted }]}>
            Temayı sekmeden seç. Varsayılan koyu; seçimin tüm uygulamaya uygulanır.
          </Text>
          <GorunumSecimKartlari />
          <View style={{ height: BoslukTokenlari.lg }} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Push bildirimleri</Text>
              <Text style={styles.hint}>Mesaj · hediye · canlı · cüzdan</Text>
            </View>
            <Switch
              value={push}
              onValueChange={(v) => void pushDegistir(v)}
              trackColor={{ true: RenkTokenlari.primary, false: RenkTokenlari.border }}
              thumbColor={palet.bgElevated}
            />
          </View>

          <ListeGrubu title="Kullanım">
            <ListeSatiri
              icon="time-outline"
              label="Uygulamada geçirdiğin süre"
              value={kullanimFormatli}
              showChevron={false}
              last
            />
          </ListeGrubu>

          <ListeGrubu>
            <ListeSatiri
              icon="notifications-outline"
              label="Bildirim kategorileri"
              value="Aç / kapat"
              onPress={() => router.push('/bildirim-ayarlari' as any)}
            />
            <ListeSatiri
              icon="language-outline"
              label="Dil"
              value={dil.toUpperCase()}
              onPress={dilSec}
              last
            />
          </ListeGrubu>

          <ListeGrubu title="Profil göstergeleri">
            <Text style={[styles.sectionHint, { marginBottom: 0, paddingTop: BoslukTokenlari.sm }]}>
              Kapalı olanlar profilini ziyaret edenlere görünmez.
            </Text>
            {PROFIL_GOSTERGE_GIZLILIK.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.privacyRow,
                  index < PROFIL_GOSTERGE_GIZLILIK.length - 1 && styles.privacyBorder,
                ]}
              >
                <View style={styles.privacyCopy}>
                  <Text style={styles.labelSmall}>{item.label}</Text>
                  {item.aciklama ? (
                    <Text style={styles.hint}>{item.aciklama}</Text>
                  ) : null}
                </View>
                <Switch
                  value={privacy[item.key]}
                  onValueChange={(v) => void privacyDegistir(item.key, v)}
                  trackColor={{ true: RenkTokenlari.primary, false: RenkTokenlari.border }}
                  thumbColor={palet.bgElevated}
                />
              </View>
            ))}
          </ListeGrubu>

          <ListeGrubu title="Gizlilik">
            {GIZLILIK_ALAN_ETIKETLERI.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.privacyRow,
                  index < GIZLILIK_ALAN_ETIKETLERI.length - 1 && styles.privacyBorder,
                ]}
              >
                <View style={styles.privacyCopy}>
                  <Text style={styles.labelSmall}>{item.label}</Text>
                  {item.aciklama ? (
                    <Text style={styles.hint}>{item.aciklama}</Text>
                  ) : null}
                </View>
                <Switch
                  value={privacy[item.key]}
                  onValueChange={(v) => void privacyDegistir(item.key, v)}
                  trackColor={{ true: RenkTokenlari.primary, false: RenkTokenlari.border }}
                  thumbColor={palet.bgElevated}
                />
              </View>
            ))}
          </ListeGrubu>

          <ListeGrubu title="Yasal ve destek">
            <ListeSatiri
              icon="document-text-outline"
              label="Politikalar"
              onPress={() => router.push('/politika' as any)}
            />
            <ListeSatiri
              icon="reader-outline"
              label="Kullanım şartları"
              onPress={() => router.push('/politika/tos' as any)}
            />
            <ListeSatiri
              icon="lock-closed-outline"
              label="Gizlilik politikası"
              onPress={() => router.push('/politika/privacy' as any)}
            />
            <ListeSatiri
              icon="shield-checkmark-outline"
              label="Çocuk koruma (af yok)"
              onPress={() => router.push('/politika/child_safety' as any)}
            />
            <ListeSatiri
              icon="megaphone-outline"
              label="Duyurular"
              onPress={() => router.push('/duyuru' as any)}
            />
            <ListeSatiri
              icon="headset-outline"
              label="Canlı destek"
              onPress={() => router.push('/destek' as any)}
            />
            <ListeSatiri
              icon="mail-outline"
              label="Destek e-posta"
              onPress={() => void ac(`mailto:${UygulamaKimligi.SUPPORT_EMAIL}`)}
            />
            <ListeSatiri
              icon="phone-portrait-outline"
              label="Cihaz oturumları"
              onPress={() => router.push('/cihazlar' as any)}
              last
            />
          </ListeGrubu>
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
  },
  sectionLabel: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    paddingHorizontal: BoslukTokenlari.sm,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionHint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.md,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.md,
  },
  label: { ...TipografiTokenlari.body, color: RenkTokenlari.text, flex: 1 },
  hint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 2,
  },
  labelSmall: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    paddingRight: BoslukTokenlari.sm,
  },
  privacyCopy: {
    flex: 1,
    paddingRight: BoslukTokenlari.sm,
    gap: 2,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 52,
    gap: BoslukTokenlari.md,
  },
  privacyBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
});
