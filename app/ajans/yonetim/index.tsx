import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { BosDurum } from '../../../src/components/BosDurum';
import { ModulHataSiniri } from '../../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  AjansYonetimAjanslarim,
  type AjansYonetimOzet,
} from '../../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import { SahipOlunanAjanslariGetir } from '../../../src/moduller/ajanslar/okuma/AjanslariGetir';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Ajans yetkisi olan kullanıcı — yönetim hub */
export default function AjansYonetimHubEkrani() {
  const [liste, setListe] = useState<AjansYonetimOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      let a = await AjansYonetimAjanslarim();
      if (!a.length) {
        const yedek = await SahipOlunanAjanslariGetir().catch(() => []);
        a = yedek.map((x) => ({
          id: x.id,
          agency_public_id: x.agency_public_id,
          name: x.name,
          status: x.status,
          is_coin_distributor: x.is_coin_distributor,
          invite_code: x.invite_code,
          host_count: x.host_count,
          level_code: x.level_code,
        }));
      }
      setListe(a);
      if (a.length === 1) {
        router.replace(`/ajans/${a[0].id}` as any);
      }
    } catch {
      try {
        const yedek = await SahipOlunanAjanslariGetir();
        const a = yedek.map((x) => ({
          id: x.id,
          agency_public_id: x.agency_public_id,
          name: x.name,
          status: x.status,
          is_coin_distributor: x.is_coin_distributor,
          invite_code: x.invite_code,
          host_count: x.host_count,
          level_code: x.level_code,
        }));
        setListe(a);
        if (a.length === 1) {
          router.replace(`/ajans/${a[0].id}` as any);
        }
      } catch {
        setListe([]);
      }
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajans-yonetim" varyant="ekran" fallbackHref="/ajans">
        <EkranBasligi
          title="Ajansım"
          subtitle="Üyeler · ciro · davet · oda"
          fallbackHref={"/(tabs)/profile" as any}
        />
        {yukleniyor ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : liste.length === 0 ? (
          <View style={styles.bosWrap}>
            <BosDurum
              title="Ajansın yok"
              body="Başvuru gönder; admin onayından sonra buradan yönetirsin."
            />
            <Pressable
              style={styles.bosBtn}
              onPress={() => router.push('/ajans' as any)}
            >
              <Text style={styles.bosBtnYazi}>Ajans kur</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={liste}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.liste}
            renderItem={({ item }) => (
              <Pressable
                style={styles.kart}
                onPress={() => router.push(`/ajans/${item.id}` as any)}
              >
                <View style={styles.kartSol}>
                  <Text style={styles.ad}>{item.name}</Text>
                  <Text style={styles.alt}>
                    {item.agency_public_id} · {item.level_code ?? '—'} ·{' '}
                    {item.host_count} host
                  </Text>
                  <Text style={styles.chip}>
                    {item.is_coin_distributor ? 'Coin yetkisi açık' : 'Coin yetkisi kapalı'}
                    {' · '}
                    {item.status}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={RenkTokenlari.textDim}
                />
              </Pressable>
            )}
          />
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  liste: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.sm,
  },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  kartSol: { flex: 1, gap: 4 },
  ad: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  chip: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    marginTop: 4,
  },
  bosWrap: { paddingTop: 24, gap: 16, alignItems: 'center' },
  bosBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  bosBtnYazi: {
    ...TipografiTokenlari.body,
    color: '#12040C',
    fontWeight: '800',
  },
});
