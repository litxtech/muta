import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminEkonomiKatalogu,
  AdminHediyeAktiflik,
  AdminPaketAktiflik,
} from '../../src/moduller/admin/platform/AdminPlatformIslemleri';
import type {
  AdminHediye,
  AdminPaket,
} from '../../src/moduller/admin/tipler/PlatformTipleri';
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';

export default function AdminEkonomiEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [paketler, setPaketler] = useState<AdminPaket[]>([]);
  const [hediyeler, setHediyeler] = useState<AdminHediye[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const k = await AdminEkonomiKatalogu();
      setPaketler(k.paketler);
      setHediyeler(k.hediyeler);
    } catch (e) {
      Alert.alert('Ekonomi', e instanceof Error ? e.message : 'Katalog alınamadı');
      setPaketler([]);
      setHediyeler([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) return null;

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Ekonomi"
        subtitle="Paketler · hediyeler"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
            tintColor={RenkTokenlari.primarySoft}
          />
        }
      >
        {yukleniyor && !paketler.length ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : null}

        <Text style={AdminStil.sectionLabel}>Coin paketleri</Text>
        {paketler.map((p) => (
          <View key={p.id} style={AdminStil.kart}>
            <View style={AdminStil.satir}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={AdminStil.kartBaslik}>{p.title}</Text>
                <Text style={AdminStil.kartAlt}>
                  {p.coins}+{p.bonus_coins} coin ·{' '}
                  {p.price_try != null
                    ? `${Number(p.price_try).toLocaleString('tr-TR')} ₺`
                    : `$${p.price_usd}`}{' '}
                  · {p.sku}
                </Text>
              </View>
              <View style={AdminStil.chip}>
                <Text
                  style={[
                    AdminStil.chipYazi,
                    {
                      color: p.is_active
                        ? RenkTokenlari.success
                        : RenkTokenlari.textDim,
                    },
                  ]}
                >
                  {p.is_active ? 'Aktif' : 'Kapalı'}
                </Text>
              </View>
            </View>
            <Pressable
              style={AdminStil.aksiyon}
              onPress={async () => {
                try {
                  await AdminPaketAktiflik(p.id, !p.is_active);
                  await yukle();
                } catch (e) {
                  Alert.alert(
                    'Hata',
                    e instanceof Error ? e.message : 'Güncellenemedi',
                  );
                }
              }}
            >
              <Text style={AdminStil.aksiyonYazi}>
                {p.is_active ? 'Pasifleştir' : 'Aktifleştir'}
              </Text>
            </Pressable>
          </View>
        ))}

        <Text style={AdminStil.sectionLabel}>Hediye kataloğu</Text>
        {hediyeler.map((h) => (
          <View key={h.id} style={AdminStil.kart}>
            <View style={AdminStil.satir}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={AdminStil.kartBaslik}>
                  {h.emoji} {h.name}
                </Text>
                <Text style={AdminStil.kartAlt}>
                  {h.coin_cost} coin → {h.diamond_value} elmas · {h.rarity}
                </Text>
              </View>
              <View style={AdminStil.chip}>
                <Text
                  style={[
                    AdminStil.chipYazi,
                    {
                      color: h.is_active
                        ? RenkTokenlari.success
                        : RenkTokenlari.textDim,
                    },
                  ]}
                >
                  {h.is_active ? 'Aktif' : 'Kapalı'}
                </Text>
              </View>
            </View>
            <Pressable
              style={AdminStil.aksiyon}
              onPress={async () => {
                try {
                  await AdminHediyeAktiflik(h.id, !h.is_active);
                  await yukle();
                } catch (e) {
                  Alert.alert(
                    'Hata',
                    e instanceof Error ? e.message : 'Güncellenemedi',
                  );
                }
              }}
            >
              <Text style={AdminStil.aksiyonYazi}>
                {h.is_active ? 'Pasifleştir' : 'Aktifleştir'}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
