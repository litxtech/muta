import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { DepoyaMedyaYukle } from '../../src/ortak/medya/DepoyaMedyaYukle';
import {
  TakasAliciYanit,
  TakasDekontUrl,
  TakasDekontYukle,
  TakasOdemeBilgisiKaydet,
  TakasTekliflerimiGetir,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasIslemleri';
import {
  TAKAS_DURUM_ETIKET,
  type CoinTradeOffer,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import { ProfilMedyaBuyutucu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaBuyutucu';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function AjansTekliflerEkrani() {
  const insets = useSafeAreaInsets();
  const { user, refreshWallet } = useAuth();
  const [liste, setListe] = useState<CoinTradeOffer[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formTeklif, setFormTeklif] = useState<CoinTradeOffer | null>(null);
  const [satinAlinan, setSatinAlinan] = useState('');
  const [odemeKaynak, setOdemeKaynak] = useState('');
  const [buyutUri, setBuyutUri] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const all = await TakasTekliflerimiGetir();
      // Ajans alıcısı olduğu teklifler
      setListe(all.filter((t) => t.buyer_type === 'agency' && t.buyer_agency_id));
    } catch {
      setListe([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const yanitla = (t: CoinTradeOffer, accept: boolean) => {
    Alert.alert(
      accept ? 'Teklifi kabul et' : 'Teklifi reddet',
      `${Number(t.coins).toLocaleString('tr-TR')} coin`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: accept ? 'Kabul' : 'Red',
          style: accept ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(t.id);
              const r = await TakasAliciYanit(t.id, accept);
              setBusyId(null);
              if (!r.ok) {
                Alert.alert('Hata', r.hata);
                return;
              }
              if (accept) {
                setFormTeklif({ ...t, status: 'pending_payment_info' });
                setSatinAlinan(String(t.coins));
                setOdemeKaynak('');
              } else {
                void refreshWallet();
              }
              await yukle();
            })();
          },
        },
      ],
    );
  };

  const odemeKaydet = async () => {
    if (!formTeklif) return;
    const n = Math.floor(Number(satinAlinan));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Form', 'Satın alınan coin miktarını gir.');
      return;
    }
    if (odemeKaynak.trim().length < 3) {
      Alert.alert('Form', 'Parayı nereden göndereceğinizi yazın.');
      return;
    }
    setBusyId(formTeklif.id);
    const r = await TakasOdemeBilgisiKaydet({
      offerId: formTeklif.id,
      coinsBought: n,
      paymentSource: odemeKaynak,
    });
    setBusyId(null);
    if (!r.ok) {
      Alert.alert('Form', r.hata);
      return;
    }
    Alert.alert(
      'Kaydedildi',
      '1 gün içinde ödeme dekontunu sisteme yükleyin. Yüklenmezse ajansa ciddi uyarı gider ve işlem admin paneline düşer.',
    );
    setFormTeklif(null);
    await yukle();
  };

  const dekontYukle = async (t: CoinTradeOffer) => {
    const uid = user?.id;
    if (!uid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin', 'Dekont için galeri izni gerekli.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (pick.canceled || !pick.assets[0]?.uri) return;

    setBusyId(t.id);
    try {
      const path = `${uid}/receipt-${t.id}-${Date.now()}.jpg`;
      const up = await DepoyaMedyaYukle(supabase, {
        bucket: 'trade-receipts',
        path,
        uri: pick.assets[0].uri,
        mime: 'image/jpeg',
        tur: 'image',
      });
      if (!up.ok) {
        Alert.alert('Dekont', up.hata ?? 'Yüklenemedi');
        return;
      }
      const r = await TakasDekontYukle({ offerId: t.id, receiptPath: path });
      if (!r.ok) {
        Alert.alert('Dekont', r.hata);
        return;
      }
      Alert.alert('Tamam', 'Dekont yüklendi — platform onayına gönderildi.');
      await yukle();
    } finally {
      setBusyId(null);
    }
  };

  const dekontGor = async (path: string) => {
    const url = await TakasDekontUrl(path);
    if (!url) {
      Alert.alert('Dekont', 'Açılamadı');
      return;
    }
    setBuyutUri(url);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EkranBasligi
        title="Ajans coin teklifleri"
        subtitle="Kabul · ödeme formu · dekont (1 gün)"
        fallbackHref="/ajans"
      />
      <ScrollView
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: insets.bottom + 24 },
        ]}
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
          <Text style={styles.bos}>Ajansa gelen teklif yok</Text>
        ) : (
          liste.map((t) => {
            const deadline = t.receipt_deadline_at
              ? new Date(t.receipt_deadline_at)
              : null;
            const kalanSaat =
              deadline && t.status === 'pending_receipt'
                ? Math.max(
                    0,
                    Math.round((deadline.getTime() - Date.now()) / 3600000),
                  )
                : null;
            return (
              <View key={t.id} style={styles.kart}>
                <Text style={styles.baslik}>
                  {Number(t.coins).toLocaleString('tr-TR')} coin
                </Text>
                <Text style={styles.meta}>
                  {TAKAS_DURUM_ETIKET[t.status] ?? t.status}
                </Text>
                {t.payment_source ? (
                  <Text style={styles.meta}>
                    Satın alınan: {t.payment_coins_bought ?? '—'} · Kaynak:{' '}
                    {t.payment_source}
                  </Text>
                ) : null}
                {kalanSaat != null ? (
                  <Text style={[styles.meta, { color: RenkTokenlari.accent }]}>
                    Dekont için kalan ~{kalanSaat} saat
                  </Text>
                ) : null}
                {t.status === 'receipt_overdue' ? (
                  <Text style={[styles.meta, { color: RenkTokenlari.danger }]}>
                    Ciddi uyarı: dekont süresi aşıldı — kapatılma riski. Hemen
                    dekont yükleyin.
                  </Text>
                ) : null}

                {t.status === 'pending_buyer' ? (
                  <View style={styles.aksiyon}>
                    <Pressable
                      disabled={busyId === t.id}
                      onPress={() => yanitla(t, true)}
                    >
                      <Text style={[styles.link, { color: RenkTokenlari.mint }]}>
                        Kabul
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === t.id}
                      onPress={() => yanitla(t, false)}
                    >
                      <Text
                        style={[styles.link, { color: RenkTokenlari.danger }]}
                      >
                        Red
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {t.status === 'pending_payment_info' ? (
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      setFormTeklif(t);
                      setSatinAlinan(String(t.coins));
                      setOdemeKaynak(t.payment_source ?? '');
                    }}
                  >
                    <Text style={styles.btnYazi}>Ödeme formunu doldur</Text>
                  </Pressable>
                ) : null}

                {t.status === 'pending_receipt' ||
                t.status === 'receipt_overdue' ? (
                  <Pressable
                    style={styles.btn}
                    disabled={busyId === t.id}
                    onPress={() => void dekontYukle(t)}
                  >
                    <Text style={styles.btnYazi}>Dekont yükle</Text>
                  </Pressable>
                ) : null}

                {t.receipt_path ? (
                  <Pressable onPress={() => void dekontGor(t.receipt_path!)}>
                    <Text style={styles.link}>Dekontu gör</Text>
                  </Pressable>
                ) : null}

                <Text style={styles.tarih}>
                  {new Date(t.created_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!formTeklif} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalKart}>
            <Text style={styles.baslik}>Ödeme bilgisi</Text>
            <Text style={styles.meta}>
              Teklif: {Number(formTeklif?.coins ?? 0).toLocaleString('tr-TR')}{' '}
              coin
            </Text>
            <TextInput
              style={styles.input}
              value={satinAlinan}
              onChangeText={setSatinAlinan}
              keyboardType="number-pad"
              placeholder="Kaç coin satın aldınız?"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={odemeKaynak}
              onChangeText={setOdemeKaynak}
              multiline
              placeholder="Parayı nereden göndereceksiniz? (banka / hesap / yöntem)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.uyari}>
              Formdan sonra 1 gün içinde dekont yüklemelisiniz. Yoksa ajansa
              ciddi uyarı gider ve işlem admin paneline düşer.
            </Text>
            <Pressable style={styles.btn} onPress={() => void odemeKaydet()}>
              <Text style={styles.btnYazi}>Kaydet · 1 gün dekont süresi başlar</Text>
            </Pressable>
            <Pressable onPress={() => setFormTeklif(null)}>
              <Text style={[styles.link, { textAlign: 'center', marginTop: 8 }]}>
                Vazgeç
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ProfilMedyaBuyutucu
        uri={buyutUri}
        onKapat={() => setBuyutUri(null)}
        tur="cover"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: BoslukTokenlari.lg, gap: 12 },
  bos: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  kart: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  tarih: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  aksiyon: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  btn: {
    marginTop: 8,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnYazi: { ...TipografiTokenlari.caption, color: '#fff', fontWeight: '800' },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKart: {
    backgroundColor: RenkTokenlari.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 10,
  },
  input: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: RenkTokenlari.text,
  },
  uyari: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    lineHeight: 18,
  },
});
