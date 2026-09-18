import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  MesajlariGetir,
  type DirektMesaj,
} from '../../src/moduller/mesajlasma/okuma/MesajlariGetir';
import {
  MesajGonder,
  MesajPeerLastReadGet,
  MesajSil,
  MesajSohbetSil,
  MesajThreadArsivle,
  MesajThreadOkundu,
  OzelSohbetAcVeyaGetir,
} from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { DmMedyasiSecVeYukle } from '../../src/moduller/mesajlasma/islemler/DmMedyasiYukle';
import { MesajKullaniciAramaPaneli } from '../../src/moduller/mesajlasma/bilesenler/MesajKullaniciAramaPaneli';
import { MesajBaloncugu } from '../../src/moduller/mesajlasma/bilesenler/MesajBaloncugu';
import { MesajMedyaSecimPaneli } from '../../src/moduller/mesajlasma/bilesenler/MesajMedyaSecimPaneli';
import {
  MesajPeerOkunduYayinla,
  useMesajKanali,
} from '../../src/moduller/mesajlasma/gercek-zamanli/useMesajKanali';
import type { ArananKullanici } from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import {
  GorusmeBaslat,
  MesajThreadKarsiProfil,
} from '../../src/moduller/gorusme/islemler/GorusmeIslemleri';
import type { ThreadKarsiProfil } from '../../src/moduller/gorusme/tipler';
import { KullaniciGuvenlikMenusu } from '../../src/moduller/moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { MaviTikRozeti } from '../../src/moduller/mesajlasma/bilesenler/MaviTikRozeti';
import { MesajHizliAksiyonSeridi } from '../../src/moduller/mesajlasma/bilesenler/MesajHizliAksiyonSeridi';
import { PlatformResmiHesapPaneli } from '../../src/moduller/cuzdan/bilesenler/PlatformResmiHesapPaneli';
import {
  TakasMahkemeKaraAc,
  TakasMahkemeKapat,
} from '../../src/moduller/cuzdan/takas/TakasMahkemeIslemleri';
import { CuzdanHesabiGarantile } from '../../src/moduller/cuzdan/takas/CuzdanHesabi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function uuidYerel(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function MesajDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isGuest, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const magaza = useHediyeMagaza();
  const [mesajlar, setMesajlar] = useState<DirektMesaj[]>([]);
  const [metin, setMetin] = useState('');
  const [gonderiyor, setGonderiyor] = useState(false);
  const [aciliyor, setAciliyor] = useState(false);
  const [peer, setPeer] = useState<ThreadKarsiProfil | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [medyaSecimAcik, setMedyaSecimAcik] = useState(false);
  const [guvenlikAcik, setGuvenlikAcik] = useState(false);
  const [platformHesapAcik, setPlatformHesapAcik] = useState(false);
  const [raporIcerik, setRaporIcerik] = useState<{
    contentId: string;
    preview: string;
    mediaUrl?: string | null;
  } | null>(null);
  const listRef = useRef<FlatList<DirektMesaj>>(null);
  const mahkemeMi = peer?.thread_kind === 'mahkeme';
  const mahkemeKapali = !!peer?.closed_at;

  useEffect(() => {
    ImagePickerOnIsit({ izinIste: true });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    return () => sub.remove();
  }, []);

  const mergeMesaj = useCallback((msg: DirektMesaj) => {
    setMesajlar((prev) => {
      const byClient =
        msg.client_id &&
        prev.findIndex(
          (m) => m.client_id === msg.client_id || m.id === msg.client_id,
        );
      if (typeof byClient === 'number' && byClient >= 0) {
        const next = [...prev];
        next[byClient] = { ...msg, _localStatus: 'sent' };
        return next;
      }
      if (prev.some((m) => m.id === msg.id)) {
        return prev.map((m) =>
          m.id === msg.id ? { ...msg, _localStatus: 'sent' } : m,
        );
      }
      if (msg.deleted_at) {
        return prev.filter((m) => m.id !== msg.id);
      }
      return [...prev, { ...msg, _localStatus: 'sent' }];
    });
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useMesajKanali(
    id === 'yeni' ? undefined : id,
    (msg, event) => {
      if (event === 'DELETE') {
        setMesajlar((p) => p.filter((m) => m.id !== msg.id));
        return;
      }
      if (msg.deleted_at) {
        setMesajlar((p) => p.filter((m) => m.id !== msg.id));
        return;
      }
      mergeMesaj(msg);
      // Karsi mesaji geldiyse okundu isaretle + yayinla
      if (msg.sender_id && msg.sender_id !== user?.id && id && id !== 'yeni') {
        const at = new Date().toISOString();
        void MesajThreadOkundu(id).then(() => {
          void MesajPeerOkunduYayinla(id, at, user?.id);
        });
      }
    },
    (at, fromUserId) => {
      if (fromUserId && fromUserId === user?.id) return;
      setPeerLastReadAt((prev) => {
        if (!prev) return at;
        return new Date(at).getTime() >= new Date(prev).getTime() ? at : prev;
      });
    },
  );

  const load = useCallback(async () => {
    if (!id || id === 'yeni') return;
    try {
      const [msgs, karsi, peerRead] = await Promise.all([
        MesajlariGetir({ threadId: id, limit: 60 }),
        MesajThreadKarsiProfil(id).catch(() => null),
        MesajPeerLastReadGet(id),
      ]);
      setMesajlar(msgs.map((m) => ({ ...m, _localStatus: 'sent' as const })));
      setPeer(karsi);
      setPeerLastReadAt(peerRead);
      const at = new Date().toISOString();
      void MesajThreadOkundu(id).then(() => {
        void MesajPeerOkunduYayinla(id, at, user?.id);
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    } catch {
      setMesajlar([]);
    }
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ara = async (tur: 'audio' | 'video') => {
    if (!id || id === 'yeni') return;
    if (isGuest) {
      Alert.alert('Misafir', 'Arama için hesabını tamamla.');
      return;
    }
    Keyboard.dismiss();
    const r = await GorusmeBaslat(id, tur);
    if (!r.ok) {
      Alert.alert('Arama', r.hata);
      return;
    }
    router.push(`/gorusme/${r.call.id}` as any);
  };

  const gonderMetin = async () => {
    if (!id || id === 'yeni' || !metin.trim() || !user?.id) return;
    const body = metin.trim();
    const clientId = uuidYerel();
    const temp: DirektMesaj = {
      id: clientId,
      thread_id: id,
      sender_id: user.id,
      body,
      message_type: 'text',
      client_id: clientId,
      created_at: new Date().toISOString(),
      _localStatus: 'sending',
    };
    setMetin('');
    setMesajlar((p) => [...p, temp]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    setGonderiyor(true);
    const sonuc = await MesajGonder({
      threadId: id,
      body,
      clientId,
      messageType: 'text',
    });
    setGonderiyor(false);

    if (!sonuc.ok) {
      setMesajlar((p) =>
        p.map((m) =>
          m.id === clientId ? { ...m, _localStatus: 'failed' } : m,
        ),
      );
      Alert.alert('Gönderilemedi', sonuc.hata ?? 'Hata');
      return;
    }
    mergeMesaj({ ...sonuc.mesaj, _localStatus: 'sent' });
  };

  const hizliMetinGonder = useCallback(
    async (body: string) => {
      if (!id || id === 'yeni' || !user?.id || !body.trim()) return;
      const clientId = uuidYerel();
      const temp: DirektMesaj = {
        id: clientId,
        thread_id: id,
        sender_id: user.id,
        body: body.trim(),
        message_type: 'text',
        client_id: clientId,
        created_at: new Date().toISOString(),
        _localStatus: 'sending',
      };
      setMesajlar((p) => [...p, temp]);
      const sonuc = await MesajGonder({
        threadId: id,
        body: body.trim(),
        clientId,
        messageType: 'text',
      });
      if (!sonuc.ok) {
        setMesajlar((p) =>
          p.map((m) =>
            m.id === clientId ? { ...m, _localStatus: 'failed' } : m,
          ),
        );
        Alert.alert('Gönderilemedi', sonuc.hata ?? 'Hata');
        return;
      }
      mergeMesaj({ ...sonuc.mesaj, _localStatus: 'sent' });
    },
    [id, user?.id, mergeMesaj],
  );

  const cuzdanNoPaylas = useCallback(() => {
    void (async () => {
      const r = await CuzdanHesabiGarantile();
      if (!r.ok || !r.hesap.wallet_number) {
        Alert.alert('Cüzdan', r.ok === false ? r.hata : 'Cüzdan no bulunamadı.');
        return;
      }
      const no = r.hesap.wallet_number.replace(/\D/g, '');
      const formatli = no.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      await hizliMetinGonder(`MUTA PAY cüzdan no: ${formatli}`);
    })();
  }, [hizliMetinGonder]);

  const idPaylas = useCallback(() => {
    const pid = profile?.public_user_id;
    if (!pid) {
      Alert.alert('ID', 'Kullanıcı ID henüz yok.');
      return;
    }
    void hizliMetinGonder(`Kullanıcı ID: ${pid}`);
  }, [hizliMetinGonder, profile?.public_user_id]);

  const medyaGonder = async (
    tur: 'image' | 'video',
    kaynak: 'galeri' | 'kamera' = 'galeri',
  ) => {
    if (!id || id === 'yeni' || !user?.id) return;
    if (isGuest) {
      Alert.alert('Misafir', 'Medya için hesabını tamamla.');
      return;
    }
    const up = await DmMedyasiSecVeYukle(tur, { kaynak });
    if (!up.ok) {
      if (!up.iptal) Alert.alert('Medya', up.hata);
      return;
    }

    const clientId = uuidYerel();
    const temp: DirektMesaj = {
      id: clientId,
      thread_id: id,
      sender_id: user.id,
      body: null,
      message_type: up.messageType,
      media_url: up.url,
      client_id: clientId,
      created_at: new Date().toISOString(),
      _localStatus: 'sending',
    };
    setMesajlar((p) => [...p, temp]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    const sonuc = await MesajGonder({
      threadId: id,
      body: '',
      messageType: up.messageType,
      mediaUrl: up.url,
      clientId,
    });
    if (!sonuc.ok) {
      setMesajlar((p) =>
        p.map((m) =>
          m.id === clientId ? { ...m, _localStatus: 'failed' } : m,
        ),
      );
      Alert.alert('Gönderilemedi', sonuc.hata ?? 'Hata');
      return;
    }
    mergeMesaj({ ...sonuc.mesaj, _localStatus: 'sent' });
  };

  const mesajMenu = (item: DirektMesaj) => {
    const mine = item.sender_id === user?.id;
    const opts: {
      text: string;
      style?: 'destructive' | 'cancel';
      onPress?: () => void;
    }[] = [
      {
        text: 'Benden sil',
        onPress: () => {
          void (async () => {
            const r = await MesajSil(item.id, 'me');
            if (!r.ok) Alert.alert('Sil', r.hata);
            else setMesajlar((p) => p.filter((m) => m.id !== item.id));
          })();
        },
      },
    ];
    if (mine && item._localStatus !== 'sending') {
      opts.push({
        text: 'Herkesten sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await MesajSil(item.id, 'everyone');
            if (!r.ok) Alert.alert('Sil', r.hata);
            else setMesajlar((p) => p.filter((m) => m.id !== item.id));
          })();
        },
      });
    }
    if (!mine) {
      opts.push({
        text: 'Bildir',
        style: 'destructive',
        onPress: () => {
          setRaporIcerik({
            contentId: item.id,
            preview: item.body || `[${item.message_type}]`,
            mediaUrl: item.media_url,
          });
          setGuvenlikAcik(true);
        },
      });
    }
    opts.push({ text: 'Vazgeç', style: 'cancel' });
    Alert.alert('Mesaj', undefined, opts);
  };

  const sohbetMenu = () => {
    if (!id || id === 'yeni') return;

    if (mahkemeMi) {
      const uyeler = peer?.uyeler ?? [];
      const opts: {
        text: string;
        style?: 'cancel' | 'destructive';
        onPress?: () => void;
      }[] = [
        {
          text: 'Platform hesapları (mavi tik)',
          onPress: () => setPlatformHesapAcik(true),
        },
      ];

      if (peer?.can_moderate && peer.dispute_id && !mahkemeKapali) {
        const hedefler = uyeler.filter(
          (u) => u.rol !== 'yargic' && u.id !== user?.id,
        );
        for (const h of hedefler) {
          opts.push({
            text: `Kara · ${h.display_name || h.username || 'taraf'}`,
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Kara işlem',
                `${h.display_name || h.username} için kara açılacak.\nHesap askıya alınır / kapatma yolu başlar. Onaylıyor musun?`,
                [
                  { text: 'Vazgeç', style: 'cancel' },
                  {
                    text: 'Kara aç',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        const r = await TakasMahkemeKaraAc({
                          disputeId: peer.dispute_id!,
                          targetUserId: h.id,
                          reason:
                            'Mahkeme kararı: usulsüzlük / dolandırıcılık / cevap vermeme',
                        });
                        if (!r.ok) Alert.alert('Kara', r.hata);
                        else {
                          Alert.alert(
                            'Kara açıldı',
                            'Karar mahkeme grubuna bildirildi.',
                          );
                          void load();
                        }
                      })();
                    },
                  },
                ],
              );
            },
          });
        }
        opts.push({
          text: 'Mahkemeyi kapat',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Mahkemeyi kapat',
              'Grup kapanır; yeni mesaj yazılamaz. Onaylıyor musun?',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Kapat',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const r = await TakasMahkemeKapat({
                        disputeId: peer.dispute_id!,
                        note: 'Mahkeme platform tarafından kapatıldı.',
                      });
                      if (!r.ok) Alert.alert('Kapat', r.hata);
                      else void load();
                    })();
                  },
                },
              ],
            );
          },
        });
      }

      opts.push(
        {
          text: 'Arşivle',
          onPress: () => {
            void (async () => {
              const r = await MesajThreadArsivle(id, true);
              if (!r.ok) Alert.alert('Arşiv', r.hata);
              else router.back();
            })();
          },
        },
        { text: 'Vazgeç', style: 'cancel' },
      );

      Alert.alert(
        peer?.thread_title || peer?.display_name || 'Mahkeme',
        mahkemeKapali
          ? 'Bu mahkeme kapalı.'
          : 'Yargıç paneli · savunmalar bu grupta',
        opts,
      );
      return;
    }

    Alert.alert(
      peer?.agency_name || peer?.display_name || peer?.username || 'Sohbet',
      undefined,
      [
        peer?.peer_agency_id
          ? {
              text: 'Ajans profili',
              onPress: () =>
                router.push(`/ajans/profil/${peer.peer_agency_id}` as any),
            }
          : peer?.id
            ? {
                text: 'Profil',
                onPress: () => router.push(`/kullanici/${peer.id}` as any),
              }
            : undefined,
        peer?.id
          ? {
              text: 'Hediye gönder',
              onPress: () =>
                magaza.ac({
                  receiverId: peer.id,
                  aliciAdi:
                    peer.agency_name || peer.display_name || peer.username,
                  animasyon: false,
                  onBasarili: (gift, adet) => {
                    void MesajGonder({
                      threadId: id,
                      body: `🎁 ${gift.emoji} ${gift.name}${adet > 1 ? ` ×${adet}` : ''} hediye gönderdi`,
                      messageType: 'text',
                      clientId: uuidYerel(),
                    }).then((r) => {
                      if (r.ok) mergeMesaj(r.mesaj);
                    });
                  },
                }),
            }
          : undefined,
        {
          text: 'Arşivle',
          onPress: () => {
            void (async () => {
              const r = await MesajThreadArsivle(id, true);
              if (!r.ok) Alert.alert('Arşiv', r.hata);
              else {
                Alert.alert('Arşivlendi', 'Sohbet arşive taşındı.');
                router.back();
              }
            })();
          },
        },
        {
          text: 'Sohbeti sil',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Sohbeti sil',
              'Bu sohbet senden tamamen silinir. Geçmiş temizlenir; karşı taraf etkilenmez.',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Sil',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const r = await MesajSohbetSil(id);
                      if (!r.ok) {
                        Alert.alert('Silinemedi', r.hata);
                        return;
                      }
                      router.replace('/(tabs)/messages' as any);
                    })();
                  },
                },
              ],
            );
          },
        },
        {
          text: 'Engelle / Bildir',
          onPress: () => setGuvenlikAcik(true),
        },
        { text: 'Vazgeç', style: 'cancel' },
      ].filter(Boolean) as {
        text: string;
        style?: 'cancel' | 'destructive';
        onPress?: () => void;
      }[],
    );
  };

  const kullaniciSec = async (kullanici: ArananKullanici) => {
    if (aciliyor) return;
    setAciliyor(true);
    const sonuc = await OzelSohbetAcVeyaGetir(kullanici.id);
    setAciliyor(false);
    if (!sonuc.ok) {
      Alert.alert('Sohbet açılamadı', sonuc.hata);
      return;
    }
    router.replace(`/mesaj/${sonuc.threadId}` as any);
  };

  if (id === 'yeni') {
    return (
      <Screen edges={['top', 'bottom']}>
        <ModulHataSiniri modulAdi="mesajlasma">
          <View style={styles.topBar}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={RenkTokenlari.text} />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={styles.topFisilti}>YENİ SOHBET</Text>
              <Text style={styles.topTitle}>Kullanıcı ara</Text>
            </View>
            <View style={styles.backBtn} />
          </View>
          <MesajKullaniciAramaPaneli
            haricUserId={user?.id}
            onSec={(k) => void kullaniciSec(k)}
            seciliyor={aciliyor}
          />
        </ModulHataSiniri>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="mesajlasma">
        <KlavyeGuvenliAlan style={styles.flex}>
          <View style={styles.topBar}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={RenkTokenlari.text} />
            </Pressable>
            <Pressable
              style={styles.topCopy}
              onPress={() => {
                if (mahkemeMi) {
                  setPlatformHesapAcik(true);
                  return;
                }
                if (peer?.peer_agency_id) {
                  router.push(`/ajans/profil/${peer.peer_agency_id}` as any);
                  return;
                }
                sohbetMenu();
              }}
            >
              <View style={styles.topAdSatir}>
                <Text style={styles.topTitle} numberOfLines={1}>
                  {peer?.agency_name ||
                    peer?.thread_title ||
                    peer?.display_name ||
                    peer?.username ||
                    'Mesaj'}
                </Text>
                {mahkemeMi || peer?.is_platform_official || peer?.is_platform_yargic ? (
                  <MaviTikRozeti size={16} />
                ) : null}
              </View>
              <Text style={styles.topFisilti}>
                {mahkemeMi
                  ? mahkemeKapali
                    ? 'mahkeme kapalı · yargıç'
                    : 'yargıç · mavi tik · dokun'
                  : peer?.peer_agency_id
                    ? 'ajans · dokunarak profil'
                    : 'çevrimiçi · dokunarak menü'}
              </Text>
            </Pressable>
            <View style={styles.aramaBtnlar}>
              {!mahkemeMi ? (
                <>
                  <Pressable style={styles.aramaBtn} onPress={() => void ara('audio')}>
                    <Ionicons name="call" size={20} color={RenkTokenlari.mint} />
                  </Pressable>
                  <Pressable style={styles.aramaBtn} onPress={() => void ara('video')}>
                    <Ionicons
                      name="videocam"
                      size={22}
                      color={RenkTokenlari.primarySoft}
                    />
                  </Pressable>
                </>
              ) : null}
              <Pressable style={styles.aramaBtn} onPress={sohbetMenu}>
                <Ionicons
                  name="ellipsis-vertical"
                  size={18}
                  color={RenkTokenlari.textMuted}
                />
              </Pressable>
            </View>
          </View>

          <FlatList
            ref={listRef}
            style={styles.listFlex}
            data={mesajlar}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={Keyboard.dismiss}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            contentContainerStyle={[
              styles.list,
              mesajlar.length === 0 && styles.listEmpty,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyChatWrap}>
                <Text style={styles.emptyChat}>Henüz mesaj yok</Text>
                <Text style={styles.emptyChatAlt}>
                  Metin, fotoğraf veya video gönder — anında ulaşır.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <MesajBaloncugu
                item={item}
                mine={item.sender_id === user?.id}
                peerLastReadAt={peerLastReadAt}
                onLongPress={() => mesajMenu(item)}
              />
            )}
          />

          {mahkemeKapali ? (
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom, BoslukTokenlari.md) },
              ]}
            >
              <Text style={styles.kapaliUyari}>
                Bu mahkeme kapatıldı. Yeni mesaj yazılamaz.
              </Text>
            </View>
          ) : (
          <View>
            {!mahkemeMi ? (
              <MesajHizliAksiyonSeridi
                ajansMi={!!peer?.peer_agency_id}
                onCuzdanNoPaylas={cuzdanNoPaylas}
                onIdPaylas={idPaylas}
              />
            ) : null}
          <View
            style={[
              styles.composer,
              { paddingBottom: Math.max(insets.bottom, BoslukTokenlari.md) },
            ]}
          >
            {!mahkemeMi ? (
            <Pressable
              style={styles.attachModern}
              onPress={() => {
                if (!peer?.id) return;
                magaza.ac({
                  receiverId: peer.id,
                  aliciAdi: peer.display_name || peer.username,
                  animasyon: false,
                  onBasarili: (gift, adet) => {
                    void MesajGonder({
                      threadId: id!,
                      body: `🎁 ${gift.emoji} ${gift.name}${adet > 1 ? ` ×${adet}` : ''} hediye gönderdi`,
                      messageType: 'text',
                      clientId: uuidYerel(),
                    }).then((r) => {
                      if (r.ok) mergeMesaj(r.mesaj);
                    });
                  },
                });
              }}
              accessibilityLabel="Hediye gönder"
            >
              <LinearGradient
                colors={['rgba(255,180,90,0.28)', 'rgba(255,180,90,0.08)']}
                style={styles.attachGrad}
              >
                <Ionicons name="gift" size={20} color={RenkTokenlari.accent} />
              </LinearGradient>
            </Pressable>
            ) : null}
            <Pressable
              style={styles.attachModern}
              onPress={() => {
                Keyboard.dismiss();
                setMedyaSecimAcik(true);
              }}
              accessibilityLabel="Fotoğraf veya video gönder"
            >
              <LinearGradient
                colors={['rgba(90,220,200,0.28)', 'rgba(140,120,255,0.14)']}
                style={styles.attachGrad}
              >
                <Ionicons name="images" size={20} color={RenkTokenlari.mint} />
              </LinearGradient>
            </Pressable>
            <TextInput
              value={metin}
              onChangeText={setMetin}
              placeholder="Mesaj yaz..."
              placeholderTextColor={RenkTokenlari.textDim}
              style={styles.input}
              multiline
              maxLength={4000}
              blurOnSubmit={false}
            />
            <Pressable
              style={[
                styles.sendHit,
                (!metin.trim() || gonderiyor) && styles.sendDisabled,
              ]}
              onPress={() => void gonderMetin()}
              disabled={!metin.trim() || gonderiyor}
            >
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.sendBtn}
              >
                <Ionicons name="send" size={18} color="#12040C" />
              </LinearGradient>
            </Pressable>
          </View>
          </View>
          )}

        </KlavyeGuvenliAlan>

        <PlatformResmiHesapPaneli
          acik={platformHesapAcik}
          onKapat={() => setPlatformHesapAcik(false)}
        />

        {peer?.id && !mahkemeMi ? (
          <KullaniciGuvenlikMenusu
            visible={guvenlikAcik}
            targetUserId={peer.id}
            targetName={peer.display_name || peer.username}
            contentType={raporIcerik ? 'dm_message' : 'user'}
            contentId={raporIcerik?.contentId}
            contentPreview={raporIcerik?.preview}
            contentMediaUrl={raporIcerik?.mediaUrl}
            onClose={() => {
              setGuvenlikAcik(false);
              setRaporIcerik(null);
            }}
            onBlocked={() => {
              setGuvenlikAcik(false);
              setRaporIcerik(null);
              router.back();
            }}
          />
        ) : null}

        <HediyeMagazaBaglamasi magaza={magaza} animasyon={false} />

        <MesajMedyaSecimPaneli
          visible={medyaSecimAcik}
          onClose={() => setMedyaSecimAcik(false)}
          onSec={(secim) => {
            void medyaGonder(secim.tur, secim.kaynak);
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listFlex: { flex: 1, minHeight: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCopy: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  topAdSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  aramaBtnlar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  aramaBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  topFisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontSize: 10,
  },
  topTitle: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
    flexShrink: 1,
  },
  kapaliUyari: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  list: {
    padding: BoslukTokenlari.lg,
    gap: 6,
    flexGrow: 1,
  },
  listEmpty: { justifyContent: 'center' },
  emptyChatWrap: { alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  emptyChat: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  emptyChatAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: BoslukTokenlari.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  attach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachModern: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  attachGrad: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: YaricapTokenlari.pill,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
  },
  sendHit: { borderRadius: YaricapTokenlari.pill, overflow: 'hidden' },
  sendBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
});
