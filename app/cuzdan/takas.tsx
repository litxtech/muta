import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import {
  KlavyeFocusKaydir,
  KlavyeRefIleKaydir,
  KlavyeScrollView,
  type KlavyeScrollHandle,
} from '../../src/bilesenler/klavye/KlavyeScrollView';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { OzellikBayragiAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/OzellikBayragiAktifMiSunucu';
import { CuzdanHesabiGarantile } from '../../src/moduller/cuzdan/takas/CuzdanHesabi';
import {
  CuzdanNoIleAliciGetir,
  CuzdanNoIleTransfer,
  CuzdanNoQrdenCoz,
  AjansNoQrdenCoz,
  TakasAjansAra,
  TakasKullaniciAra,
  TakasKullaniciGorunenAd,
  TakasTeklifOlustur,
  TakasTekliflerimiGetir,
  TakasAliciYanit,
  type TakasAjansSatir,
  type TakasKullaniciSatir,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasIslemleri';
import {
  CuzdanAdSoyadMaskele,
  CuzdanKartiniWhatsAppPaylas,
} from '../../src/moduller/cuzdan/islemler/CuzdanKartPaylasimi';
import { CuzdanQrKarti } from '../../src/moduller/cuzdan/bilesenler/CuzdanQrKarti';
import {
  CUZDAN_MARKA_ADI,
  TAKAS_DURUM_ETIKET,
} from '../../src/moduller/cuzdan/takas/CuzdanTakasTipleri';
import {
  TAKAS_IADE_UYARISI,
  TAKAS_ODEME_BILGISI,
} from '../../src/moduller/cuzdan/takas/TakasOdemeBilgisi';
import { TeklifMesajiOlustur } from '../../src/moduller/cuzdan/takas/TeklifMesaji';
import { CoinDegerOzetiPaneli } from '../../src/moduller/cuzdan/bilesenler/CoinDegerOzetiPaneli';
import { useCuzdanUiConfig } from '../../src/moduller/cuzdan/ui-config/useCuzdanUiConfig';
import { TakasProfilKarti } from '../../src/moduller/cuzdan/bilesenler/TakasProfilKarti';
import {
  CoinDegerOzeti,
  TryYazi,
} from '../../src/moduller/cuzdan/katalog/CoinTakasPaylasimi';
import {
  AjansSohbetAcVeyaGetir,
  MesajGonder,
  OzelSohbetAcVeyaGetir,
} from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { TakasMahkemeKur } from '../../src/moduller/cuzdan/takas/TakasMahkemeIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Mod = 'menu' | 'transfer' | 'ajans' | 'kullanici' | 'teklifler';

type PeerOzet = {
  id: string;
  ad: string;
  avatar: string | null;
};

function formatCuzdanNo(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 18);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export default function CuzdanTakasEkrani() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sekme?: string }>();
  const insets = useSafeAreaInsets();
  const { wallet, refreshWallet, adjustWallet, user } = useAuth();
  const { config: cuzdanUi } = useCuzdanUiConfig();
  const [camIzin, camIzinIste] = useCameraPermissions();
  const [mod, setMod] = useState<Mod>('menu');
  const [kyc, setKyc] = useState<string>('none');
  const [walletNo, setWalletNo] = useState('');
  const [bayrakKontrol, setBayrakKontrol] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void OzellikBayragiAktifMiSunucu('wallet_exchange_enabled').then((acik) => {
        if (!alive) return;
        if (!acik) {
          Alert.alert('Takas kapalı', 'Bu özellik şu an kullanılamıyor.');
          router.replace('/(tabs)/wallet' as any);
          return;
        }
        setBayrakKontrol(false);
      });
      return () => {
        alive = false;
      };
    }, [router]),
  );

  const [tNo, setTNo] = useState('');
  const [tAd, setTAd] = useState('');
  const [tSoyad, setTSoyad] = useState('');
  const [tCoin, setTCoin] = useState('');
  const [aliciDurum, setAliciDurum] = useState<string | null>(null);
  const [taramaAcik, setTaramaAcik] = useState(false);
  const taramaKilit = useRef(false);
  const aliciIstek = useRef(0);

  const [q, setQ] = useState('');
  const [ajanslar, setAjanslar] = useState<TakasAjansSatir[]>([]);
  const [kullanicilar, setKullanicilar] = useState<TakasKullaniciSatir[]>([]);
  const [seciliIds, setSeciliIds] = useState<string[]>([]);
  const [teklifCoin, setTeklifCoin] = useState('');
  const [teklifler, setTeklifler] = useState<
    Awaited<ReturnType<typeof TakasTekliflerimiGetir>>
  >([]);
  const [peerMap, setPeerMap] = useState<Record<string, PeerOzet>>({});
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<KlavyeScrollHandle>(null);
  const tCoinRef = useRef<TextInput>(null);
  const teklifCoinRef = useRef<TextInput>(null);

  const klavyeKaydir = useCallback(
    (e?: Parameters<typeof KlavyeFocusKaydir>[1]) => {
      KlavyeFocusKaydir(scrollRef.current, e, { ustBosluk: 48 });
    },
    [],
  );

  const coinAlaniKaydir = useCallback((hangi: 'transfer' | 'teklif') => {
    KlavyeRefIleKaydir(
      scrollRef.current,
      hangi === 'transfer' ? tCoinRef : teklifCoinRef,
      { ustBosluk: 64, delayMs: 80 },
    );
  }, []);

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

  const mahkemeKurGonder = useCallback(
    async (offerId: string, reason: string) => {
      const gerekce = reason.trim();
      if (gerekce.length < 10) {
        Alert.alert(
          'Mahkeme',
          'Anlaşmazlık gerekçesi en az 10 karakter olmalı.',
        );
        return;
      }
      setBusy(true);
      const r = await TakasMahkemeKur({ offerId, reason: gerekce });
      setBusy(false);
      if (!r.ok) {
        Alert.alert('Mahkeme', r.hata);
        return;
      }
      Alert.alert(
        r.already ? 'Mahkeme zaten açık' : 'Mahkeme kuruldu',
        'Satıcı, alıcı ve platform yargıcı aynı gruba alındı. Satış detayı otomatik eklendi.',
        [
          {
            text: 'Gruba git',
            onPress: () => router.push(`/mesaj/${r.threadId}` as any),
          },
          { text: 'Tamam' },
        ],
      );
    },
    [router],
  );

  const secimToggle = useCallback((id: string) => {
    setSeciliIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const sohbetAc = useCallback(
    async (
      otherUserId: string,
      ilkMesaj?: string,
      sohbeteGit = true,
      agencyId?: string | null,
    ) => {
      if (!otherUserId && !agencyId) return;
      const ac = agencyId
        ? await AjansSohbetAcVeyaGetir(agencyId)
        : await OzelSohbetAcVeyaGetir(otherUserId);
      if (!ac.ok) {
        Alert.alert('Mesaj', ac.hata);
        return;
      }
      if (ilkMesaj?.trim()) {
        await MesajGonder({ threadId: ac.threadId, body: ilkMesaj.trim() });
      }
      if (sohbeteGit) {
        router.push(`/mesaj/${ac.threadId}` as any);
      }
    },
    [router],
  );

  const teklifleriAc = useCallback(async () => {
    const list = await TakasTekliflerimiGetir();
    setTeklifler(list);
    setMod('teklifler');

    const userIds = new Set<string>();
    const agencyIds = new Set<string>();
    for (const t of list) {
      if (t.seller_id) userIds.add(t.seller_id);
      if (t.buyer_user_id) userIds.add(t.buyer_user_id);
      if (t.buyer_agency_id) agencyIds.add(t.buyer_agency_id);
    }
    const next: Record<string, PeerOzet> = {};
    const uidList = [...userIds];
    if (uidList.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', uidList);
      for (const p of data ?? []) {
        next[p.id] = {
          id: p.id,
          ad: (p.display_name ?? p.username ?? 'Kullanıcı') as string,
          avatar: (p.avatar_url as string | null) ?? null,
        };
      }
    }
    const aidList = [...agencyIds];
    if (aidList.length) {
      const { data } = await supabase
        .from('agencies')
        .select('id, name, logo_url, owner_id')
        .in('id', aidList);
      for (const a of data ?? []) {
        next[`agency:${a.id}`] = {
          id: (a.owner_id as string) || a.id,
          ad: (a.name as string) || 'Ajans',
          avatar: (a.logo_url as string | null) ?? null,
        };
      }
    }
    setPeerMap(next);
  }, []);

  useEffect(() => {
    const sekme = String(params.sekme ?? '');
    if (sekme === 'teklifler') {
      void teklifleriAc();
    }
  }, [params.sekme, teklifleriAc]);

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
    const maskeli = CuzdanAdSoyadMaskele(r.firstName, r.lastName);
    const ozet = `${maskeli} · KYC onaylı`;
    setAliciDurum(ozet);
    if (kaynaktan === 'qr') {
      Alert.alert(
        'QR okundu',
        `Cüzdan: ${formatCuzdanNo(digits)}\n${maskeli}`,
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
    if (!seciliIds.length || !coins) {
      Alert.alert('Eksik', 'En az bir alıcı ve coin miktarı seç.');
      return;
    }
    const mesaj = TeklifMesajiOlustur(coins);
    const ozet = CoinDegerOzeti(coins);
    const seciliAdlar =
      tip === 'agency'
        ? ajanslar
            .filter((a) => seciliIds.includes(a.id))
            .map((a) => a.name)
            .join(', ')
        : kullanicilar
            .filter((k) => seciliIds.includes(k.id))
            .map((k) => TakasKullaniciGorunenAd(k))
            .join(', ');

    Alert.alert(
      'Anlaşma özeti',
      `${seciliIds.length} alıcı: ${seciliAdlar}\n\n${mesaj}\n\nKatalog: ${TryYazi(ozet.katalogTl)}\nSize kalan (tahmini): ${TryYazi(ozet.saticiNetTl)}\n\n${TAKAS_IADE_UYARISI}`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Teklif gönder',
          onPress: () => {
            void (async () => {
              setBusy(true);
              let okSay = 0;
              const hatalar: string[] = [];
              let sonThreadAgency: string | null = null;
              let sonThreadUser: string | null = null;
              for (const id of seciliIds) {
                const r = await TakasTeklifOlustur({
                  buyerType: tip,
                  buyerUserId: tip === 'user' ? id : null,
                  buyerAgencyId: tip === 'agency' ? id : null,
                  coins,
                  note: mesaj,
                });
                if (!r.ok) {
                  hatalar.push(r.hata);
                  continue;
                }
                okSay += 1;
                if (tip === 'user') {
                  await sohbetAc(id, mesaj, false);
                  sonThreadUser = id;
                } else {
                  await sohbetAc('', mesaj, false, id);
                  sonThreadAgency = id;
                }
              }
              setBusy(false);
              void refreshWallet();
              if (okSay === 0) {
                Alert.alert('Teklif', hatalar[0] ?? 'Gönderilemedi');
                return;
              }
              Alert.alert(
                'Teklif gönderildi',
                `${okSay} teklif iletildi.${hatalar.length ? ` ${hatalar.length} hata.` : ''} Onay/red Teklifler sekmesinden yapılır.`,
                [
                  {
                    text: 'Sohbete git',
                    onPress: () => {
                      if (sonThreadAgency) {
                        void sohbetAc('', undefined, true, sonThreadAgency);
                      } else if (sonThreadUser) {
                        void sohbetAc(sonThreadUser, undefined, true);
                      }
                    },
                  },
                  {
                    text: 'Tekliflerim',
                    onPress: () => void teklifleriAc(),
                  },
                  {
                    text: 'Tamam',
                    onPress: () => {
                      setSeciliIds([]);
                      setMod('menu');
                    },
                  },
                ],
              );
            })();
          },
        },
      ],
    );
  };

  if (bayrakKontrol) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <EkranBasligi title="Coin takas" subtitle="Kontrol ediliyor…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EkranBasligi
        title="Coin takas"
        subtitle={`${cuzdanUi.brand?.name || CUZDAN_MARKA_ADI} · hesap · transfer`}
      />
      <KlavyeScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.pad,
          { paddingBottom: insets.bottom + 48 },
        ]}
        ekstraPad={72}
      >
        <View style={styles.kart}>
          <Text style={styles.marka}>
            {cuzdanUi.brand?.name || CUZDAN_MARKA_ADI}
          </Text>
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
          {(wallet?.coins ?? 0) > 0 ? (
            <View style={{ marginTop: 10 }}>
              <CoinDegerOzetiPaneli
                coins={wallet?.coins ?? 0}
                kompakt
                ozet={cuzdanUi.value_summary}
              />
            </View>
          ) : null}
          {walletNo.replace(/\D/g, '').length === 18 ? (
            <CuzdanQrKarti
              walletNumber={walletNo}
              marka={CUZDAN_MARKA_ADI}
              onKameraOku={() => void kameraAc()}
              onWhatsAppPaylas={() => {
                void (async () => {
                  const r = await CuzdanKartiniWhatsAppPaylas(walletNo);
                  if (!r.ok) Alert.alert('WhatsApp', r.hata);
                })();
              }}
            />
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
            <Text style={styles.odemeNot}>{TAKAS_ODEME_BILGISI}</Text>
            <Text style={styles.iadeNot}>{TAKAS_IADE_UYARISI}</Text>
            <Pressable style={styles.btn} onPress={() => void kameraAc()}>
              <Text style={styles.btnYazi}>QR oku (kamera)</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setMod('transfer')}>
              <Text style={styles.btnYazi}>Cüzdan no ile transfer</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setSeciliIds([]);
                setMod('ajans');
                void araAjans('');
              }}
            >
              <Text style={styles.btnYazi}>Ajansa teklif gönder</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setSeciliIds([]);
                setMod('kullanici');
              }}
            >
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
                onFocus={klavyeKaydir}
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
              value={tAd ? `${tAd.charAt(0).toLocaleUpperCase('tr-TR')}.` : ''}
              editable={false}
              placeholder="Alıcı adı (gizli)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              style={[styles.input, styles.readonly]}
              value={
                tSoyad ? `${tSoyad.charAt(0).toLocaleUpperCase('tr-TR')}.` : ''
              }
              editable={false}
              placeholder="Alıcı soyadı (gizli)"
              placeholderTextColor={RenkTokenlari.textDim}
            />
            <TextInput
              ref={tCoinRef}
              style={styles.input}
              value={tCoin}
              onChangeText={setTCoin}
              keyboardType="number-pad"
              placeholder="Coin miktarı"
              placeholderTextColor={RenkTokenlari.textDim}
              onFocus={() => coinAlaniKaydir('transfer')}
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
              onFocus={klavyeKaydir}
            />
            {mod === 'ajans'
              ? ajanslar.map((item) => (
                  <TakasProfilKarti
                    key={item.id}
                    baslik={item.name}
                    altYazi={item.agency_public_id ?? item.id.slice(0, 8)}
                    avatarUrl={item.logo_url}
                    secili={seciliIds.includes(item.id)}
                    onPress={() => secimToggle(item.id)}
                    onProfil={() =>
                      router.push(`/ajans/profil/${item.id}` as any)
                    }
                    onMesaj={() =>
                      void sohbetAc('', undefined, true, item.id)
                    }
                  />
                ))
              : kullanicilar.map((item) => (
                  <TakasProfilKarti
                    key={item.id}
                    baslik={TakasKullaniciGorunenAd(item)}
                    altYazi={
                      item.wallet_number
                        ? item.wallet_number.replace(
                            /(\d{4})(?=\d)/g,
                            '$1 ',
                          )
                        : item.username
                    }
                    avatarUrl={item.avatar_url}
                    secili={seciliIds.includes(item.id)}
                    onPress={() => secimToggle(item.id)}
                    onProfil={() =>
                      router.push(`/kullanici/${item.id}` as any)
                    }
                    onMesaj={() => void sohbetAc(item.id, undefined, true)}
                  />
                ))}
            {seciliIds.length > 0 ? (
              <Text style={styles.meta}>
                {seciliIds.length} seçili · yeşil tik = teklif alıcısı
              </Text>
            ) : (
              <Text style={styles.meta}>
                Birden fazla ajans / kullanıcı seçebilirsin
              </Text>
            )}
            <TextInput
              ref={teklifCoinRef}
              style={styles.input}
              value={teklifCoin}
              onChangeText={setTeklifCoin}
              keyboardType="number-pad"
              placeholder="Teklif coin miktarı"
              placeholderTextColor={RenkTokenlari.textDim}
              onFocus={() => coinAlaniKaydir('teklif')}
            />
            {Math.floor(Number(teklifCoin)) > 0 ? (
              <>
                <CoinDegerOzetiPaneli
                  coins={Math.floor(Number(teklifCoin))}
                  iadeUyari
                  iadeMetin={TAKAS_IADE_UYARISI}
                  ozet={cuzdanUi.value_summary}
                />
                <Text style={styles.teklifOnizleme}>
                  {TeklifMesajiOlustur(Math.floor(Number(teklifCoin)))}
                </Text>
              </>
            ) : null}
            <Pressable
              style={[styles.btn, busy && { opacity: 0.5 }]}
              disabled={busy}
              onPress={() =>
                void teklifGonder(mod === 'ajans' ? 'agency' : 'user')
              }
            >
              <Text style={styles.btnYazi}>
                Teklif gönder
                {seciliIds.length > 1 ? ` (${seciliIds.length})` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}

        {mod === 'teklifler' ? (
          <View style={styles.form}>
            <Text style={styles.bolum}>Gelen / giden teklifler</Text>
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
                const benAliciyim =
                  t.buyer_user_id === user?.id && t.seller_id !== user?.id;
                const aliciBekliyor =
                  t.status === 'pending_buyer' &&
                  (benAliciyim ||
                    (t.buyer_type === 'agency' && t.seller_id !== user?.id));
                const net =
                  t.satici_net_tl != null
                    ? Number(t.satici_net_tl)
                    : CoinDegerOzeti(t.coins).saticiNetTl;
                const benSaticiyim = t.seller_id === user?.id;
                const peer = benSaticiyim
                  ? t.buyer_type === 'agency' && t.buyer_agency_id
                    ? peerMap[`agency:${t.buyer_agency_id}`]
                    : t.buyer_user_id
                      ? peerMap[t.buyer_user_id]
                      : undefined
                  : peerMap[t.seller_id];
                const teklifMetni =
                  t.note?.trim() || TeklifMesajiOlustur(t.coins);
                const mesajUserId = benSaticiyim
                  ? t.buyer_type === 'agency'
                    ? peer?.id
                    : t.buyer_user_id
                  : t.seller_id;
                const mesajAgencyId =
                  benSaticiyim && t.buyer_type === 'agency'
                    ? t.buyer_agency_id
                    : null;
                const ajansMesajAc = () => {
                  if (mesajAgencyId) {
                    void sohbetAc('', undefined, true, mesajAgencyId);
                  } else if (mesajUserId) {
                    void sohbetAc(mesajUserId, undefined, true);
                  }
                };
                const profilYolu = benSaticiyim
                  ? t.buyer_type === 'agency' && t.buyer_agency_id
                    ? `/ajans/profil/${t.buyer_agency_id}`
                    : t.buyer_user_id
                      ? `/kullanici/${t.buyer_user_id}`
                      : null
                  : `/kullanici/${t.seller_id}`;

                const mahkemeAcilabilir =
                  t.status !== 'cancelled' &&
                  t.status !== 'rejected' &&
                  t.status !== 'expired';

                const mahkemeKur = () => {
                  Alert.alert(
                    'Mahkeme kur',
                    'Satıcı, alıcı ve platform yargıcı aynı gruba alınır. Tüm satış detayı otomatik eklenir. Usulsüzlük / dolandırıcılık için savunma buradan alınır.',
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      {
                        text: 'Kur',
                        onPress: () =>
                          void mahkemeKurGonder(
                            t.id,
                            'Takas anlaşmazlığı: usulsüzlük / dolandırıcılık şüphesi — platform incelemesi talep ediyorum.',
                          ),
                      },
                    ],
                  );
                };

                return (
                  <View key={t.id} style={styles.listeSatir}>
                    {peer ? (
                      <TakasProfilKarti
                        baslik={peer.ad}
                        altYazi={
                          benSaticiyim && t.buyer_type === 'agency'
                            ? 'Ajans'
                            : 'Kullanıcı'
                        }
                        avatarUrl={peer.avatar}
                        onPress={() => {
                          if (profilYolu) router.push(profilYolu as any);
                        }}
                        onMesaj={
                          mesajAgencyId || mesajUserId
                            ? () => ajansMesajAc()
                            : undefined
                        }
                      />
                    ) : null}
                    <Text style={styles.listeYazi}>
                      {t.coins.toLocaleString('tr-TR')} coin ·{' '}
                      {TAKAS_DURUM_ETIKET[t.status] ?? t.status}
                      {t.buyer_type === 'agency' ? ' · ajans' : ' · kullanıcı'}
                    </Text>
                    <Text style={styles.teklifOnizleme}>{teklifMetni}</Text>
                    <Text style={styles.meta}>
                      Anlaşma tutarı (tahmini): {TryYazi(net)}
                    </Text>
                    {aliciBekliyor ? (
                      <View style={styles.yanitSatir}>
                        <Pressable
                          onPress={async () => {
                            const r = await TakasAliciYanit(t.id, true);
                            if (!r.ok) {
                              Alert.alert('Hata', r.hata);
                              return;
                            }
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
                            } else if (t.seller_id) {
                              Alert.alert(
                                'Kabul edildi',
                                'İşlemler için sohbet açılıyor.',
                                [
                                  {
                                    text: 'Mesaja git',
                                    onPress: () =>
                                      void sohbetAc(
                                        t.seller_id,
                                        'Teklifi kabul ettim — işlemleri başlatalım.',
                                        true,
                                      ),
                                  },
                                  { text: 'Tamam' },
                                ],
                              );
                            }
                            void teklifleriAc();
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
                        {mesajAgencyId || mesajUserId ? (
                          <Pressable onPress={ajansMesajAc}>
                            <Text style={styles.linkYazi}>Mesaj</Text>
                          </Pressable>
                        ) : null}
                        {mahkemeAcilabilir ? (
                          <Pressable onPress={mahkemeKur}>
                            <Text
                              style={[
                                styles.linkYazi,
                                { color: '#4DA3FF' },
                              ]}
                            >
                              Mahkeme kur
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.yanitSatir}>
                        {mesajAgencyId || mesajUserId ? (
                          <Pressable onPress={ajansMesajAc}>
                            <Text style={styles.linkYazi}>Mesajlaş</Text>
                          </Pressable>
                        ) : null}
                        {mahkemeAcilabilir ? (
                          <Pressable onPress={mahkemeKur}>
                            <Text
                              style={[
                                styles.linkYazi,
                                { color: '#4DA3FF' },
                              ]}
                            >
                              Mahkeme kur
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })
            )}
            <Pressable onPress={() => setMod('menu')}>
              <Text style={styles.geri}>← Geri</Text>
            </Pressable>
          </View>
        ) : null}
      </KlavyeScrollView>

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
            <View pointerEvents="none" style={styles.taramaOverlay}>
              <View style={styles.taramaKutu}>
                <View style={[styles.taramaKose, styles.taramaTL]} />
                <View style={[styles.taramaKose, styles.taramaTR]} />
                <View style={[styles.taramaKose, styles.taramaBL]} />
                <View style={[styles.taramaKose, styles.taramaBR]} />
              </View>
              <Text style={styles.taramaIpucu}>Kodu çerçeveye hizala</Text>
            </View>
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
  odemeNot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  iadeNot: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontSize: 11,
    lineHeight: 16,
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
  teklifOnizleme: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
    fontStyle: 'italic',
  },
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
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  taramaKamera: {
    width: '100%',
    height: '100%',
  },
  taramaOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  taramaKutu: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  taramaKose: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: RenkTokenlari.accent,
  },
  taramaTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  taramaTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  taramaBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  taramaBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  taramaIpucu: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    marginTop: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
