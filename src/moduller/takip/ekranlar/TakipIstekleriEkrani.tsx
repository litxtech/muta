import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../../../components/Screen';
import { EkranBasligi } from '../../../components/EkranBasligi';
import { BosDurum } from '../../../components/BosDurum';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { TakipciKarti } from '../bilesenler/TakipciKarti';
import { useTakipIstekleri } from '../kancalar/useTakipIstekleri';
import { TakipHataMesaji } from '../TakipHataMesajlari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { router } from 'expo-router';

export function TakipIstekleriEkrani() {
  const { items, yukleniyor, hata, kabul, reddet } = useTakipIstekleri();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="takip-istekleri">
        <EkranBasligi
          title="Takip İstekleri"
          subtitle="Onayla veya sil"
          fallbackHref="/(tabs)/profile"
        />
        {yukleniyor && !items.length ? (
          <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.request_id ?? i.user_id}
            ListEmptyComponent={
              hata ? (
                <BosDurum icon="warning-outline" title="Yüklenemedi" body={hata} />
              ) : (
                <BosDurum
                  icon="mail-unread-outline"
                  title="Bekleyen istek yok"
                  body="Gizli hesabına gelen takip istekleri burada görünür."
                />
              )
            }
            renderItem={({ item }) => (
              <View>
                <TakipciKarti
                  kart={item}
                  hideFollow
                  onPress={() => router.push(`/kullanici/${item.user_id}` as any)}
                />
                <View style={styles.aksiyon}>
                  <Pressable
                    style={styles.onay}
                    disabled={busy === item.user_id}
                    onPress={() => {
                      if (!item.request_id) return;
                      void (async () => {
                        setBusy(item.user_id);
                        const r = await kabul(item.request_id!, item.user_id);
                        setBusy(null);
                        if (!r.ok) Alert.alert('İstek', r.hata ?? TakipHataMesaji(r.code));
                      })();
                    }}
                  >
                    <Text style={styles.onayYazi}>Onayla</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sil}
                    disabled={busy === item.user_id}
                    onPress={() => {
                      if (!item.request_id) return;
                      void (async () => {
                        setBusy(item.user_id);
                        const r = await reddet(item.request_id!, item.user_id);
                        setBusy(null);
                        if (!r.ok) Alert.alert('İstek', r.hata ?? TakipHataMesaji(r.code));
                      })();
                    }}
                  >
                    <Text style={styles.silYazi}>Sil</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aksiyon: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.md,
  },
  onay: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
    alignItems: 'center',
  },
  onayYazi: { ...TipografiTokenlari.caption, color: '#fff', fontWeight: '800' },
  sil: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  silYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700' },
});
