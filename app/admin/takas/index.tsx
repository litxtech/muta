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
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { useAuth } from '../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminTakasListesi,
  AdminTakasPlatformOnay,
  type AdminTakasTeklif,
} from '../../../src/moduller/admin/takas/AdminTakasIslemleri';
import { AdminStil } from '../../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';

function ad(p?: { display_name?: string | null; username?: string | null } | null) {
  if (!p) return '—';
  return p.display_name?.trim() || (p.username ? `@${p.username}` : '—');
}

export default function AdminTakasEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [liste, setListe] = useState<AdminTakasTeklif[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setListe(await AdminTakasListesi(60));
    } catch (e) {
      Alert.alert('Takas', e instanceof Error ? e.message : 'Yüklenemedi');
      setListe([]);
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

  const karar = (row: AdminTakasTeklif, accept: boolean) => {
    Alert.alert(
      accept ? 'Platform onayı' : 'Reddet',
      `${row.coins.toLocaleString('tr-TR')} coin`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: accept ? 'Onayla' : 'Reddet',
          style: accept ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(row.id);
            try {
              await AdminTakasPlatformOnay(row.id, accept);
              await yukle();
            } catch (e) {
              Alert.alert(
                'Hata',
                e instanceof Error ? e.message : 'İşlem başarısız',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Coin takas"
        subtitle="Platform onay kuyruğu"
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
        {yukleniyor && !liste.length ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !liste.length ? (
          <Text style={AdminStil.bos}>Teklif yok</Text>
        ) : (
          liste.map((r) => {
            const alici =
              r.buyer_type === 'agency'
                ? r.agency?.name || r.agency?.agency_public_id || 'Ajans'
                : ad(r.buyer);
            const bekliyor = r.status === 'pending_platform';
            return (
              <View key={r.id} style={AdminStil.kart}>
                <View style={AdminStil.satir}>
                  <Text style={AdminStil.kartBaslik}>
                    {Number(r.coins).toLocaleString('tr-TR')} coin
                  </Text>
                  <View style={AdminStil.chip}>
                    <Text style={AdminStil.chipYazi}>{r.status}</Text>
                  </View>
                </View>
                <Text style={AdminStil.kartAlt}>
                  Satıcı: {ad(r.seller)}
                </Text>
                <Text style={AdminStil.kartAlt}>
                  Alıcı ({r.buyer_type}): {alici}
                </Text>
                {r.note ? (
                  <Text style={AdminStil.kartAlt} numberOfLines={2}>
                    {r.note}
                  </Text>
                ) : null}
                {bekliyor ? (
                  <View style={[AdminStil.satir, { marginTop: 10 }]}>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => karar(r, true)}
                    >
                      <Text
                        style={[
                          AdminStil.aksiyonYazi,
                          { color: RenkTokenlari.mint },
                        ]}
                      >
                        Platform onayla
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => karar(r, false)}
                    >
                      <Text
                        style={[
                          AdminStil.aksiyonYazi,
                          { color: RenkTokenlari.danger },
                        ]}
                      >
                        Reddet / iade
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <Text style={AdminStil.kartAlt}>
                  {new Date(r.created_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
