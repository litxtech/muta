import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { CuzdanHesabiGarantile } from '../../src/moduller/cuzdan/takas/CuzdanHesabi';
import {
  CuzdanNoIleAliciGetir,
  CuzdanNoIleTransfer,
  CuzdanNoQrdenCoz,
  CuzdanNoQrPayload,
  AjansNoQrdenCoz,
  TakasAjansAra,
  TakasKullaniciAra,
  TakasTeklifOlustur,
  TakasTekliflerimiGetir,
  TakasAliciYanit,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasIslemleri';
import {
  CUZDAN_MARKA_ADI,
  TAKAS_DURUM_ETIKET,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Mod = 'menu' | 'transfer' | 'ajans' | 'kullanici' | 'teklifler';

function formatCuzdanNo(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 18);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export default function CuzdanTakasEkrani() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wallet, refreshWallet, adjustWallet, user } = useAuth();
  const [camIzin, camIzinIste] = useCameraPermissions();
  const [mod, setMod] = useState<Mod>('menu');
  const [kyc, setKyc] = useState<string>('none');
  const [walletNo, setWalletNo] = useState('');

  const [tNo, setTNo] = useState('');
  const [tAd, setTAd] = useState('');
  const [tSoyad, setTSoyad] = useState('');
  const [tCoin, setTCoin] = useState('');
  const [aliciDurum, setAliciDurum] = useState<string | null>(null);
  const [taramaAcik, setTaramaAcik] = useState(false);
  const taramaKilit = useRef(false);
  const aliciIstek = useRef(0);

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

  const aliciDoldur = useCallback(async (no: string, kaynaktan?: 'qr' | 'yaz') => {
    const digits = no.replace(/\D/g, '');
    if (digits.length !== 18) {
      setAliciDurum(null);
      return;
    }
    const req = ++aliciIstek.current;
    setAliciDurum('Alıcı aranıyor…');
    const r = await CuzdanNoIleAliciGetir(digits);
    if (req !== aliciIstek.current) return;
    if (!r.ok) {
      setTAd('');
      setTSoyad('');
      setAliciDurum(r.hata);
      if (kaynaktan === 'qr') Alert.alert('QR', r.hata);
      return;
    }
    if (r.kycStatus !== 'approved' || !r.firstName || !r.lastName) {
      setTAd('');
      setTSoyad('');
      const msg = 'Alıcının kimlik onayı yok — transfer yapılamaz.';
      setAliciDurum(msg);
      if (kaynaktan === 'qr') Alert.alert('QR okundu', msg);
      return;
    }
    setTAd(r.firstName);
    setTSoyad(r.lastName);
    const ozet = `${r.firstName} ${r.lastName} · KYC onaylı`;
    setAliciDurum(ozet);
    if (kaynaktan === 'qr') {
      Alert.alert(
        'QR okundu',
        `Cüzdan: ${formatCuzdanNo(digits)}\n${r.firstName} ${r.lastName}`,
      );
    }
  }, []);

  const cuzdanNoYaz = useCallback(
    (text: string, kaynaktan?: 'qr' | 'yaz') => {
      const formatted = formatCuzdanNo(text);
      setTNo(formatted);
      const digits = formatted.replace(/\D/g, '');
      if (digits.length < 18) {
        setTAd('');
        setTSoyad('');
        setAliciDurum(null);
        return;
      }
      void aliciDoldur(digits, kaynaktan);
    },
    [aliciDoldur],
  );

  const kameraAc = async () => {
    if (!camIzin?.granted) {
      const n = await camIzinIste();
      if (!n.granted) {
        Alert.alert('Kamera', 'QR okumak için kamera izni gerekli.');
        return;
      }
    }
    taramaKilit.current = false;
    setTaramaAcik(true);
  };

  const cuzdanNoKopyala = async () => {
    if (!walletNo || walletNo.replace(/\D/g, '').length !== 18) {
      Alert.alert('Cüzdan', 'Numara henüz hazır değil.');
      return;
    }
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(walletNo.replace(/\D/g, ''));
      Alert.alert('Kopyalandı', formatCuzdanNo(walletNo));
    } catch {
      Alert.alert('Kopyala', 'Panoya yazılamadı.');
    }
  };

  const panodanYapistir = async () => {
    try {
      const Clipboard = await import('expo-clipboard');
      const raw = await Clipboard.getStringAsync();
      const no = CuzdanNoQrdenCoz(raw ?? '') ?? raw?.replace(/\D/g, '') ?? '';
      if (no.replace(/\D/g, '').length !== 18) {
        Alert.alert('Yapıştır', 'Panoda 18 haneli cüzdan no yok.');
        return;
      }
      setMod('transfer');
      cuzdanNoYaz(no, 'yaz');
    } catch {
      Alert.alert('Yapıştır', 'Pano okunamadı.');
    }
  };

  const qrOkundu = useCallback(
    ({ data }: { data: string }) => {
      if (taramaKilit.current) return;
      const ajans = AjansNoQrdenCoz(data);
      if (ajans) {
        taramaKilit.current = true;
        setTaramaAcik(false);
        setMod('ajans');
        setQ(ajans);
        void TakasAjansAra(ajans).then(setAjanslar);
        Alert.alert('QR okundu', `Ajans no: ${ajans}`);
        return;
      }
      const no = CuzdanNoQrdenCoz(data);
      if (!no) return;
      taramaKilit.current = true;
      setTaramaAcik(false);
      setMod('transfer');
      cuzdanNoYaz(no, 'qr');
    },
    [cuzdanNoYaz],
  );

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
    if (tNo.replace(/\D/g, '').length !== 18) {
      Alert.alert('Cüzdan', '18 haneli cüzdan no gerekli.');
      return;
    }
    if (!tAd.trim() || !tSoyad.trim()) {
      Alert.alert('Alıcı', 'Ad soyad otomatik dolmadı — noyu kontrol et.');
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
    void refreshWallet();
    Alert.alert(
      'Teklif gönderildi',
      'Coin bakiyeniz şimdilik düşmez. Alıcı onayladığında coinler geçici olarak kilitlenir; işlem tamamlanınca karşı tarafa geçer.',
    );
    setMod('menu');
  };

  const teklifleriAc = async () => {
    setTeklifler(await TakasTekliflerimiGetir());
    setMod('teklifler');
  };

  const qrUri = walletNo
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(CuzdanNoQrPayload(walletNo))}`
    : null;

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
          <View style={styles.noSatirKart}>
            <Text style={styles.no} numberOfLines={1}>
              {walletNo
                ? walletNo.replace(/(\d{4})(?=\d)/g, '$1 ')
                : 'Cüzdan no yükleniyor…'}
            </Text>
            {walletNo.replace(/\D/g, '').length === 18 ? (
              <Pressable
                style={styles.ikonBtn}
                onPress={() => void cuzdanNoKopyala()}
                hitSlop={8}
                accessibilityLabel="Cüzdan no kopyala"
              >
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color={RenkTokenlari.accent}
                />
              </Pressable>
            ) : null}
            <Pressable
              style={styles.ikonBtn}
              onPress={() => void kameraAc()}
              hitSlop={8}
              accessibilityLabel="QR oku"
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={RenkTokenlari.accent}
              />
            </Pressable>
          </View>
          <Text style={styles.meta}>
            Bakiye {(wallet?.coins ?? 0).toLocaleString('tr-TR')} coin · KYC:{' '}
            {kyc === 'approved'
              ? 'Onaylı'
              : kyc === 'pending'
                ? 'İncelemede'
                : 'Yok'}
          </Text>
          {qrUri ? (
            <View style={styles.qrBlok}>
              <Image source={{ uri: qrUri }} style={styles.qr} />
              <Text style={styles.meta}>
                Karşı taraf bu QR’ı kamerayla okusun · sen de kamera ile oku
              </Text>
            </View>
          ) : null}
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
            <Pressable style={styles.btn} onPress={() => void kameraAc()}>
              <Text style={styles.btnYazi}>QR oku (kamera)</Text>
            </Pressable>
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
            <Pressable
              style={styles.btnIkincil}
              onPress={() => void teklifleriAc()}
            >
              <Text style={styles.btnIkincilYazi}>Tekliflerim</Text>
            </Pressable>
          </>
        ) : null}

        {mod === 'transfer' ? (
          <View style={styles.form}>
            <Text style={styles.bolum}>18 haneli cüzdan no</Text>
            <View style={styles.noSatir}>
              <TextInput
                style={[styles.input, styles.noInput]}
                value={tNo}
                onChangeText={(t) => cuzdanNoYaz(t)}
                keyboardType="number-pad"
                maxLength={22}
                placeholder="XXXX XXXX XXXX XXXX XX"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <Pressable
                style={styles.kameraBtn}
                onPress={() => void panodanYapistir()}
                accessibilityLabel="Panodan yapıştır"
              >
                <Ionicons name="clipboard-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.kameraBtn}
                onPress={() => void kameraAc()}
                accessibilityLabel="QR oku"
              >
                <Ionicons name="camera-outline" size={22} color="#fff" />
              </Pressable>
            </View>
            {aliciDurum ? (
              <Text style={styles.aliciDurum}>{aliciDurum}</Text>
            ) : null}
            <TextInput
              style={[styles.input, styles.readonly]}
              value={tAd}
              editable={false}
              placeholder="Alıcı adı (otomatik)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={[styles.input, styles.readonly]}
              value={tSoyad}
              editable={false}
              placeholder="Alıcı soyadı (otomatik)"
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
              No yazılınca veya QR okutulunca ad soyad otomatik dolar. Eşleşmezse
              transfer iptal edilir.
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
            <Pressable
              style={styles.btnIkincil}
              onPress={() => router.push('/ajans/teklifler' as any)}
            >
              <Text style={styles.btnIkincilYazi}>Ajans teklif paneli →</Text>
            </Pressable>
            {teklifler.length === 0 ? (
              <Text style={styles.meta}>Teklif yok</Text>
            ) : (
              teklifler.map((t) => {
                const aliciBekliyor =
                  t.status === 'pending_buyer' &&
                  t.seller_id !== user?.id &&
                  (t.buyer_user_id === user?.id || t.buyer_type === 'agency');
                return (
                  <View key={t.id} style={styles.listeSatir}>
                    <Text style={styles.listeYazi}>
                      {t.coins.toLocaleString('tr-TR')} coin ·{' '}
                      {TAKAS_DURUM_ETIKET[t.status] ?? t.status}
                      {t.buyer_type === 'agency' ? ' · ajans' : ' · kullanıcı'}
                    </Text>
                    {aliciBekliyor ? (
                      <View style={styles.yanitSatir}>
                        <Pressable
                          onPress={async () => {
                            const r = await TakasAliciYanit(t.id, true);
                            if (!r.ok) Alert.alert('Hata', r.hata);
                            else {
                              if (t.buyer_type === 'agency') {
                                Alert.alert(
                                  'Kabul edildi',
                                  'Ödeme formunu ajans teklif panelinden doldurun.',
                                  [
                                    {
                                      text: 'Panele git',
                                      onPress: () =>
                                        router.push('/ajans/teklifler' as any),
                                    },
                                    { text: 'Tamam' },
                                  ],
                                );
                              }
                              void teklifleriAc();
                            }
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
                          <Text
                            style={[
                              styles.linkYazi,
                              { color: RenkTokenlari.danger },
                            ]}
                          >
                            Red
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={taramaAcik}
        animationType="slide"
        presentationStyle="fullScreen"
        onShow={() => {
          taramaKilit.current = false;
        }}
      >
        <View style={[styles.taramaWrap, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.taramaBaslik}>QR okut — cüzdan veya ajans</Text>
          <View style={styles.taramaCam}>
            {taramaAcik ? (
              <CameraView
                key={`cam-${taramaAcik}`}
                style={styles.taramaKamera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={qrOkundu}
              />
            ) : null}
          </View>
          <Pressable
            style={styles.btnIkincil}
            onPress={() => setTaramaAcik(false)}
          >
            <Text style={styles.btnIkincilYazi}>Kapat</Text>
          </Pressable>
        </View>
      </Modal>
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
    flex: 1,
    minWidth: 0,
  },
  noSatirKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ikonBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  meta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  qrBlok: { alignItems: 'center', gap: 6, marginTop: 10 },
  qr: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
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
  noSatir: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  noInput: { flex: 1 },
  kameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  readonly: { opacity: 0.85 },
  aliciDurum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
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
  taramaWrap: {
    flex: 1,
    backgroundColor: RenkTokenlari.bg,
    padding: BoslukTokenlari.lg,
    gap: 12,
  },
  taramaBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  taramaCam: {
    width: '100%',
    height: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  taramaKamera: {
    width: '100%',
    height: '100%',
  },
});
