import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { CuzdanHesabiGarantile } from '../../src/moduller/cuzdan/takas/CuzdanHesabi';
import {
  CuzdanNoIleTransfer,
  TakasAjansAra,
  TakasKullaniciAra,
  TakasTeklifOlustur,
  TakasTekliflerimiGetir,
  TakasAliciYanit,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasIslemleri';
import { CUZDAN_MARKA_ADI } from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Mod = 'menu' | 'transfer' | 'ajans' | 'kullanici' | 'teklifler';

export default function CuzdanTakasEkrani() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wallet, refreshWallet, adjustWallet } = useAuth();
  const [mod, setMod] = useState<Mod>('menu');
  const [kyc, setKyc] = useState<string>('none');
  const [walletNo, setWalletNo] = useState('');

  const [tNo, setTNo] = useState('');
  const [tAd, setTAd] = useState('');
  const [tSoyad, setTSoyad] = useState('');
  const [tCoin, setTCoin] = useState('');

  const [q, setQ] = useState('');
  const [ajanslar, setAjanslar] = useState<
    Awaited<ReturnType<typeof TakasAjansAra>>
  >([]);
  const [kullanicilar, setKullanicilar] = useState<
    Awaited<ReturnType<typeof TakasKullaniciAra>>
  >([]);
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [teklifCoin, setTeklifCoin] = useState('');
  const [teklifler, setTeklifler] = useState<
    Awaited<ReturnType<typeof TakasTekliflerimiGetir>>
  >([]);
  const [busy, setBusy] = useState(false);

  const yenileHesap = useCallback(async () => {
    const r = await CuzdanHesabiGarantile();
    if (r.ok) {
      setWalletNo(r.hesap.wallet_number);
      setKyc(r.hesap.kyc_status);
    }
  }, []);

  useEffect(() => {
    void yenileHesap();
  }, [yenileHesap]);

  const araAjans = async (text: string) => {
    setQ(text);
    setAjanslar(await TakasAjansAra(text));
  };

  const araKullanici = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setKullanicilar([]);
      return;
    }
    setKullanicilar(await TakasKullaniciAra(text));
  };

  const transferYap = async () => {
    const coins = Math.floor(Number(tCoin));
    if (!coins || coins <= 0) {
      Alert.alert('Coin', 'Geçerli miktar gir.');
      return;
    }
    setBusy(true);
    const r = await CuzdanNoIleTransfer({
      walletNumber: tNo,
      firstName: tAd,
      lastName: tSoyad,
      coins,
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Transfer iptal', r.hata);
      return;
    }
    adjustWallet({ coins: -coins });
    void refreshWallet();
    Alert.alert('Tamam', 'Transfer gerçekleşti.');
    setMod('menu');
  };

  const teklifGonder = async (tip: 'user' | 'agency') => {
    if (kyc !== 'approved') {
      Alert.alert('KYC', 'Takas için kimlik onayı gerekli.', [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Onaya git', onPress: () => router.push('/kyc' as any) },
      ]);
      return;
    }
    const coins = Math.floor(Number(teklifCoin));
    if (!seciliId || !coins) {
      Alert.alert('Eksik', 'Alıcı ve coin miktarı seç.');
      return;
    }
    setBusy(true);
    const r = await TakasTeklifOlustur({
      buyerType: tip,
      buyerUserId: tip === 'user' ? seciliId : null,
      buyerAgencyId: tip === 'agency' ? seciliId : null,
      coins,
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Teklif', r.hata);
      return;
    }
    adjustWallet({ coins: -coins });
    void refreshWallet();
    Alert.alert(
      'Teklif gönderildi',
      'Alıcı onayından sonra platform onayı beklenir.',
    );
    setMod('menu');
  };

  const teklifleriAc = async () => {
    setTeklifler(await TakasTekliflerimiGetir());
    setMod('teklifler');
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EkranBasligi title="Coin takas" subtitle="MUTA PAY · transfer · teklif" />
      <ScrollView
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.kart}>
          <Text style={styles.marka}>{CUZDAN_MARKA_ADI}</Text>
          <Text style={styles.no}>
            {walletNo
              ? walletNo.replace(/(\d{4})(?=\d)/g, '$1 ')
              : 'Cüzdan no yükleniyor…'}
          </Text>
          <Text style={styles.meta}>
            Bakiye {(wallet?.coins ?? 0).toLocaleString('tr-TR')} coin · KYC:{' '}
            {kyc === 'approved'
              ? 'Onaylı'
              : kyc === 'pending'
                ? 'İncelemede'
                : 'Yok'}
          </Text>
          {kyc !== 'approved' ? (
            <Pressable
              style={styles.link}
              onPress={() => router.push('/kyc' as any)}
            >
              <Text style={styles.linkYazi}>Kimlik onayı yap</Text>
            </Pressable>
          ) : null}
        </View>

        {mod === 'menu' ? (
          <>
            <Pressable style={styles.btn} onPress={() => setMod('transfer')}>
              <Text style={styles.btnYazi}>Cüzdan no ile transfer</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setMod('ajans');
                void araAjans('');
              }}
            >
              <Text style={styles.btnYazi}>Ajansa teklif gönder</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setMod('kullanici')}>
              <Text style={styles.btnYazi}>Kullanıcıya teklif gönder</Text>
            </Pressable>
            <Pressable style={styles.btnIkincil} onPress={() => void teklifleriAc()}>
              <Text style={styles.btnIkincilYazi}>Tekliflerim</Text>
            </Pressable>
          </>
        ) : null}

        {mod === 'transfer' ? (
          <View style={styles.form}>
            <Text style={styles.bolum}>18 haneli cüzdan no</Text>
            <TextInput
              style={styles.input}
              value={tNo}
              onChangeText={setTNo}
              keyboardType="number-pad"
              maxLength={22}
              placeholder="XXXXXXXXXXXXXXXXXX"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={styles.input}
              value={tAd}
              onChangeText={setTAd}
              placeholder="Alıcı adı (KYC)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={styles.input}
              value={tSoyad}
              onChangeText={setTSoyad}
              placeholder="Alıcı soyadı (KYC)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={styles.input}
              value={tCoin}
              onChangeText={setTCoin}
              keyboardType="number-pad"
              placeholder="Coin miktarı"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Text style={styles.uyari}>
              İsim soyisim eşleşmezse transfer iptal edilir.
            </Text>
            <Pressable
              style={[styles.btn, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() => void transferYap()}
            >
              <Text style={styles.btnYazi}>Transfer et</Text>
            </Pressable>
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}

        {mod === 'ajans' || mod === 'kullanici' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={q}
              onChangeText={(t) =>
                void (mod === 'ajans' ? araAjans(t) : araKullanici(t))
              }
              placeholder={
                mod === 'ajans'
                  ? 'Ajans adı veya ID ara'
                  : 'Kullanıcı / cüzdan no ara'
              }
              placeholderTextColor={RenkTokenlari.textDim}
            />
            {(mod === 'ajans' ? ajanslar : kullanicilar).map((item) => {
              const id = item.id;
              const baslik =
                mod === 'ajans'
                  ? `${(item as { name: string }).name} · ${(item as { agency_public_id: string | null }).agency_public_id ?? id.slice(0, 8)}`
                  : `${(item as { display_name: string | null }).display_name ?? (item as { username: string | null }).username} · ${(item as { wallet_number: string }).wallet_number}`;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSeciliId(id)}
                  style={[
                    styles.listeSatir,
                    seciliId === id && styles.listeAktif,
                  ]}
                >
                  <Text style={styles.listeYazi} numberOfLines={2}>
                    {baslik}
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              style={styles.input}
              value={teklifCoin}
              onChangeText={setTeklifCoin}
              keyboardType="number-pad"
              placeholder="Teklif coin miktarı"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <Pressable
              style={[styles.btn, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() =>
                void teklifGonder(mod === 'ajans' ? 'agency' : 'user')
              }
            >
              <Text style={styles.btnYazi}>Teklif gönder</Text>
            </Pressable>
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}

        {mod === 'teklifler' ? (
          <View style={styles.form}>
            {teklifler.length === 0 ? (
              <Text style={styles.meta}>Teklif yok</Text>
            ) : (
              teklifler.map((t) => (
                <View key={t.id} style={styles.listeSatir}>
                  <Text style={styles.listeYazi}>
                    {t.coins.toLocaleString('tr-TR')} coin · {t.status}
                    {t.buyer_type === 'agency' ? ' · ajans' : ' · kullanıcı'}
                  </Text>
                  {t.status === 'pending_buyer' &&
                  t.buyer_user_id /* alıcı bizsek */ ? (
                    <View style={styles.yanitSatir}>
                      <Pressable
                        onPress={async () => {
                          const r = await TakasAliciYanit(t.id, true);
                          if (!r.ok) Alert.alert('Hata', r.hata);
                          else void teklifleriAc();
                        }}
                      >
                        <Text style={styles.linkYazi}>Kabul</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          const r = await TakasAliciYanit(t.id, false);
                          if (!r.ok) Alert.alert('Hata', r.hata);
                          else {
                            void refreshWallet();
                            void teklifleriAc();
                          }
                        }}
                      >
                        <Text style={[styles.linkYazi, { color: RenkTokenlari.danger }]}>
                          Red
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))
            )}
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: BoslukTokenlari.lg, gap: 12 },
  kart: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 4,
  },
  marka: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  no: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontVariant: ['tabular-nums'],
  },
  meta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  btn: {
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnYazi: { ...TipografiTokenlari.body, color: '#fff', fontWeight: '800' },
  btnIkincil: {
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  form: { gap: 10 },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
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
  },
  listeSatir: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  listeAktif: {
    borderColor: RenkTokenlari.accent,
    backgroundColor: 'rgba(240,180,41,0.12)',
  },
  listeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text },
  link: { marginTop: 6 },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  geri: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 8,
  },
  yanitSatir: { flexDirection: 'row', gap: 16 },
});
