import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  AjansCoinTransfer,
  AjansHostBasvurusunuOnayla,
  AjansHostBasvurusunuReddet,
  AjansKurallariKaydet,
  AjansOdemeMesajiOlustur,
  AjansOdemeSablonuKaydet,
  AjansPanelDetayGetir,
  AjansSil,
  AjansUyeOdaKur,
  AjansUyeOyunOzetiGetir,
  LimitKalan,
  type AjansPanelDetay,
  type AjansUyeOzet,
} from '../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import { AjansCoinYukleKarti } from '../../src/moduller/ajanslar/bilesenler/AjansCoinYukleKarti';
import {
  AjansMedyaYukle,
  AjansProfilGuncelle,
} from '../../src/moduller/ajanslar/okuma/AjansProfilGetir';
import {
  KullanicilariAra,
  type ArananKullanici,
} from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import {
  MesajGonder,
  OzelSohbetAcVeyaGetir,
} from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import {
  CoinTryKarsiligi,
  TryYazi,
} from '../../src/moduller/cuzdan/katalog/CoinTryOrani';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function sayi(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function dakikaMetni(n: number) {
  const d = Math.max(0, Math.floor(Number(n) || 0));
  if (d < 60) return `${sayi(d)} dk`;
  const saat = Math.floor(d / 60);
  const kalan = d % 60;
  return kalan ? `${sayi(saat)} sa ${kalan} dk` : `${sayi(saat)} sa`;
}

function uyeAdi(u: {
  display_name?: string | null;
  username?: string | null;
}) {
  return u.display_name || u.username || 'Kullanıcı';
}

function uuidYerel() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function LimitCubugu({
  label,
  kullanilan,
  limit,
  unlimited,
}: {
  label: string;
  kullanilan: number;
  limit: number;
  unlimited?: boolean;
}) {
  if (unlimited) {
    return (
      <View style={styles.limitKart}>
        <View style={styles.limitSatir}>
          <Text style={styles.limitLabel}>{label}</Text>
          <Text style={[styles.limitDeger, { color: RenkTokenlari.mint }]}>
            Sınırsız
          </Text>
        </View>
        <Text style={styles.limitKalan}>
          Kullanılan: {sayi(kullanilan)} (üst sınır yok)
        </Text>
      </View>
    );
  }
  const oran = limit > 0 ? Math.min(1, kullanilan / limit) : 0;
  return (
    <View style={styles.limitKart}>
      <View style={styles.limitSatir}>
        <Text style={styles.limitLabel}>{label}</Text>
        <Text style={styles.limitDeger}>
          {sayi(kullanilan)} / {sayi(limit)}
        </Text>
      </View>
      <View style={styles.cubukBg}>
        <View
          style={[
            styles.cubukDolgu,
            {
              width: `${oran * 100}%`,
              backgroundColor:
                oran > 0.85 ? RenkTokenlari.danger : RenkTokenlari.mint,
            },
          ]}
        />
      </View>
      <Text style={styles.limitKalan}>
        Kalan {sayi(LimitKalan(limit, kullanilan))}
      </Text>
    </View>
  );
}

function UyeKart({ uye }: { uye: AjansUyeOzet }) {
  return (
    <Pressable
      style={styles.uyeKart}
      onPress={() => router.push(`/kullanici/${uye.user_id}` as any)}
    >
      <View style={styles.uyeSol}>
        {uye.avatar_url ? (
          <Image source={{ uri: uye.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarBos]}>
            <Ionicons name="person" size={18} color={RenkTokenlari.textDim} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.uyeAd}>{uyeAdi(uye)}</Text>
          <Text style={styles.uyeAlt}>
            {uye.public_user_id || uye.username || '—'}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={RenkTokenlari.textDim}
        />
      </View>
      <View style={styles.statGrid}>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Ses</Text>
          <Text style={styles.statDeger}>
            {dakikaMetni(uye.ses_dakika_toplam)}
          </Text>
          <Text style={styles.statAlt}>
            Ay {dakikaMetni(uye.ses_dakika_ay)}
          </Text>
        </View>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Yayın</Text>
          <Text style={styles.statDeger}>
            {dakikaMetni(uye.yayin_dakika_toplam)}
          </Text>
          <Text style={styles.statAlt}>
            Ay {dakikaMetni(uye.yayin_dakika_ay)}
          </Text>
        </View>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Yükleme</Text>
          <Text style={styles.statDeger}>
            {sayi(uye.yukleme_coin_toplam)}
          </Text>
          <Text style={styles.statAlt}>
            Ay {sayi(uye.yukleme_coin_ay)}
          </Text>
        </View>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Kazanç</Text>
          <Text style={styles.statDeger}>
            {sayi(uye.kazanc_elmas_toplam)}
          </Text>
          <Text style={styles.statAlt}>
            Ay {sayi(uye.kazanc_elmas_ay)}
          </Text>
        </View>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Oyun +</Text>
          <Text style={styles.statDeger}>
            {sayi(uye.oyun_kazanc_coin ?? 0)}
          </Text>
          <Text style={styles.statAlt}>
            {TryYazi(CoinTryKarsiligi(uye.oyun_kazanc_coin ?? 0))}
          </Text>
        </View>
        <View style={styles.statHucre}>
          <Text style={styles.statBaslik}>Oyun −</Text>
          <Text style={styles.statDeger}>
            {sayi(uye.oyun_kayip_coin ?? 0)}
          </Text>
          <Text style={styles.statAlt}>
            Ay {sayi(uye.oyun_kayip_coin_ay ?? 0)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function AjansPanelEkrani() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user } = useAuth();
  const [detay, setDetay] = useState<AjansPanelDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [coin, setCoin] = useState('');
  const [arama, setArama] = useState('');
  const [sonuclar, setSonuclar] = useState<ArananKullanici[]>([]);
  const [secili, setSecili] = useState<ArananKullanici | null>(null);
  const [kurallar, setKurallar] = useState('');
  const [holder, setHolder] = useState('');
  const [banka, setBanka] = useState('');
  const [iban, setIban] = useState('');
  const [telefon, setTelefon] = useState('');
  const [odemeNot, setOdemeNot] = useState('');
  const [odemeArama, setOdemeArama] = useState('');
  const [odemeSonuclar, setOdemeSonuclar] = useState<ArananKullanici[]>([]);
  const [odemeSecili, setOdemeSecili] = useState<ArananKullanici | null>(null);
  const [davetArama, setDavetArama] = useState('');
  const [davetSonuclar, setDavetSonuclar] = useState<ArananKullanici[]>([]);
  const [davetSecili, setDavetSecili] = useState<ArananKullanici | null>(null);
  const [odaUyeId, setOdaUyeId] = useState<string | null>(null);
  const [odaBaslik, setOdaBaslik] = useState('');
  const [profilAd, setProfilAd] = useState('');
  const [profilSlogan, setProfilSlogan] = useState('');
  const [profilUlke, setProfilUlke] = useState('');
  const [profilAciklama, setProfilAciklama] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AjansPanelDetayGetir(id);
      try {
        const oyunlar = await AjansUyeOyunOzetiGetir(id);
        const map = new Map(oyunlar.map((o) => [o.user_id, o]));
        d.uyeler = (d.uyeler ?? []).map((u) => {
          const o = map.get(u.user_id);
          if (!o) return u;
          return {
            ...u,
            oyun_kazanc_coin: o.oyun_kazanc_coin,
            oyun_kayip_coin: o.oyun_kayip_coin,
            oyun_kazanc_coin_ay: o.oyun_kazanc_coin_ay,
            oyun_kayip_coin_ay: o.oyun_kayip_coin_ay,
          };
        });
      } catch {
        /* migration 105 yoksa sessiz */
      }
      setDetay(d);
      setKurallar(d.rules?.body ?? '');
      setHolder(d.payment_template?.account_holder ?? '');
      setBanka(d.payment_template?.bank_name ?? '');
      setIban(d.payment_template?.iban ?? '');
      setTelefon(d.payment_template?.phone ?? '');
      setOdemeNot(d.payment_template?.note ?? '');
      setProfilAd(d.agency.name ?? '');
      setProfilSlogan(d.agency.slogan ?? '');
      setProfilUlke(d.agency.country ?? '');
      setProfilAciklama(d.agency.description ?? '');
      setLogoUrl(d.agency.logo_url ?? null);
      setBannerUrl(d.agency.banner_url ?? null);
    } catch (e) {
      Alert.alert(
        'Ajans',
        e instanceof Error ? e.message : 'Panel yüklenemedi (migration 067?)',
      );
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  useEffect(() => {
    const q = arama.trim();
    if (q.length < 1) {
      setSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          setSonuclar(
            await KullanicilariAra({
              sorgu: q,
              haricUserId: user?.id,
              limit: 12,
            }),
          );
        } catch {
          setSonuclar([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [arama, user?.id]);

  useEffect(() => {
    const q = odemeArama.trim();
    if (q.length < 1) {
      setOdemeSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          setOdemeSonuclar(
            await KullanicilariAra({
              sorgu: q,
              haricUserId: user?.id,
              limit: 12,
            }),
          );
        } catch {
          setOdemeSonuclar([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [odemeArama, user?.id]);

  useEffect(() => {
    const q = davetArama.trim();
    if (q.length < 1) {
      setDavetSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          setDavetSonuclar(
            await KullanicilariAra({
              sorgu: q,
              haricUserId: user?.id,
              limit: 12,
            }),
          );
        } catch {
          setDavetSonuclar([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [davetArama, user?.id]);

  const bakiye = detay?.wallet?.distribution_balance ?? 0;
  const ciro = detay?.ciro;
  const uyeler = detay?.uyeler ?? [];
  const bekleyenHostlar = detay?.bekleyen_host_basvurulari ?? [];
  const limits = detay?.limits;
  const unlimited = Boolean(limits?.unlimited);
  // Sunucu bayrağı (094+) veya owner_id eşleşmesi — yönetim özellikleri
  const sahibi = Boolean(
    detay?.ben_sahibiyim === true ||
      (detay?.agency.owner_id &&
        user?.id &&
        String(detay.agency.owner_id).toLowerCase() ===
          String(user.id).toLowerCase()),
  );
  const davetKodu = detay?.agency.invite_code ?? '';
  const coinYetkili = Boolean(detay?.agency.is_coin_distributor);

  const hizliCoin = useMemo(() => [1000, 5000, 10000, 25000, 50000], []);

  const hizliUyeSec = (u: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  }) => {
    setSecili({
      id: u.user_id,
      display_name: u.display_name,
      username: u.username,
      avatar_url: u.avatar_url,
      public_user_id: null,
      is_verified: false,
    });
    setArama(u.display_name || u.username || '');
    setSonuclar([]);
  };

  const yukleCoin = () => {
    if (!id || !secili) {
      Alert.alert('Yükleme', 'Kullanıcı seç.');
      return;
    }
    const n = Math.floor(Number(coin));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Yükleme', 'Geçerli coin miktarı gir.');
      return;
    }
    if (!detay?.agency.is_coin_distributor) {
      Alert.alert(
        'Yetki yok',
        'Ajansın henüz coin dağıtıcı değil. Admin onayı gerekir.',
      );
      return;
    }
    Alert.alert(
      'Coin yükle',
      `${secili.display_name || secili.username} hesabına ${sayi(n)} coin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Yükle',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AjansCoinTransfer({
                agencyId: id,
                toUserId: secili.id,
                coins: n,
                idempotencyKey: uuidYerel(),
              });
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Yükleme', r.hata ?? 'Başarısız');
                return;
              }
              Alert.alert('Tamam', 'Coin yüklendi.');
              setCoin('');
              setSecili(null);
              setArama('');
              await yukle();
            })();
          },
        },
      ],
    );
  };

  const kurallariKaydet = () => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansKurallariKaydet({ agencyId: id, body: kurallar });
      setBusy(false);
      if (!r.ok) Alert.alert('Kurallar', r.hata);
      else {
        Alert.alert('Tamam', 'Kurallar kaydedildi.');
        await yukle();
      }
    })();
  };

  const odemeKaydet = () => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansOdemeSablonuKaydet({
        agencyId: id,
        accountHolder: holder,
        bankName: banka,
        iban,
        phone: telefon,
        note: odemeNot,
      });
      setBusy(false);
      if (!r.ok) Alert.alert('Ödeme bilgisi', r.hata);
      else {
        Alert.alert('Tamam', 'Ödeme şablonu kaydedildi.');
        await yukle();
      }
    })();
  };

  const odemeGonder = () => {
    if (!odemeSecili) {
      Alert.alert('Mesaj', 'Alıcı kullanıcı seç.');
      return;
    }
    const tpl = detay?.payment_template;
    if (!tpl?.iban) {
      Alert.alert('Mesaj', 'Önce ödeme şablonunu kaydet.');
      return;
    }
    const body = AjansOdemeMesajiOlustur(tpl, detay?.agency.name);
    Alert.alert(
      'Ödeme bilgisi gönder',
      `${odemeSecili.display_name || odemeSecili.username} kullanıcısına IBAN mesajı gitsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönder',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const sohbet = await OzelSohbetAcVeyaGetir(odemeSecili.id);
              if (!sohbet.ok) {
                setBusy(false);
                Alert.alert('Mesaj', sohbet.hata);
                return;
              }
              const msg = await MesajGonder({
                threadId: sohbet.threadId,
                body,
                clientId: uuidYerel(),
              });
              setBusy(false);
              if (!msg.ok) {
                Alert.alert('Mesaj', msg.hata);
                return;
              }
              Alert.alert('Gönderildi', 'Ödeme bilgisi mesaj olarak iletildi.', [
                {
                  text: 'Sohbete git',
                  onPress: () =>
                    router.push(`/mesaj/${sohbet.threadId}` as any),
                },
                { text: 'Tamam' },
              ]);
              setOdemeSecili(null);
              setOdemeArama('');
            })();
          },
        },
      ],
    );
  };

  const ajansiSil = () => {
    if (!id) return;
    Alert.alert(
      'Ajansı sil',
      'Ajans kapatılacak, coin dağıtımı duracak. Emin misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AjansSil(id);
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Silme', r.hata);
                return;
              }
              Alert.alert('Kapatıldı', 'Ajans kapatıldı.');
              router.replace('/ajans' as any);
            })();
          },
        },
      ],
    );
  };

  const davetKoduKopyala = () => {
    if (!davetKodu) {
      Alert.alert('Davet', 'Davet kodu yok.');
      return;
    }
    void (async () => {
      try {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(davetKodu);
        Alert.alert('Kopyalandı', davetKodu);
      } catch {
        Alert.alert('Davet kodu', davetKodu);
      }
    })();
  };

  const davetKoduPaylas = () => {
    if (!davetKodu) {
      Alert.alert('Davet', 'Davet kodu yok.');
      return;
    }
    const ad = detay?.agency.name ?? 'Ajans';
    void Share.share({
      message: `${ad} ajansına katıl. Davet kodu: ${davetKodu}\nUygulamada Ev sahibi paneli → Ajansa katıl.`,
    });
  };

  const davetDmGonder = () => {
    if (!davetSecili) {
      Alert.alert('Davet', 'Kullanıcı seç.');
      return;
    }
    if (!davetKodu) {
      Alert.alert('Davet', 'Davet kodu yok.');
      return;
    }
    const ad = detay?.agency.name ?? 'Ajans';
    const body = [
      `${ad} ajansına davet edildin.`,
      '',
      `Davet kodu: ${davetKodu}`,
      'Mesajdaki “Daveti kabul et” ile başvurabilirsin.',
    ].join('\n');
    Alert.alert(
      'Davet gönder',
      `${uyeAdi(davetSecili)} kullanıcısına davet mesajı gitsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönder',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const sohbet = await OzelSohbetAcVeyaGetir(davetSecili.id);
              if (!sohbet.ok) {
                setBusy(false);
                Alert.alert('Davet', sohbet.hata);
                return;
              }
              const msg = await MesajGonder({
                threadId: sohbet.threadId,
                body,
                clientId: uuidYerel(),
              });
              setBusy(false);
              if (!msg.ok) {
                Alert.alert('Davet', msg.hata);
                return;
              }
              Alert.alert('Gönderildi', 'Davet mesajı iletildi.');
              setDavetSecili(null);
              setDavetArama('');
            })();
          },
        },
      ],
    );
  };

  const hostBasvuruOnayla = (basvuruId: string, ad: string) => {
    Alert.alert('Onayla', `${ad} ajansa katılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const r = await AjansHostBasvurusunuOnayla(basvuruId);
            setBusy(false);
            if (!r.ok) {
              Alert.alert('Onay', r.hata ?? 'Başarısız');
              return;
            }
            Alert.alert('Tamam', 'Başvuru onaylandı.');
            await yukle();
          })();
        },
      },
    ]);
  };

  const hostBasvuruReddet = (basvuruId: string, ad: string) => {
    Alert.alert('Reddet', `${ad} başvurusu reddedilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const r = await AjansHostBasvurusunuReddet(basvuruId);
            setBusy(false);
            if (!r.ok) {
              Alert.alert('Red', r.hata ?? 'Başarısız');
              return;
            }
            Alert.alert('Tamam', 'Başvuru reddedildi.');
            await yukle();
          })();
        },
      },
    ]);
  };

  const uyeOdaKur = () => {
    if (!id || !odaUyeId) {
      Alert.alert('Oda', 'Üye seç.');
      return;
    }
    const baslik = odaBaslik.trim();
    if (baslik.length < 2) {
      Alert.alert('Oda', 'Başlık en az 2 karakter.');
      return;
    }
    const uye = uyeler.find((u) => u.user_id === odaUyeId);
    Alert.alert(
      'Ses odası kur',
      `${uye ? uyeAdi(uye) : 'Üye'} adına oda açılsın mı?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kur',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AjansUyeOdaKur({
                agencyId: id,
                userId: odaUyeId,
                title: baslik,
              });
              setBusy(false);
              if (!r.ok || !r.room_id) {
                Alert.alert('Oda', r.hata ?? 'Oluşturulamadı');
                return;
              }
              setOdaBaslik('');
              setOdaUyeId(null);
              Alert.alert('Oda hazır', 'Üye odasına gidebilirsin.', [
                {
                  text: 'Odaya git',
                  onPress: () => router.push(`/room/${r.room_id}` as any),
                },
                { text: 'Tamam' },
              ]);
            })();
          },
        },
      ],
    );
  };

  const profilKaydet = () => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansProfilGuncelle({
        agencyId: id,
        name: profilAd.trim(),
        slogan: profilSlogan.trim(),
        country: profilUlke.trim(),
        description: profilAciklama.trim(),
      });
      setBusy(false);
      if (!r.ok) Alert.alert('Profil', r.hata);
      else {
        Alert.alert('Tamam', 'Ajans profili güncellendi.');
        await yukle();
      }
    })();
  };

  const medyaYukle = (tur: 'logo' | 'banner') => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansMedyaYukle({ agencyId: id, tur });
      setBusy(false);
      if (!r.ok) {
        if (!r.iptal) Alert.alert('Medya', r.hata);
        return;
      }
      if (tur === 'logo') setLogoUrl(r.url);
      else setBannerUrl(r.url);
      Alert.alert('Tamam', tur === 'logo' ? 'Logo güncellendi.' : 'Banner güncellendi.');
      await yukle();
    })();
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajans-panel" varyant="ekran" fallbackHref="/ajans">
        <EkranBasligi
          title={detay?.agency.name ?? 'Ajansım'}
          subtitle="Üyeler · ciro · davet · oda"
          fallbackHref={"/ajans/yonetim" as any}
        />
        {yukleniyor && !detay ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : !detay ? (
          <Text style={styles.bos}>Ajans bulunamadı</Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor || busy}
                onRefresh={() => void yukle()}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={[...RenkTokenlari.gradientPlaceholder]}
              style={styles.hero}
            >
              <Text style={styles.heroEyebrow}>
                {detay.agency.agency_public_id} · {detay.agency.level_code} ·{' '}
                {uyeler.length} üye
              </Text>
              <Text style={styles.heroBakiye}>
                {sayi(ciro?.elmas_bakiye ?? detay.wallet?.diamonds ?? 0)}
              </Text>
              <Text style={styles.heroAlt}>Toplam ciro (elmas)</Text>
              <View style={styles.ciroSatir}>
                <View style={styles.ciroKart}>
                  <Text style={styles.ciroDeger}>
                    {sayi(ciro?.ledger_toplam ?? 0)}
                  </Text>
                  <Text style={styles.ciroLabel}>Ledger toplam</Text>
                </View>
                <View style={styles.ciroKart}>
                  <Text style={styles.ciroDeger}>
                    {sayi(ciro?.ledger_aylik ?? 0)}
                  </Text>
                  <Text style={styles.ciroLabel}>Bu ay</Text>
                </View>
                <View style={styles.ciroKart}>
                  <Text style={styles.ciroDeger}>{sayi(bakiye)}</Text>
                  <Text style={styles.ciroLabel}>Dağıtım coin</Text>
                </View>
              </View>
              <View style={styles.heroChipSatir}>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>
                    {detay.agency.is_coin_distributor
                      ? 'Coin yetkisi açık'
                      : 'Coin yetkisi kapalı'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>
                    {unlimited ? 'Sınırsız limit' : 'Limitli'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>{detay.agency.status}</Text>
                </View>
              </View>
              {davetKodu ? (
                <View style={styles.davetKodSatir}>
                  <Text style={styles.davetKod}>{davetKodu}</Text>
                  <Pressable style={styles.davetIcon} onPress={davetKoduKopyala}>
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={RenkTokenlari.primarySoft}
                    />
                  </Pressable>
                  <Pressable style={styles.davetIcon} onPress={davetKoduPaylas}>
                    <Ionicons
                      name="share-outline"
                      size={18}
                      color={RenkTokenlari.primarySoft}
                    />
                  </Pressable>
                </View>
              ) : null}
            </LinearGradient>

            {sahibi ? (
              <>
                <Pressable
                  style={styles.profilLink}
                  onPress={() => router.push(`/ajans/profil/${id}` as any)}
                >
                  <Ionicons
                    name="eye-outline"
                    size={16}
                    color={RenkTokenlari.primarySoft}
                  />
                  <Text style={styles.profilLinkYazi}>Genel profili görüntüle</Text>
                </Pressable>

                <Text style={styles.bolum}>Ajans profili</Text>
                <View style={styles.kart}>
                  {(bannerUrl || logoUrl) && (
                    <View style={styles.profilOnizleme}>
                      {bannerUrl ? (
                        <Image source={{ uri: bannerUrl }} style={styles.profilBanner} />
                      ) : (
                        <View style={[styles.profilBanner, styles.profilBannerBos]} />
                      )}
                      {logoUrl ? (
                        <Image source={{ uri: logoUrl }} style={styles.profilLogo} />
                      ) : (
                        <View style={[styles.profilLogo, styles.profilLogoBos]}>
                          <Ionicons
                            name="business"
                            size={20}
                            color={RenkTokenlari.primarySoft}
                          />
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.medyaSatir}>
                    <Pressable
                      style={styles.medyaBtn}
                      onPress={() => medyaYukle('logo')}
                      disabled={busy}
                    >
                      <Ionicons name="image-outline" size={16} color="#12040C" />
                      <Text style={styles.medyaBtnYazi}>Logo</Text>
                    </Pressable>
                    <Pressable
                      style={styles.medyaBtn}
                      onPress={() => medyaYukle('banner')}
                      disabled={busy}
                    >
                      <Ionicons name="images-outline" size={16} color="#12040C" />
                      <Text style={styles.medyaBtnYazi}>Banner</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={profilAd}
                    onChangeText={setProfilAd}
                    placeholder="Ajans adı"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={profilSlogan}
                    onChangeText={setProfilSlogan}
                    placeholder="Slogan"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={profilUlke}
                    onChangeText={setProfilUlke}
                    placeholder="Ülke / bölge"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={profilAciklama}
                    onChangeText={setProfilAciklama}
                    placeholder="Ajans açıklaması"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={[styles.input, styles.area]}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.ctaGhost, busy && styles.ctaDisabled]}
                    onPress={profilKaydet}
                    disabled={busy}
                  >
                    <Text style={styles.ctaGhostYazi}>Profili kaydet</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Coin yükleme</Text>
                <AjansCoinYukleKarti
                  yetkili={coinYetkili}
                  bakiye={bakiye}
                  busy={busy}
                  arama={arama}
                  onArama={(t) => {
                    setArama(t);
                    setSecili(null);
                  }}
                  sonuclar={sonuclar}
                  secili={secili}
                  onSec={(k) => {
                    setSecili(k);
                    setArama(k.display_name || k.username || '');
                    setSonuclar([]);
                  }}
                  onSecTemizle={() => setSecili(null)}
                  coin={coin}
                  onCoin={setCoin}
                  hizliMiktarlar={hizliCoin}
                  hizliUyeler={uyeler}
                  onHizliUye={hizliUyeSec}
                  onYukle={yukleCoin}
                />
              </>
            ) : null}

            <Text style={styles.bolum}>Üyeler</Text>
            {uyeler.length === 0 ? (
              <Text style={styles.bos}>Henüz kayıtlı üye yok</Text>
            ) : (
              uyeler.map((u) => (
                <UyeKart key={u.user_id} uye={u} />
              ))
            )}

            {sahibi ? (
              <>
                <Text style={styles.bolum}>Ajansa davet</Text>
                <View style={styles.kart}>
                  <Text style={styles.hint}>
                    Davet kodunu paylaş veya kullanıcıya DM gönder. Alıcı mesajdaki
                    “Daveti kabul et” ile başvurabilir.
                  </Text>
                  <TextInput
                    value={davetArama}
                    onChangeText={(t) => {
                      setDavetArama(t);
                      setDavetSecili(null);
                    }}
                    placeholder="Kullanıcı ara (@ veya isim)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  {davetSecili ? (
                    <View style={styles.secili}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={RenkTokenlari.mint}
                      />
                      <Text style={styles.seciliYazi}>
                        {uyeAdi(davetSecili)}
                      </Text>
                    </View>
                  ) : (
                    davetSonuclar.slice(0, 6).map((k) => (
                      <Pressable
                        key={k.id}
                        style={styles.aramaSatir}
                        onPress={() => {
                          setDavetSecili(k);
                          setDavetArama(k.display_name || k.username || '');
                          setDavetSonuclar([]);
                        }}
                      >
                        <Text style={styles.aramaAd}>
                          {k.display_name || k.username}
                        </Text>
                        <Text style={styles.aramaAlt}>
                          {k.public_user_id || k.username}
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={davetDmGonder}
                    disabled={busy}
                  >
                    <Ionicons name="mail-outline" size={16} color="#12040C" />
                    <Text style={styles.ctaYazi}> Davet mesajı gönder</Text>
                  </Pressable>
                </View>

                {bekleyenHostlar.length > 0 ? (
                  <>
                    <Text style={styles.bolum}>Bekleyen başvurular</Text>
                    {bekleyenHostlar.map((b) => {
                      const ad = uyeAdi(b);
                      return (
                        <View key={b.id} style={styles.basvuruKart}>
                          <Pressable
                            style={styles.uyeSol}
                            onPress={() =>
                              router.push(`/kullanici/${b.user_id}` as any)
                            }
                          >
                            {b.avatar_url ? (
                              <Image
                                source={{ uri: b.avatar_url }}
                                style={styles.avatar}
                              />
                            ) : (
                              <View style={[styles.avatar, styles.avatarBos]}>
                                <Ionicons
                                  name="person"
                                  size={18}
                                  color={RenkTokenlari.textDim}
                                />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.uyeAd}>{ad}</Text>
                              <Text style={styles.uyeAlt}>
                                {b.public_user_id || b.username || '—'} ·{' '}
                                {new Date(b.created_at).toLocaleDateString(
                                  'tr-TR',
                                )}
                              </Text>
                            </View>
                          </Pressable>
                          <View style={styles.basvuruAksiyon}>
                            <Pressable
                              style={styles.onayBtn}
                              onPress={() => hostBasvuruOnayla(b.id, ad)}
                              disabled={busy}
                            >
                              <Text style={styles.onayBtnYazi}>Onayla</Text>
                            </Pressable>
                            <Pressable
                              style={styles.redBtn}
                              onPress={() => hostBasvuruReddet(b.id, ad)}
                              disabled={busy}
                            >
                              <Text style={styles.redBtnYazi}>Red</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : null}

                <Text style={styles.bolum}>Üye için ses odası kur</Text>
                <View style={styles.kart}>
                  <Text style={styles.hint}>
                    Oda seçilen üyenin host hesabında açılır.
                  </Text>
                  {uyeler.length === 0 ? (
                    <Text style={styles.bos}>Önce üye ekle</Text>
                  ) : (
                    <View style={styles.uyeSecSatir}>
                      {uyeler.map((u) => {
                        const secili = odaUyeId === u.user_id;
                        return (
                          <Pressable
                            key={u.user_id}
                            style={[
                              styles.uyeChip,
                              secili && styles.uyeChipSecili,
                            ]}
                            onPress={() => setOdaUyeId(u.user_id)}
                          >
                            {u.avatar_url ? (
                              <Image
                                source={{ uri: u.avatar_url }}
                                style={styles.uyeChipAvatar}
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.uyeChipYazi,
                                secili && styles.uyeChipYaziSecili,
                              ]}
                              numberOfLines={1}
                            >
                              {uyeAdi(u)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <TextInput
                    value={odaBaslik}
                    onChangeText={setOdaBaslik}
                    placeholder="Oda başlığı"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={uyeOdaKur}
                    disabled={busy}
                  >
                    <Ionicons name="mic" size={16} color="#12040C" />
                    <Text style={styles.ctaYazi}> Ses odası kur</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Text style={styles.bolum}>Limit kullanımı</Text>
            {limits ? (
              <>
                <LimitCubugu
                  label="Günlük"
                  kullanilan={detay.kullanim.gunluk_transfer}
                  limit={limits.daily_limit}
                  unlimited={unlimited}
                />
                <LimitCubugu
                  label="Aylık"
                  kullanilan={detay.kullanim.aylik_transfer}
                  limit={limits.monthly_limit}
                  unlimited={unlimited}
                />
                {!unlimited ? (
                  <View style={styles.limitKart}>
                    <Text style={styles.limitLabel}>Tek sefer / kişi başı</Text>
                    <Text style={styles.limitDeger}>
                      {sayi(limits.single_transfer_limit)} ·{' '}
                      {sayi(limits.per_user_limit)}
                    </Text>
                    <Text style={styles.limitKalan}>
                      Limit yükseltme admin panelinden (sınırsız / limitli)
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {sahibi ? (
              <>
                <Text style={styles.bolum}>Ajans kuralları</Text>
                <View style={styles.kart}>
                  <TextInput
                    value={kurallar}
                    onChangeText={setKurallar}
                    placeholder="Host ve üye kuralları…"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={[styles.input, styles.area]}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={kurallariKaydet}
                    disabled={busy}
                  >
                    <Text style={styles.ctaYazi}>Kuralları kaydet</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Ödeme bilgisi (IBAN şablonu)</Text>
                <View style={styles.kart}>
                  <TextInput
                    value={holder}
                    onChangeText={setHolder}
                    placeholder="İsim soyisim (hesap sahibi)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={banka}
                    onChangeText={setBanka}
                    placeholder="Banka adı"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={iban}
                    onChangeText={setIban}
                    placeholder="IBAN"
                    autoCapitalize="characters"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={telefon}
                    onChangeText={setTelefon}
                    placeholder="Telefon"
                    keyboardType="phone-pad"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={odemeNot}
                    onChangeText={setOdemeNot}
                    placeholder="Ek not (isteğe bağlı)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.ctaGhost, busy && styles.ctaDisabled]}
                    onPress={odemeKaydet}
                    disabled={busy}
                  >
                    <Text style={styles.ctaGhostYazi}>Şablonu kaydet</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Tek tıkla ödeme mesajı</Text>
                <View style={styles.kart}>
                  <Text style={styles.hint}>
                    Kayıtlı IBAN / banka bilgisini seçilen kullanıcıya DM olarak
                    gönder.
                  </Text>
                  <TextInput
                    value={odemeArama}
                    onChangeText={(t) => {
                      setOdemeArama(t);
                      setOdemeSecili(null);
                    }}
                    placeholder="Alıcı ara (@ veya isim)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  {odemeSecili ? (
                    <View style={styles.secili}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={RenkTokenlari.mint}
                      />
                      <Text style={styles.seciliYazi}>
                        {odemeSecili.display_name || odemeSecili.username}
                      </Text>
                    </View>
                  ) : (
                    odemeSonuclar.slice(0, 6).map((k) => (
                      <Pressable
                        key={k.id}
                        style={styles.aramaSatir}
                        onPress={() => {
                          setOdemeSecili(k);
                          setOdemeArama(k.display_name || k.username || '');
                          setOdemeSonuclar([]);
                        }}
                      >
                        <Text style={styles.aramaAd}>
                          {k.display_name || k.username}
                        </Text>
                        <Text style={styles.aramaAlt}>
                          {k.public_user_id || k.username}
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={odemeGonder}
                    disabled={busy}
                  >
                    <Ionicons name="send" size={16} color="#12040C" />
                    <Text style={styles.ctaYazi}> Ödeme bilgisini gönder</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Tehlikeli alan</Text>
                <Pressable
                  style={[styles.ctaDanger, busy && styles.ctaDisabled]}
                  onPress={ajansiSil}
                  disabled={busy}
                >
                  <Text style={styles.ctaDangerYazi}>Ajansı sil / kapat</Text>
                </Pressable>
              </>
            ) : null}

            <Text style={styles.bolum}>Son yüklemeler</Text>
            {(detay.son_transferler ?? []).length === 0 ? (
              <Text style={styles.bos}>Henüz transfer yok</Text>
            ) : (
              detay.son_transferler.map((t) => (
                <View key={t.id} style={styles.txKart}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txAd}>{t.to_name}</Text>
                    <Text style={styles.txAlt}>
                      {new Date(t.created_at).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  <Text style={styles.txCoin}>+{sayi(t.coins)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 6,
  },
  heroEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroBakiye: {
    ...TipografiTokenlari.title,
    fontSize: 40,
    color: RenkTokenlari.text,
  },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  heroChipSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: BoslukTokenlari.sm,
  },
  limitKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  limitSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  limitDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  cubukBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    overflow: 'hidden',
  },
  cubukDolgu: { height: '100%', borderRadius: 999 },
  limitKalan: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  kart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
  },
  input: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 12,
  },
  area: { minHeight: 120 },
  aramaSatir: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  aramaAd: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  aramaAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  secili: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  seciliYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  hizliSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hizli: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  hizliYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  cta: {
    marginTop: 4,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ctaGhost: {
    marginTop: 4,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  ctaGhostYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  ctaDanger: {
    marginTop: 4,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,80,80,0.12)',
    borderWidth: 1,
    borderColor: RenkTokenlari.danger,
  },
  ctaDangerYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    fontWeight: '800',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaYazi: {
    ...TipografiTokenlari.body,
    color: '#12040C',
    fontWeight: '800',
  },
  txKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  txAd: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  txAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  txCoin: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.mint,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    paddingVertical: BoslukTokenlari.xl,
  },
  ciroSatir: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  ciroKart: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    gap: 2,
  },
  ciroDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  ciroLabel: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  davetKodSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  davetKod: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 1.2,
    flex: 1,
  },
  davetIcon: { padding: 4 },
  uyeKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 10,
  },
  uyeSol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RenkTokenlari.surface,
  },
  avatarBos: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uyeAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  uyeAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statHucre: {
    width: '47%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
    gap: 2,
  },
  statBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  statDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  statAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  basvuruKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 10,
  },
  basvuruAksiyon: {
    flexDirection: 'row',
    gap: 8,
  },
  onayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.mint,
    alignItems: 'center',
  },
  onayBtnYazi: {
    ...TipografiTokenlari.caption,
    color: '#0A1A12',
    fontWeight: '800',
  },
  redBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(255,80,80,0.12)',
    borderWidth: 1,
    borderColor: RenkTokenlari.danger,
    alignItems: 'center',
  },
  redBtnYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    fontWeight: '800',
  },
  uyeSecSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uyeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  uyeChipSecili: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 180, 255, 0.12)',
  },
  uyeChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  uyeChipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
    flexShrink: 1,
  },
  uyeChipYaziSecili: {
    color: RenkTokenlari.primarySoft,
  },
  profilLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  profilLinkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  profilOnizleme: {
    marginBottom: 4,
  },
  profilBanner: {
    width: '100%',
    height: 72,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
  },
  profilBannerBos: { backgroundColor: RenkTokenlari.surface },
  profilLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginTop: -24,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: RenkTokenlari.bgCard,
    backgroundColor: RenkTokenlari.surface,
  },
  profilLogoBos: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  medyaSatir: { flexDirection: 'row', gap: 8 },
  medyaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  medyaBtnYazi: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
});
