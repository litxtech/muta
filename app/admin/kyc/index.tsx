import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  AdminKycBelgeUrl,
  AdminKycDurumGuncelle,
  AdminKycListesi,
  type AdminKycBasvuru,
} from '../../../src/moduller/admin/kyc/AdminKycIslemleri';
import { AdminStil } from '../../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';

const DOC_LABEL: Record<string, string> = {
  id_card: 'Kimlik',
  passport: 'Pasaport',
  drivers_license: 'Ehliyet',
  temporary_id: 'Geçici kimlik',
};

export default function AdminKycEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [liste, setListe] = useState<AdminKycBasvuru[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setListe(await AdminKycListesi(60));
    } catch (e) {
      Alert.alert('KYC', e instanceof Error ? e.message : 'Yüklenemedi');
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

  const belgeAc = async (path: string | null | undefined) => {
    if (!path) return;
    const url = await AdminKycBelgeUrl(path);
    if (!url) {
      Alert.alert('Belge', 'URL alınamadı');
      return;
    }
    await Linking.openURL(url);
  };

  const karar = (row: AdminKycBasvuru, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Onayla' : 'Reddet',
      `${row.first_name} ${row.last_name}`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(row.id);
            try {
              await AdminKycDurumGuncelle(row.id, status);
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
        title="Kimlik onayı"
        subtitle="KYC kuyruğu · belge · canlılık"
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
          <Text style={AdminStil.bos}>Başvuru yok</Text>
        ) : (
          liste.map((r) => {
            const kisi =
              r.profiles?.display_name ||
              (r.profiles?.username ? `@${r.profiles.username}` : r.user_id.slice(0, 8));
            const pending = r.status === 'pending';
            return (
              <View key={r.id} style={AdminStil.kart}>
                <View style={AdminStil.satir}>
                  <Text style={AdminStil.kartBaslik} numberOfLines={1}>
                    {r.first_name} {r.last_name}
                  </Text>
                  <View style={AdminStil.chip}>
                    <Text style={AdminStil.chipYazi}>{r.status}</Text>
                  </View>
                </View>
                <Text style={AdminStil.kartAlt}>
                  {kisi} · {DOC_LABEL[r.doc_type] ?? r.doc_type}
                </Text>
                <Text style={AdminStil.kartAlt}>
                  Doğum: {r.birth_date}
                  {r.hometown ? ` · ${r.hometown}` : ''}
                </Text>
                <Text style={AdminStil.kartAlt}>
                  {r.phone_e164 ?? '—'} · {r.email ?? '—'} · {r.country ?? '—'}
                </Text>
                <Text style={AdminStil.kartAlt}>
                  Canlılık: {r.liveness_passed ? 'geçti' : 'yok'}
                </Text>
                <View style={[AdminStil.satir, { marginTop: 8, gap: 8 }]}>
                  <Pressable onPress={() => void belgeAc(r.doc_front_path)}>
                    <Text style={AdminStil.aksiyonYazi}>Ön yüz</Text>
                  </Pressable>
                  {r.doc_back_path ? (
                    <Pressable onPress={() => void belgeAc(r.doc_back_path)}>
                      <Text style={AdminStil.aksiyonYazi}>Arka yüz</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => void belgeAc(r.selfie_path)}>
                    <Text style={AdminStil.aksiyonYazi}>Selfie</Text>
                  </Pressable>
                </View>
                {pending ? (
                  <View style={[AdminStil.satir, { marginTop: 10 }]}>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => karar(r, 'approved')}
                      style={{ opacity: busyId === r.id ? 0.5 : 1 }}
                    >
                      <Text
                        style={[
                          AdminStil.aksiyonYazi,
                          { color: RenkTokenlari.mint },
                        ]}
                      >
                        Onayla
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === r.id}
                      onPress={() => karar(r, 'rejected')}
                    >
                      <Text
                        style={[
                          AdminStil.aksiyonYazi,
                          { color: RenkTokenlari.danger },
                        ]}
                      >
                        Reddet
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
