import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { BosDurum } from '../../src/components/BosDurum';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { DurumKart } from '../../src/moduller/durum/bilesenler/DurumKart';
import { DurumYorumPaneli } from '../../src/moduller/durum/bilesenler/DurumYorumPaneli';
import { KullaniciGuvenlikMenusu } from '../../src/moduller/moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import {
  DurumAkisiniGetir,
  DurumTakipAkisiniGetir,
  DurumBegeniToggle,
  DurumSil,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function DurumAkisEkrani() {
  const { isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const magaza = useHediyeMagaza();
  const [items, setItems] = useState<DurumOggesi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yorumStatusId, setYorumStatusId] = useState<string | null>(null);
  const [bildirOge, setBildirOge] = useState<DurumOggesi | null>(null);
  const [sekme, setSekme] = useState<'sana' | 'takip'>('sana');

  const yukle = useCallback(async () => {
    try {
      setItems(
        sekme === 'takip'
          ? await DurumTakipAkisiniGetir(50)
          : await DurumAkisiniGetir(50),
      );
    } catch {
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, [sekme]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const begen = (oge: DurumOggesi) => {
    islemiDene('yorum_yap', () => {
      void (async () => {
        const r = await DurumBegeniToggle(oge.id);
        if (!r.ok) {
          Alert.alert('Beğeni', r.hata ?? 'Başarısız');
          return;
        }
        setItems((prev) =>
          prev.map((x) =>
            x.id === oge.id
              ? {
                  ...x,
                  liked_by_me: !!r.liked,
                  like_count: r.like_count ?? x.like_count,
                }
              : x,
          ),
        );
      })();
    });
  };

  const hediyeAc = (oge: DurumOggesi) => {
    magaza.ac({
      receiverId: oge.user_id,
      aliciAdi: oge.display_name,
      statusId: oge.id,
      animasyon: true,
      onBasarili: (_gift, adet) => {
        setItems((prev) =>
          prev.map((x) =>
            x.id === oge.id
              ? { ...x, gift_count: (x.gift_count ?? 0) + adet }
              : x,
          ),
        );
      },
    });
  };

  const sil = (oge: DurumOggesi) => {
    Alert.alert('Gönderiyi sil', 'Bu paylaşım kaldırılacak. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await DurumSil(oge.id);
            if (!r.ok) {
              Alert.alert('Sil', r.hata ?? 'Silinemedi');
              return;
            }
            setItems((prev) => prev.filter((x) => x.id !== oge.id));
          })();
        },
      },
    ]);
  };

  const menuAc = (oge: DurumOggesi) => {
    if (oge.is_mine) {
      const buttons: {
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }[] = [];
      if (oge.post_kind !== 'game_win') {
        buttons.push({
          text: 'Düzenle',
          onPress: () => router.push(`/durum/duzenle?id=${oge.id}` as any),
        });
      }
      buttons.push(
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => sil(oge),
        },
        { text: 'Vazgeç', style: 'cancel' },
      );
      Alert.alert('Gönderi', undefined, buttons);
      return;
    }
    Alert.alert('Gönderi', undefined, [
      {
        text: 'Bildir',
        style: 'destructive',
        onPress: () => setBildirOge(oge),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <Screen edges={['top']} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="durum">
        <View style={styles.header}>
          <Text style={styles.title}>Durum</Text>
          <Pressable
            style={styles.paylasBtn}
            onPress={() =>
              islemiDene('durum_paylas', () => router.push('/durum/olustur' as any))
            }
            accessibilityLabel="Durum paylaş"
          >
            <Ionicons name="create-outline" size={20} color={RenkTokenlari.text} />
          </Pressable>
        </View>
        <View style={styles.sekmeRow}>
          <Pressable
            onPress={() => setSekme('sana')}
            style={[styles.sekme, sekme === 'sana' && styles.sekmeOn]}
            accessibilityRole="button"
            accessibilityLabel="Sana özel"
          >
            <Text style={[styles.sekmeYazi, sekme === 'sana' && styles.sekmeYaziOn]}>Sana Özel</Text>
          </Pressable>
          <Pressable
            onPress={() => setSekme('takip')}
            style={[styles.sekme, sekme === 'takip' && styles.sekmeOn]}
            accessibilityRole="button"
            accessibilityLabel="Takip"
          >
            <Text style={[styles.sekmeYazi, sekme === 'takip' && styles.sekmeYaziOn]}>Takip</Text>
          </Pressable>
        </View>

        {yukleniyor && !items.length ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor}
                onRefresh={() => {
                  setYukleniyor(true);
                  void yukle();
                }}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
            ListEmptyComponent={
              <BosDurum
                icon="images-outline"
                title={sekme === 'takip' ? 'Takip ettiğin paylaşımlar yok' : 'Henüz durum yok'}
                body={
                  sekme === 'takip'
                    ? 'Takip ettiğin hesapların gönderileri burada görünür.'
                    : 'İlk fotoğraf veya videonu paylaş — akış burada canlanır.'
                }
              />
            }
            renderItem={({ item }) => (
              <DurumKart
                oge={item}
                onPress={() => router.push(`/durum/${item.id}` as any)}
                onBegen={() => begen(item)}
                onYorum={() =>
                  islemiDene('yorum_yap', () => setYorumStatusId(item.id))
                }
                onHediye={() => hediyeAc(item)}
                onProfil={() =>
                  router.push(`/kullanici/${item.user_id}` as any)
                }
                onMenu={() => menuAc(item)}
              />
            )}
          />
        )}

        {yorumStatusId ? (
          <DurumYorumPaneli
            visible
            statusId={yorumStatusId}
            onClose={() => setYorumStatusId(null)}
            onChanged={() => void yukle()}
            onProfil={(uid) => {
              setYorumStatusId(null);
              router.push(`/kullanici/${uid}` as any);
            }}
          />
        ) : null}

        {bildirOge ? (
          <KullaniciGuvenlikMenusu
            visible
            targetUserId={bildirOge.user_id}
            targetName={bildirOge.display_name}
            contentType="status_post"
            contentId={bildirOge.id}
            contentPreview={bildirOge.caption}
            contentMediaUrl={bildirOge.media_url}
            onClose={() => setBildirOge(null)}
            onReported={() =>
              Alert.alert(
                'Bildirim alındı',
                'Raporunuz incelenecek. Teşekkürler — güvenli bir topluluk için bildiriminiz önemli.',
              )
            }
          />
        ) : null}

        <HediyeMagazaBaglamasi magaza={magaza} misafirKart={false} />

        <HesabiTamamlaKarti
          visible={upgradeAcik || magaza.upgradeAcik}
          onClose={() => {
            upgradeKapat();
            magaza.upgradeKapat();
          }}
          onCompleted={() => {
            upgradeKapat();
            magaza.upgradeKapat();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  title: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    fontSize: 22,
    fontWeight: '800',
  },
  sekmeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.sm,
  },
  sekme: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.bgCard,
  },
  sekmeOn: {
    backgroundColor: RenkTokenlari.primary,
  },
  sekmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
  },
  sekmeYaziOn: { color: '#fff' },
  paylasBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU + 16,
  },
});
