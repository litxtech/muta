import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  MesajKonulariniGetir,
  type MesajKonusu,
} from '../../src/moduller/mesajlasma/okuma/MesajKonulariniGetir';
import { MesajThreadArsivle, MesajSohbetSil } from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { MesajMarkaBasligi } from '../../src/moduller/mesajlasma/bilesenler/MesajMarkaBasligi';
import { MesajKonuKarti } from '../../src/moduller/mesajlasma/bilesenler/MesajKonuKarti';
import { MesajBosDurum } from '../../src/moduller/mesajlasma/bilesenler/MesajBosDurum';
import { useMesajInboxKanali } from '../../src/moduller/mesajlasma/gercek-zamanli/useMesajKanali';
import { useMesajOkunmamis } from '../../src/moduller/mesajlasma/baglam/MesajOkunmamisSaglayici';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';

export default function MessagesScreen() {
  const acik = OzellikBayragiAktifMi('messages_enabled');
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const { sayfayiAcincaTemizle, yenile: mesajRozetYenile } = useMesajOkunmamis();
  const [konular, setKonular] = useState<MesajKonusu[]>([]);
  const [arsivModu, setArsivModu] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!acik || isGuest) {
      setKonular([]);
      return;
    }
    setLoading(true);
    try {
      setKonular(await MesajKonulariniGetir(arsivModu));
    } catch {
      setKonular([]);
    } finally {
      setLoading(false);
    }
  }, [acik, isGuest, arsivModu]);

  useFocusEffect(
    useCallback(() => {
      sayfayiAcincaTemizle();
      void load().then(() => {
        void mesajRozetYenile();
      });
    }, [load, sayfayiAcincaTemizle, mesajRozetYenile]),
  );

  useMesajInboxKanali(() => {
    void load();
  });

  const yeniSohbet = () => {
    islemiDene('mesaj_gonder', () => {
      router.push('/mesaj/yeni' as any);
    });
  };

  const konuMenu = (konu: MesajKonusu) => {
    Alert.alert(konu.peer_display_name || 'Sohbet', undefined, [
      arsivModu
        ? {
            text: 'Arşivden çıkar',
            onPress: () => {
              void (async () => {
                await MesajThreadArsivle(konu.id, false);
                await load();
              })();
            },
          }
        : {
            text: 'Arşivle',
            onPress: () => {
              void (async () => {
                await MesajThreadArsivle(konu.id, true);
                await load();
              })();
            },
          },
      {
        text: 'Sohbeti sil',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Sohbeti sil',
            'Bu sohbet senden tamamen silinir. Karşı taraf etkilenmez. Yeni mesaj gelirse tekrar görünür.',
            [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Sil',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    const r = await MesajSohbetSil(konu.id);
                    if (!r.ok) Alert.alert('Silinemedi', r.hata);
                    else await load();
                  })();
                },
              },
            ],
          );
        },
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  const altYazi = !acik
    ? 'Mesajlaşma şu an kapalı'
    : isGuest
      ? 'Mesaj göndermek için hesabını tamamla'
      : arsivModu
        ? 'Arşivlenmiş sohbetler'
        : 'Anlık mesajlaşma · foto & video';

  return (
    <Screen edges={['top']} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="mesajlasma">
        <MesajMarkaBasligi
          altYazi={altYazi}
          sohbetSayisi={konular.length}
          onYeniSohbet={yeniSohbet}
        />

        <TamusoBanner placement="MESSAGES_TOP" screen="MESSAGES" />

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, !arsivModu && styles.tabAktif]}
            onPress={() => setArsivModu(false)}
          >
            <Text style={[styles.tabText, !arsivModu && styles.tabTextAktif]}>
              Sohbetler
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, arsivModu && styles.tabAktif]}
            onPress={() => setArsivModu(true)}
          >
            <Text style={[styles.tabText, arsivModu && styles.tabTextAktif]}>
              Arşiv
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={konular}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            konular.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <MesajBosDurum
              misafir={isGuest}
              kapali={!acik}
              onAksiyon={yeniSohbet}
            />
          }
          renderItem={({ item }) => (
            <MesajKonuKarti
              konu={item}
              onPress={() => router.push(`/mesaj/${item.id}` as any)}
              onLongPress={() => konuMenu(item)}
            />
          )}
        />

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tabAktif: {
    borderColor: RenkTokenlari.mint,
    backgroundColor: 'rgba(61,207,176,0.14)',
  },
  tabText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  tabTextAktif: { color: RenkTokenlari.mint },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
  },
  listEmpty: { flexGrow: 1 },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
    marginLeft: 68,
  },
});
