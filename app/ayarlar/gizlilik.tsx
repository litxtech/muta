import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ListeGrubu, ListeSatiri } from '../../src/components/ListeSatiri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  GIZLILIK_ALAN_ETIKETLERI,
  PROFIL_GOSTERGE_GIZLILIK,
  GizlilikAyariKaydet,
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { GizlilikAnahtarListesi } from '../../src/moduller/ayarlar/bilesenler/GizlilikAnahtarListesi';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

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
      Alert.alert('Gizlilik', r.hata ?? 'Kaydedilemedi');
    }
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="gizlilik-ayarlar">
        <EkranBasligi
          title="Gizlilik"
          subtitle="Kim ne görür"
          fallbackHref="/ayarlar"
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <ListeGrubu title="Hesap görünürlüğü">
            <GizlilikAnahtarListesi
              maddeler={GIZLILIK_ALAN_ETIKETLERI}
              degerler={privacy}
              onDegistir={(k, v) => void degistir(k, v)}
              thumbColor={palet.bgElevated}
            />
          </ListeGrubu>

          <ListeGrubu title="Profil göstergeleri">
            <Text style={[styles.hint, { color: palet.textMuted }]}>
              Kapalı olanlar profilini ziyaret edenlere görünmez.
            </Text>
            <GizlilikAnahtarListesi
              maddeler={PROFIL_GOSTERGE_GIZLILIK}
              degerler={privacy}
              onDegistir={(k, v) => void degistir(k, v)}
              thumbColor={palet.bgElevated}
            />
          </ListeGrubu>

          <ListeGrubu title="Kişiler">
            <ListeSatiri
              icon="ban-outline"
              label="Engellenen hesaplar"
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
