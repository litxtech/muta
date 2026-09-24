import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MesajThreadEngelliMi,
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
import { MesajMedyaGoruntuleyici } from '../../src/moduller/mesajlasma/bilesenler/MesajMedyaGoruntuleyici';
import {
  MesajPeerOkunduYayinla,
  useMesajKanali,
} from '../../src/moduller/mesajlasma/gercek-zamanli/useMesajKanali';
import type { ArananKullanici } from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import { MedyaUriGuvenli } from '../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
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
import { usePaylasilanDurumOnizleme } from '../../src/moduller/durum/paylasim/usePaylasilanDurumOnizleme';
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
import { useCeviri } from '../../src/i18n/useCeviri';

function uuidYerel(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** expo-router bazen id'yi string[] verir — tek string'e indir */
function rotaParamString(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === 'string' && x.length > 0);
    return first;
  }
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export default function MesajDetayEkrani() {
  const { t } = useCeviri();
  const { id: idHam } = useLocalSearchParams<{ id: string | string[] }>();
  const id = rotaParamString(idHam);
  const threadId = id && id !== 'yeni' ? id : undefined;
  const { user, isGuest, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const magaza = useHediyeMagaza();
  const [mesajlar, setMesajlar] = useState<DirektMesaj[]>([]);
  const [metin, setMetin] = useState('');
  const [gonderiyor, setGonderiyor] = useState(false);
  const [aciliyor, setAciliyor] = useState(false);
  const [peer, setPeer] = useState<ThreadKarsiProfil | null>(null);
  const [engelli, setEngelli] = useState(false);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [medyaSecimAcik, setMedyaSecimAcik] = useState(false);
  const [guvenlikAcik, setGuvenlikAcik] = useState(false);
  const [platformHesapAcik, setPlatformHesapAcik] = useState(false);
  const [medyaGoruntule, setMedyaGoruntule] = useState<{
    uri: string;
    tur: 'image' | 'video';
  } | null>(null);
  const [raporIcerik, setRaporIcerik] = useState<{
    contentId: string;
    preview: string;
    mediaUrl?: string | null;
  } | null>(null);
  const listRef = useRef<FlatList<DirektMesaj>>(null);
  const mahkemeMi = peer?.thread_kind === 'mahkeme';
  const mahkemeKapali = !!peer?.closed_at;

  const sharedStatusIds = useMemo(
    () =>
      mesajlar
        .filter((m) => m.message_type === 'shared_post' && !!m.ref_id)
        .map((m) => m.ref_id as string),
    [mesajlar],
  );
  const { map: sharedPostMap, yukleniyor: sharedPostYukleniyor } =
    usePaylasilanDurumOnizleme(sharedStatusIds);

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
    if (!msg?.id) return;
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
    engelli ? undefined : threadId,
    (msg, event) => {
      if (engelli) return;
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
      if (msg.sender_id && msg.sender_id !== user?.id && threadId) {
        const at = new Date().toISOString();
        void MesajThreadOkundu(threadId).then(() => {
          void MesajPeerOkunduYayinla(threadId, at, user?.id);
        });
      }
    },
    (at, fromUserId) => {
      if (engelli) return;
      if (fromUserId && fromUserId === user?.id) return;
      setPeerLastReadAt((prev) => {
        if (!prev) return at;
        return new Date(at).getTime() >= new Date(prev).getTime() ? at : prev;
      });
    },
  );

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      const bloklu = await MesajThreadEngelliMi(threadId);
      setEngelli(bloklu);
      const [karsi, peerRead] = await Promise.all([
        MesajThreadKarsiProfil(threadId).catch(() => null),
        MesajPeerLastReadGet(threadId),
      ]);
      setPeer(karsi);
      setPeerLastReadAt(peerRead);

      if (bloklu) {
        setMesajlar([]);
        return;
      }

      const msgs = await MesajlariGetir({ threadId, limit: 60 });
      setMesajlar(
        msgs
          .filter((m) => typeof m?.id === 'string' && m.id.length > 0)
          .map((m) => ({ ...m, _localStatus: 'sent' as const })),
      );
      const at = new Date().toISOString();
      void MesajThreadOkundu(threadId).then(() => {
        void MesajPeerOkunduYayinla(threadId, at, user?.id);
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.toLowerCase().includes('engellen')) {
        setEngelli(true);
        setMesajlar([]);
        return;
      }
      setMesajlar([]);
    }
  }, [threadId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const ara = async (tur: 'audio' | 'video') => {
    if (!id || id === 'yeni') return;
    if (engelli) {
      Alert.alert(t('mesajSohbet.engelliBaslik'), t('mesajSohbet.engelliIletisim'));
      return;
    }
    if (isGuest) {
      Alert.alert(t('ortak.misafir'), t('mesajSohbet.misafirArama'));
      return;
    }
    Keyboard.dismiss();
    // Yerelde aynı thread görüşmesi varsa yenisini başlatma — devam et
    try {
      const { GorusmeOturumAl, GorusmeOturumSunumAyarla } = await import(
        '../../src/moduller/gorusme/oturum/GorusmeOturumYoneticisi'
      );
      const mevcut = GorusmeOturumAl();
      if (mevcut && mevcut.call.thread_id === id) {
        GorusmeOturumSunumAyarla('fullscreen');
        router.push(`/gorusme/${mevcut.callId}` as any);
        return;
      }
    } catch {
      /* ignore */
    }
    const r = await GorusmeBaslat(id, tur);
    if (!r.ok) {
      const msg = (r.hata || '').toLowerCase();
      const ghost =
        msg.includes('zaten aktif') || msg.includes('aktif bir gorusme');
      if (ghost) {
        try {
          const { GorusmeBenimAktifleriBitir } = await import(
            '../../src/moduller/gorusme/islemler/GorusmeIslemleri'
          );
          await GorusmeBenimAktifleriBitir('client_ghost_clear');
          const tekrar = await GorusmeBaslat(id, tur);
          if (tekrar.ok) {
            router.push(`/gorusme/${tekrar.call.id}` as any);
            return;
          }
        } catch {
          /* ignore */
        }
      }
      Alert.alert(t('mesajSohbet.arama'), r.hata);
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
      Alert.alert(t('mesajSohbet.gonderilemedi'), sonuc.hata ?? t('ortak.hata'));
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
        Alert.alert(t('mesajSohbet.gonderilemedi'), sonuc.hata ?? t('ortak.hata'));
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
        Alert.alert(t('cuzdan.baslik'), r.ok === false ? r.hata : t('mesajSohbet.cuzdanNoYok'));
        return;
      }
      const no = r.hesap.wallet_number.replace(/\D/g, '');
      const formatli = no.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      await hizliMetinGonder(t('mesajSohbet.cuzdanNoPaylasMetin', { no: formatli }));
    })();
  }, [hizliMetinGonder]);

  const idPaylas = useCallback(() => {
    const pid = profile?.public_user_id;
    if (!pid) {
      Alert.alert('ID', t('mesajSohbet.idYok'));
      return;
    }
    void hizliMetinGonder(t('mesajSohbet.idPaylasMetin', { id: pid }));
  }, [hizliMetinGonder, profile?.public_user_id]);

  const medyaGonder = async (
    tur: 'image' | 'video',
    kaynak: 'galeri' | 'kamera' = 'galeri',
  ) => {
    if (!id || id === 'yeni' || !user?.id) return;
    if (isGuest) {
      Alert.alert(t('ortak.misafir'), t('mesajSohbet.misafirMedya'));
      return;
    }
    const up = await DmMedyasiSecVeYukle(tur, { kaynak });
    if (!up.ok) {
      if (!up.iptal) Alert.alert(t('ortak.medya'), up.hata);
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
      Alert.alert(t('mesajSohbet.gonderilemedi'), sonuc.hata ?? t('ortak.hata'));
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
        text: t('mesajSohbet.bendenSil'),
        onPress: () => {
          void (async () => {
            const r = await MesajSil(item.id, 'me');
            if (!r.ok) Alert.alert(t('mesajSohbet.sil'), r.hata);
            else setMesajlar((p) => p.filter((m) => m.id !== item.id));
          })();
        },
      },
    ];
    if (mine && item._localStatus !== 'sending') {
      opts.push({
        text: t('mesajSohbet.herkestenSil'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await MesajSil(item.id, 'everyone');
            if (!r.ok) Alert.alert(t('mesajSohbet.sil'), r.hata);
            else setMesajlar((p) => p.filter((m) => m.id !== item.id));
          })();
        },
      });
    }
    if (!mine) {
      opts.push({
        text: t('mesajSohbet.bildir'),
        style: 'destructive',
        onPress: () => {
          setRaporIcerik({
            contentId: item.id,
            preview: item.body || (
              item.message_type === 'shared_post'
                ? t('mesajSohbet.paylasilanGonderi')
                : `[${item.message_type}]`
            ),
            mediaUrl: item.media_url,
          });
          setGuvenlikAcik(true);
        },
      });
    }
    opts.push({ text: t('ortak.vazgec'), style: 'cancel' });
    Alert.alert(t('mesajSohbet.mesajBaslik'), undefined, opts);
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
          text: t('mesajSohbet.platformHesaplari'),
          onPress: () => setPlatformHesapAcik(true),
        },
      ];

      if (peer?.can_moderate && peer.dispute_id && !mahkemeKapali) {
        const hedefler = uyeler.filter(
          (u) => u.rol !== 'yargic' && u.id !== user?.id,
        );
        for (const h of hedefler) {
          opts.push({
            text: t('mesajSohbet.karaTaraf', { ad: h.display_name || h.username || t('mesajSohbet.taraf') }),
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                t('mesajSohbet.karaIslem'),
                t('mesajSohbet.karaAcSoru', { ad: h.display_name || h.username }),
                [
                  { text: t('ortak.vazgec'), style: 'cancel' },
                  {
                    text: t('mesajSohbet.karaAc'),
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        const r = await TakasMahkemeKaraAc({
                          disputeId: peer.dispute_id!,
                          targetUserId: h.id,
                          reason:
                            t('mesajSohbet.karaSebep'),
                        });
                        if (!r.ok) Alert.alert(t('mesajSohbet.karaIslem'), r.hata);
                        else {
                          Alert.alert(t('mesajSohbet.karaAcildi'), t('mesajSohbet.karaAcildiBody'));
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
          text: t('mesajSohbet.mahkemeyiKapat'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('mesajSohbet.mahkemeyiKapat'),
              t('mesajSohbet.mahkemeyiKapatSoru'),
              [
                { text: t('ortak.vazgec'), style: 'cancel' },
                {
                  text: t('ortak.kapat'),
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const r = await TakasMahkemeKapat({
                        disputeId: peer.dispute_id!,
                        note: t('mesajSohbet.mahkemeKapatNot'),
                      });
                      if (!r.ok) Alert.alert(t('ortak.kapat'), r.hata);
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
          text: t('mesajlar.arsivle'),
          onPress: () => {
            void (async () => {
              const r = await MesajThreadArsivle(id, true);
              if (!r.ok) Alert.alert(t('mesajSohbet.arsiv'), r.hata);
              else router.back();
            })();
          },
        },
        { text: t('ortak.vazgec'), style: 'cancel' },
      );

      Alert.alert(
        peer?.thread_title || peer?.display_name || t('mesajSohbet.mahkeme'),
        mahkemeKapali
          ? t('mesajSohbet.mahkemeKapali')
          : t('mesajSohbet.yargicPanel'),
        opts,
      );
      return;
    }

    Alert.alert(
      peer?.agency_name || peer?.display_name || peer?.username || t('mesajSohbet.sohbet'),
      undefined,
      [
        peer?.peer_agency_id
          ? {
              text: t('mesajSohbet.ajansProfili'),
              onPress: () =>
                router.push(`/ajans/profil/${peer.peer_agency_id}` as any),
            }
          : peer?.id
            ? {
                text: t('profil.baslik'),
                onPress: () => router.push(`/kullanici/${peer.id}` as any),
              }
            : undefined,
        peer?.id && !engelli
          ? {
              text: t('mesajSohbet.hediyeGonder'),
              onPress: () =>
                magaza.ac({
                  receiverId: peer.id,
                  aliciAdi:
                    peer.agency_name || peer.display_name || peer.username,
                  animasyon: false,
                  onBasarili: (gift, adet) => {
                    void MesajGonder({
                      threadId: id,
                      body: t('mesajSohbet.hediyeGonderdi', { emoji: `🎁 ${gift.emoji}`, ad: gift.name, adet: adet > 1 ? ` ×${adet}` : '' }),
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
          text: t('mesajlar.arsivle'),
          onPress: () => {
            void (async () => {
              const r = await MesajThreadArsivle(id, true);
              if (!r.ok) Alert.alert(t('mesajSohbet.arsiv'), r.hata);
              else {
                Alert.alert(t('mesajSohbet.arsivlendi'), t('mesajSohbet.arsivlendiBody'));
                router.back();
              }
            })();
          },
        },
        {
          text: t('mesajSohbet.sohbetiSil'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('mesajSohbet.sohbetiSil'),
              t('mesajSohbet.sohbetiSilBody'),
              [
                { text: t('ortak.vazgec'), style: 'cancel' },
                {
                  text: t('ortak.sil'),
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      const r = await MesajSohbetSil(id);
                      if (!r.ok) {
                        Alert.alert(t('mesajSohbet.silinemedi'), r.hata);
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
          text: t('mesajSohbet.engelleBildir'),
          onPress: () => setGuvenlikAcik(true),
        },
        { text: t('ortak.vazgec'), style: 'cancel' },
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
      Alert.alert(t('mesajSohbet.sohbetAcilamadi'), sonuc.hata);
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
              <Text style={styles.topFisilti}>{t('mesajSohbet.yeniSohbetFisilti')}</Text>
              <Text style={styles.topTitle}>{t('mesajSohbet.kullaniciAra')}</Text>
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

  if (!threadId) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ModulHataSiniri modulAdi="mesajlasma">
          <View style={styles.topBar}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={RenkTokenlari.text} />
            </Pressable>
            <View style={styles.topCopy}>
              <Text style={styles.topTitle}>{t('mesajSohbet.sohbetBulunamadi')}</Text>
              <Text style={styles.topFisilti}>{t('mesajSohbet.sohbetBulunamadiAlt')}</Text>
            </View>
            <View style={styles.backBtn} />
          </View>
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
                    t('mesajSohbet.mesajBaslik')}
                </Text>
                {mahkemeMi || peer?.is_platform_official || peer?.is_platform_yargic ? (
                  <MaviTikRozeti size={16} />
                ) : null}
              </View>
              <Text style={styles.topFisilti}>
                {mahkemeMi
                  ? mahkemeKapali
                    ? t('mesajSohbet.mahkemeKapaliFisilti')
                    : t('mesajSohbet.yargicFisilti')
                  : peer?.peer_agency_id
                    ? t('mesajSohbet.ajansFisilti')
                    : t('mesajSohbet.cevrimiciFisilti')}
              </Text>
            </Pressable>
            <View style={styles.aramaBtnlar}>
              {!mahkemeMi && !engelli ? (
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
                <Text style={styles.emptyChat}>{t('mesajSohbet.bosChat')}</Text>
                <Text style={styles.emptyChatAlt}>
                  {t('mesajSohbet.bosChatAlt')}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <MesajBaloncugu
                item={item}
                mine={item.sender_id === user?.id}
                peerLastReadAt={peerLastReadAt}
                onLongPress={() => mesajMenu(item)}
                onMedyaAc={(uri, tur) => setMedyaGoruntule({ uri, tur })}
                sharedPostOnizleme={
                  item.message_type === 'shared_post' && item.ref_id
                    ? sharedPostMap[item.ref_id]
                    : null
                }
                sharedPostYukleniyor={
                  item.message_type === 'shared_post' && sharedPostYukleniyor
                }
              />
            )}
          />

          {engelli ? (
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom, BoslukTokenlari.md) },
              ]}
            >
              <Text style={styles.kapaliUyari}>
                {t('mesajSohbet.engelliComposer')}
              </Text>
              <Pressable
                onPress={() =>
                  router.push('/engellenen-kullanicilar' as any)
                }
                style={{ marginTop: 8 }}
              >
                <Text
                  style={{
                    ...TipografiTokenlari.caption,
                    color: RenkTokenlari.primarySoft,
                    textAlign: 'center',
                    fontWeight: '700',
                  }}
                >{t('mesajSohbet.engellenenleriYonet')}</Text>
              </Pressable>
            </View>
          ) : mahkemeKapali ? (
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom, BoslukTokenlari.md) },
              ]}
            >
              <Text style={styles.kapaliUyari}>
                {t('mesajSohbet.mahkemeKapaliComposer')}
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
                setMedyaGoruntule(null);
                magaza.ac({
                  receiverId: peer.id,
                  aliciAdi: peer.display_name || peer.username,
                  animasyon: false,
                  onBasarili: (gift, adet) => {
                    void MesajGonder({
                      threadId,
                      body: t('mesajSohbet.hediyeGonderdi', { emoji: `🎁 ${gift.emoji}`, ad: gift.name, adet: adet > 1 ? ` ×${adet}` : '' }),
                      messageType: 'text',
                      clientId: uuidYerel(),
                    }).then((r) => {
                      if (r.ok) mergeMesaj(r.mesaj);
                    });
                  },
                });
              }}
              accessibilityLabel={t('mesajSohbet.hediyeA11y')}
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
                setMedyaGoruntule(null);
                setMedyaSecimAcik(true);
              }}
              accessibilityLabel={t('mesajSohbet.medyaGonderA11y')}
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
              placeholder={t('mesajSohbet.yazPlaceholder')}
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
            contentMediaUrl={MedyaUriGuvenli(raporIcerik?.mediaUrl)}
            isGuest={isGuest}
            onClose={() => {
              setGuvenlikAcik(false);
              setRaporIcerik(null);
            }}
            onBlocked={() => {
              setEngelli(true);
              setMesajlar([]);
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

        <MesajMedyaGoruntuleyici
          uri={medyaGoruntule?.uri ?? null}
          tur={medyaGoruntule?.tur ?? null}
          onKapat={() => setMedyaGoruntule(null)}
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
