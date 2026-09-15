import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminBayraklariGetir,
  AdminDuyuruOlustur,
  AdminKillSwitchAyarla,
  AdminOzellikBayragiAyarla,
} from '../../src/moduller/admin/platform/AdminPlatformIslemleri';
import type {
  AdminBayrak,
  AdminKill,
} from '../../src/moduller/admin/tipler/PlatformTipleri';
import {
  DuyuruOncelikEtiketi,
  KillSwitchMetni,
  OzellikBayragiMetni,
} from '../../src/moduller/admin/ozellikler/AdminOzellikEtiketleri';
import { AdminStil } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';

export default function AdminOzelliklerEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [flags, setFlags] = useState<AdminBayrak[]>([]);
  const [kills, setKills] = useState<AdminKill[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [duyuru, setDuyuru] = useState({ title: '', body: '', priority: 'normal' });

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const d = await AdminBayraklariGetir();
      setFlags(d.flags);
      setKills(d.kills);
    } catch (e) {
      Alert.alert(
        'Özellikler',
        e instanceof Error ? e.message : 'Bayraklar alınamadı',
      );
      setFlags([]);
      setKills([]);
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

  const duyuruGonder = async () => {
    if (!duyuru.title.trim() || !duyuru.body.trim()) {
      Alert.alert('Duyuru', 'Başlık ve metin gerekli.');
      return;
    }
    try {
      await AdminDuyuruOlustur(duyuru.title, duyuru.body, duyuru.priority);
      setDuyuru({ title: '', body: '', priority: 'normal' });
      Alert.alert('Tamam', 'Duyuru yayınlandı.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Duyuru oluşturulamadı');
    }
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Özellikler"
        subtitle="Modülleri aç/kapa · acil durdur · duyuru"
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
        <View style={AdminStil.kart}>
          <Text style={AdminStil.kartBaslik}>Yeni duyuru</Text>
          <Text style={AdminStil.kartAlt}>
            Tüm kullanıcılara uygulama içi duyuru gönderir.
          </Text>
          <TextInput
            style={AdminStil.input}
            placeholder="Başlık"
            placeholderTextColor={RenkTokenlari.textDim}
            value={duyuru.title}
            onChangeText={(t) => setDuyuru((s) => ({ ...s, title: t }))}
          />
          <TextInput
            style={[AdminStil.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Duyuru metni"
            placeholderTextColor={RenkTokenlari.textDim}
            value={duyuru.body}
            onChangeText={(t) => setDuyuru((s) => ({ ...s, body: t }))}
            multiline
          />
          <Text style={[AdminStil.kartAlt, { marginTop: 4 }]}>Öncelik</Text>
          <View style={AdminStil.aksiyonSatir}>
            {['low', 'normal', 'high', 'urgent'].map((p) => (
              <Pressable
                key={p}
                style={[
                  AdminStil.aksiyon,
                  duyuru.priority === p && {
                    borderColor: RenkTokenlari.primarySoft,
                  },
                ]}
                onPress={() => setDuyuru((s) => ({ ...s, priority: p }))}
              >
                <Text style={AdminStil.aksiyonYazi}>{DuyuruOncelikEtiketi(p)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={AdminStil.aksiyon} onPress={() => void duyuruGonder()}>
            <Text
              style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.primarySoft }]}
            >
              Duyuruyu yayınla
            </Text>
          </Pressable>
        </View>

        {yukleniyor && !flags.length ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : null}

        <Text style={AdminStil.sectionLabel}>Özellikler (aç / kapa)</Text>
        <Text style={[AdminStil.kartAlt, { marginTop: -4 }]}>
          Kapalı özellik uygulamada gizlenir veya kullanılamaz.
        </Text>
        {flags.map((f) => {
          const metin = OzellikBayragiMetni(f.key, f.description);
          return (
            <View key={f.key} style={AdminStil.kart}>
              <View style={AdminStil.satir}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={AdminStil.kartBaslik}>{metin.baslik}</Text>
                  <Text style={AdminStil.kartAlt}>{metin.aciklama}</Text>
                  <Text
                    style={[
                      AdminStil.chipYazi,
                      {
                        color: f.enabled
                          ? RenkTokenlari.primarySoft
                          : RenkTokenlari.textDim,
                      },
                    ]}
                  >
                    {f.enabled ? 'Açık' : 'Kapalı'}
                  </Text>
                </View>
                <Switch
                  value={f.enabled}
                  onValueChange={async (v) => {
                    try {
                      await AdminOzellikBayragiAyarla(f.key, v);
                      await yukle();
                    } catch (e) {
                      Alert.alert(
                        'Hata',
                        e instanceof Error ? e.message : 'Güncellenemedi',
                      );
                    }
                  }}
                  trackColor={{
                    false: RenkTokenlari.surface,
                    true: RenkTokenlari.primary,
                  }}
                />
              </View>
            </View>
          );
        })}

        <Text style={AdminStil.sectionLabel}>Acil durdurma</Text>
        <Text style={[AdminStil.kartAlt, { marginTop: -4 }]}>
          Açıkken ilgili işlem anında kesilir. Normal durumda hepsi kapalı olmalı.
        </Text>
        {kills.map((k) => {
          const metin = KillSwitchMetni(k.key);
          return (
            <View key={k.key} style={AdminStil.kart}>
              <View style={AdminStil.satir}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={AdminStil.kartBaslik}>{metin.baslik}</Text>
                  <Text style={AdminStil.kartAlt}>{metin.aciklama}</Text>
                  <Text
                    style={[
                      AdminStil.chipYazi,
                      {
                        color: k.active
                          ? RenkTokenlari.danger
                          : RenkTokenlari.textDim,
                      },
                    ]}
                  >
                    {k.active
                      ? k.reason?.trim() || 'Durduruldu'
                      : 'Normal (kapalı)'}
                  </Text>
                </View>
                <Switch
                  value={k.active}
                  onValueChange={async (v) => {
                    try {
                      await AdminKillSwitchAyarla(
                        k.key,
                        v,
                        v ? 'Admin panelinden açıldı' : undefined,
                      );
                      await yukle();
                    } catch (e) {
                      Alert.alert(
                        'Hata',
                        e instanceof Error ? e.message : 'Güncellenemedi',
                      );
                    }
                  }}
                  trackColor={{
                    false: RenkTokenlari.surface,
                    true: RenkTokenlari.danger,
                  }}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
