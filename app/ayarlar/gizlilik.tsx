import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  GizlilikAlanEtiketleri,
  ProfilGostergeEtiketleri,
  GizlilikAyariKaydet,
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { GizlilikAnahtarListesi } from '../../src/moduller/ayarlar/bilesenler/GizlilikAnahtarListesi';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../src/i18n/useCeviri';

const EMPTY: GizlilikAyarlari = {
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
  hide_crown: false,
  hide_online_status: false,
  hide_followers: false,
  hide_following: false,
  hide_status_posts: false,
  hide_game_stats: false,
  is_private: false,
};

export default function GizlilikAyarlariEkrani() {
  const { palet } = useTema();
  const { t } = useCeviri();
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      void GizlilikAyarlariniGetir().then(setPrivacy);
    }, []),
  );

  const degistir = async (key: keyof GizlilikAyarlari, v: boolean) => {
    setPrivacy((p) => ({ ...p, [key]: v }));
    const r = await GizlilikAyariKaydet(key, v);
    if (!r.ok) {
      setPrivacy((p) => ({ ...p, [key]: !v }));
      Alert.alert(t('gizlilik.kisaBaslik'), r.hata ?? t('ortak.kaydedilemedi'));
    }
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="gizlilik-ayarlar">
        <EkranBasligi
          title={t('gizlilik.kisaBaslik')}
          subtitle={t('gizlilik.altBaslik')}
          fallbackHref="/ayarlar"
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <ListeGrubu title={t('gizlilik.hesapGorunurlugu')}>
            <GizlilikAnahtarListesi
              maddeler={GizlilikAlanEtiketleri(t)}
              degerler={privacy}
              onDegistir={(k, v) => void degistir(k, v)}
              thumbColor={palet.bgElevated}
            />
          </ListeGrubu>

          <ListeGrubu title={t('gizlilik.profilGostergeleri')}>
            <Text style={[styles.hint, { color: palet.textMuted }]}>
              {t('gizlilik.profilGostergeHint')}
            </Text>
            <GizlilikAnahtarListesi
              maddeler={ProfilGostergeEtiketleri(t)}
              degerler={privacy}
              onDegistir={(k, v) => void degistir(k, v)}
              thumbColor={palet.bgElevated}
            />
          </ListeGrubu>

          <ListeGrubu title={t('gizlilik.islemHacmiBolum')}>
            <Text style={[styles.hint, { color: palet.textMuted }]}>
              {t('gizlilik.islemHacmiHint')}
            </Text>
            <ListeSatiri
              icon="diamond-outline"
              label={t('gizlilik.islemHacmiGorunurluk')}
              value={t('gizlilik.ayarla')}
              onPress={() => router.push('/islem-hacmi' as any)}
              last
            />
          </ListeGrubu>

          <ListeGrubu title={t('ayarlar.kisilerAramalar')}>
            <ListeSatiri
              icon="people-outline"
              label={t('gizlilik.kesifArama')}
              value={t('gizlilik.kesifDeger')}
              onPress={() => router.push('/ayarlar/kisiler-aramalar' as any)}
            />
            <ListeSatiri
              icon="ban-outline"
              label={t('ayarlar.engellenenHesaplar')}
              onPress={() => router.push('/engellenen-kullanicilar' as any)}
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
    gap: 0,
  },
  hint: {
    ...TipografiTokenlari.caption,
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.xs,
    lineHeight: 18,
  },
});
