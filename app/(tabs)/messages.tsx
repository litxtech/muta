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
import { GorusmeGecmisPaneli } from '../../src/moduller/gorusme/bilesenler/GorusmeGecmisPaneli';
import {
  CihazPushTokeniniKaydet,
  MesajPushIzniGerekirseIste,
} from '../../src/moduller/bildirimler/BildirimlerPublicSozlesmesi';

type Sekme = 'sohbet' | 'arsiv' | 'gorusme';

export default function MessagesScreen() {
  const acik = OzellikBayragiAktifMi('messages_enabled');
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const { sayfayiAcincaTemizle, yenile: mesajRozetYenile } = useMesajOkunmamis();
  const [konular, setKonular] = useState<MesajKonusu[]>([]);
  const [sekme, setSekme] = useState<Sekme>('sohbet');
  const arsivModu = sekme === 'arsiv';
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ilkYuklemeBitti = React.useRef(false);
  const loadNesil = React.useRef(0);

  const load = useCallback(async (mod: 'ilk' | 'sessiz' | 'pull' = 'sessiz') => {
    if (!acik || isGuest) {
      setKonular([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const nesil = ++loadNesil.current;
    try {
      if (mod === 'ilk') setLoading(true);
      if (mod === 'pull') setRefreshing(true);
      const data = await MesajKonulariniGetir(arsivModu);
      if (nesil !== loadNesil.current) return;
      setKonular(
        (data ?? []).filter(
          (k) => typeof k?.id === 'string' && k.id.length > 0,
        ),
      );
    } catch {
      if (nesil !== loadNesil.current) return;
      setKonular([]);
    } finally {
      if (nesil !== loadNesil.current) return;
      if (mod === 'ilk') setLoading(false);
      if (mod === 'pull') setRefreshing(false);
      ilkYuklemeBitti.current = true;
    }
  }, [acik, isGuest, arsivModu]);

  useFocusEffect(
    useCallback(() => {
      sayfayiAcincaTemizle();
      void load(ilkYuklemeBitti.current ? 'sessiz' : 'ilk').then(() => {
        void mesajRozetYenile();
      });
      if (!isGuest && acik) {
        void MesajPushIzniGerekirseIste().then((sonuc) => {
          if (sonuc.granted) {
            void CihazPushTokeniniKaydet().catch(() => undefined);
          }
        });
      }
      return () => {
        loadNesil.current += 1;
        setRefreshing(false);
        setLoading(false);
      };
    }, [load, sayfayiAcincaTemizle, mesajRozetYenile, isGuest, acik]),
  );

  useMesajInboxKanali(() => {
    void load('sessiz');
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
                await load('sessiz');
              })();
            },
          }
        : {
            text: 'Arşivle',
            onPress: () => {
              void (async () => {
                await MesajThreadArsivle(konu.id, true);
                await load('sessiz');
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
                    else await load('sessiz');
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
      : sekme === 'arsiv'
        ? 'Arşivlenmiş sohbetler'
        : sekme === 'gorusme'
          ? 'Devam eden ve geçmiş görüşmeler'
          : 'Anlık mesajlaşma · foto & video';

  return (
    <Screen edges={['top']} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="mesajlasma">
        <MesajMarkaBasligi
          altYazi={altYazi}
          sohbetSayisi={sekme === 'gorusme' ? 0 : konular.length}
          onYeniSohbet={yeniSohbet}
        />

        <ModulHataSiniri
          modulAdi="mesaj-banner"
          varyant="kart"
          yedek={<View />}
        >
          <TamusoBanner placement="MESSAGES_TOP" screen="MESSAGES" />
        </ModulHataSiniri>

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, sekme === 'sohbet' && styles.tabAktif]}
            onPress={() => setSekme('sohbet')}
          >
            <Text
              style={[styles.tabText, sekme === 'sohbet' && styles.tabTextAktif]}
            >
              Sohbetler
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, sekme === 'gorusme' && styles.tabAktif]}
            onPress={() => setSekme('gorusme')}
          >
            <Text
              style={[
                styles.tabText,
                sekme === 'gorusme' && styles.tabTextAktif,
              ]}
            >
              Görüşmeler
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, sekme === 'arsiv' && styles.tabAktif]}
            onPress={() => setSekme('arsiv')}
          >
            <Text
              style={[styles.tabText, sekme === 'arsiv' && styles.tabTextAktif]}
            >
              Arşiv
            </Text>
          </Pressable>
        </View>

        {sekme === 'gorusme' ? (
          <GorusmeGecmisPaneli misafir={isGuest} />
        ) : (
          <FlatList
            data={konular}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load('pull')}
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
                onPress={() => {
                  if (!item?.id) return;
                  router.push(`/mesaj/${item.id}` as any);
                }}
                onLongPress={() => konuMenu(item)}
              />
            )}
          />
        )}

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
