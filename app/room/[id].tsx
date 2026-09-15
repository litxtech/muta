import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { guvenliGeriDon } from '../../src/components/EkranBasligi';
import { TamusoBanner } from '../../src/banner';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import {
  fetchRoom,
  fetchRoomSeats,
  joinRoom,
  leaveRoom,
} from '../../src/services/api';
import { OdayiSil } from '../../src/moduller/ses-odalari/islemler/OdayiSil';
import { HediyeKatalogunuGetir } from '../../src/moduller/hediyeler/okuma/HediyeKatalogunuGetir';
import { HediyeGonder } from '../../src/moduller/hediyeler/islemler/HediyeGonder';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import type { Gift, Room, RoomSeat } from '../../src/types/models';
import { colors, radii, typography } from '../../src/theme/colors';
import { HediyeAnimasyonuKuyrugu } from '../../src/moduller/hediyeler/animasyon/HediyeAnimasyonuKuyrugu';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { useOdaHediyeCanlisi } from '../../src/moduller/hediyeler/gercek-zamanli/useOdaHediyeCanlisi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { SesOdasiMikrofonDuzeni } from '../../src/moduller/ses-odalari/bilesenler/SesOdasiMikrofonDuzeni';
import { OdaCanliAtmosfer } from '../../src/moduller/ses-odalari/bilesenler/OdaCanliAtmosfer';
import {
  MedyaHoparlorAyarla,
  MedyaKonusmaciyaYukselt,
  MedyaMikrofonAyarla,
  MedyaOdasiBaglan,
  MedyaOdasiKes,
} from '../../src/moduller/livekit/MedyaBaglantisi';
import { KonusmaciSesSeviyesi } from '../../src/moduller/livekit/ses/KonusmaciSesSeviyesi';
import { YeniOdaOnbellektenAl } from '../../src/moduller/ses-odalari/onbellek/YeniOdaOnbellek';
import { MikrofonIstegiGonder } from '../../src/moduller/ses-odalari/mikrofon/MikrofonIstegiGonder';
import { MikrofonIstekPaneli } from '../../src/moduller/ses-odalari/bilesenler/MikrofonIstekPaneli';
import { PkMacBaslat } from '../../src/moduller/pk/islemler/PkMacBaslat';
import {
  KillSwitchAktifMi,
  OzellikBayragiAktifMi,
} from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { OdaDuzeniniCoz } from '../../src/moduller/ses-odalari/duzen/OdaDuzeniniCoz';
import { OdaModunuCoz } from '../../src/moduller/oda-olusturma/katalog/OdaModKatalogu';
import { OdaCanliYorumAkisi } from '../../src/moduller/oda-sohbeti/bilesenler/OdaCanliYorumAkisi';
import { OdaCanliYorumComposer } from '../../src/moduller/oda-sohbeti/bilesenler/OdaCanliYorumComposer';
import {
  OdaModerasyonUygula,
  type ModerasyonAksiyonu,
} from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { HediyeMagazaPaneli } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaPaneli';
import { HEDIYE_FALLBACK_50 } from '../../src/moduller/hediyeler/katalog/HediyeFallback50';
import { AnalyticsOlayEkle } from '../../src/moduller/guvenlik/analytics/AnalyticsOlayEkle';
import { OyunOdaLazyKatmani } from '../../src/moduller/oyunlar/oda/OyunOdaLazyKatmani';
import { useOdaOyunDaveti } from '../../src/moduller/oyunlar/ortak/hooks/useOdaOyunDaveti';
import { useGorunurOyunKodlari } from '../../src/moduller/oyunlar/ortak/hooks/useGorunurOyunKodlari';
import type { GameCode } from '../../src/moduller/oyunlar/ortak/tipler/OyunTipleri';
import { useKlavyeYuksekligi } from '../../src/bilesenler/klavye/useKlavyeYuksekligi';

/**
 * Sesli oda — TikTok / YouTube Live düzeni:
 * sahne (koltuklar) + sol alt yorum akışı + altta composer+dock (klavye üstüne çıkar).
 * Oyun motoru tembel yüklenir; odaya girişte donma olmaz.
 */
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refreshWallet, adjustWallet, isGuest, refreshProfile, wallet, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } = useMisafirIslemKapisi(isGuest);
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi(0);
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<RoomSeat[]>([]);
  const [gifts, setGifts] = useState<Gift[]>(HEDIYE_FALLBACK_50);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [cikiyor, setCikiyor] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [lastGift, setLastGift] = useState<string | null>(null);
  const [lkDurum, setLkDurum] = useState('Hazır');
  const [chatOpen, setChatOpen] = useState(true);
  const [yorumYenile, setYorumYenile] = useState(0);
  /** Oyun oturumu açıkken lazy katman unmount olmasın */
  const [oyunMonteli, setOyunMonteli] = useState(false);
  const konusmaciYukseltildi = React.useRef(false);

  const isDemo = useMemo(() => id?.startsWith('demo'), [id]);
  const isHost = !!user?.id && !!room?.host_id && user.id === room.host_id;
  const oyunPlatformAcik =
    OzellikBayragiAktifMi('games_enabled') && !KillSwitchAktifMi('kill_games');
  const {
    codes: gorunurOyunKodlari,
    anyVisible: herhangiOyunGorunur,
    yenile: gorunurOyunlariYenile,
  } = useGorunurOyunKodlari({
    enabled: oyunPlatformAcik && !isDemo,
  });
  const oyunlarAcik = oyunPlatformAcik && herhangiOyunGorunur;

  const { inviteSession, clearInvite } = useOdaOyunDaveti({
    roomId: room?.id,
    selfUserId: user?.id,
    enabled: !isDemo && oyunlarAcik && !!room?.id,
  });

  const filtreliDavet = useMemo(() => {
    if (!inviteSession) return null;
    if (!gorunurOyunKodlari.includes(inviteSession.game_code as GameCode)) {
      return null;
    }
    return inviteSession;
  }, [inviteSession, gorunurOyunKodlari]);

  useOdaHediyeCanlisi({
    roomId: room?.id,
    selfUserId: user?.id,
    gifts,
    enabled: !isDemo && !!room?.id,
  });

  /** Admin odayı kapattığında herkesi çıkar · feed zaten is_live=false ile düşer */
  React.useEffect(() => {
    if (!id || isDemo) return;
    const topic = `room-force-end-${id}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }
    const kanal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const next = payload.new as { is_live?: boolean } | null;
          if (next && next.is_live === false) {
            void MedyaOdasiKes();
            Alert.alert(
              'Oda kapatıldı',
              'Yönetim bu ses odasını kapattı. Feed’den kaldırıldı.',
              [{ text: 'Tamam', onPress: () => guvenliGeriDon('/(tabs)') }],
            );
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [id, isDemo]);

  const kendiKoltukta = useMemo(
    () => !!user?.id && seats.some((s) => s.user_id === user.id),
    [seats, user?.id],
  );

  const oyunAktif = gameOpen || oyunMonteli || Boolean(filtreliDavet);

  React.useEffect(() => {
    if (gameOpen || filtreliDavet) setOyunMonteli(true);
  }, [gameOpen, filtreliDavet]);

  /** Mikrofon kabulü sonrası konuşmacı token'ına yükselt */
  React.useEffect(() => {
    if (isDemo || !room || !user?.id || isHost) return;
    if (!kendiKoltukta || konusmaciYukseltildi.current) return;
    konusmaciYukseltildi.current = true;
    const roomName = room.livekit_room_name ?? `voice_${room.id}`;
    void (async () => {
      const medya = await MedyaKonusmaciyaYukselt(roomName);
      if (medya.ok) {
        setMuted(false);
        MedyaMikrofonAyarla(true);
        MedyaHoparlorAyarla(true);
        setLkDurum(medya.mock ? `Demo · konuşmacı` : `Bağlı · konuşmacı`);
      } else {
        konusmaciYukseltildi.current = false;
        Alert.alert('Mikrofon', medya.hata ?? 'Konuşmacı bağlantısı kurulamadı');
      }
    })();
  }, [isDemo, room, user?.id, isHost, kendiKoltukta]);

  /** Koltuk değişiklikleri (mic kabul / ayrılma) */
  React.useEffect(() => {
    if (isDemo || !room?.id) return;
    const yenile = () => {
      void fetchRoomSeats(room.id).then(setSeats).catch(() => undefined);
    };
    const channel = supabase
      .channel(`oda-koltuk-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_seats',
          filter: `room_id=eq.${room.id}`,
        },
        yenile,
      )
      .subscribe();
    const poll = setInterval(yenile, 8_000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [isDemo, room?.id]);

  const odadanAyril = useCallback(
    async (odayiSil: boolean) => {
      if (cikiyor) return;
      setCikiyor(true);
      try {
        KonusmaciSesSeviyesi.mockDurdur();
        await MedyaOdasiKes();
        if (user?.id && room && !isDemo) {
          if (odayiSil && isHost) {
            const r = await OdayiSil(room.id);
            if (!r.ok) {
              Alert.alert('Oda', r.hata);
              setCikiyor(false);
              return;
            }
            await leaveRoom(room.id, user.id).catch(() => undefined);
            void AnalyticsOlayEkle('room_delete', { room_id: room.id });
          } else {
            await leaveRoom(room.id, user.id).catch(() => undefined);
            void AnalyticsOlayEkle('room_leave', { room_id: room.id });
          }
        }
        guvenliGeriDon('/(tabs)');
      } finally {
        setCikiyor(false);
      }
    },
    [cikiyor, user?.id, room, isDemo, isHost],
  );

  const odadanCik = useCallback(() => {
    if (cikiyor) return;
    if (isHost && !isDemo) {
      Alert.alert('Oda', 'Ne yapmak istersin?', [
        { text: 'Kal', style: 'cancel' },
        {
          text: 'Sadece çık',
          onPress: () => void odadanAyril(false),
        },
        {
          text: 'Odayı sil',
          style: 'destructive',
          onPress: () => void odadanAyril(true),
        },
      ]);
      return;
    }
    Alert.alert('Odadan çık', 'Sesli odadan ayrılmak istiyor musun?', [
      { text: 'Kal', style: 'cancel' },
      {
        text: 'Çık',
        style: 'destructive',
        onPress: () => void odadanAyril(false),
      },
    ]);
  }, [cikiyor, isHost, isDemo, odadanAyril]);

  const mikrofonToggle = useCallback(() => {
    void islemiDene('mikrofon', async () => {
      if (isDemo) {
        setMuted((m) => !m);
        return;
      }
      if (!room) return;

      // Oda sahibi / koltuktaki konuşmacı: istek yok, doğrudan aç-kapa
      if (isHost || kendiKoltukta) {
        const sonraki = !muted;
        setMuted(sonraki);
        MedyaMikrofonAyarla(!sonraki);
        return;
      }

      // Dinleyici: host'a mikrofon isteği
      if (muted) {
        const r = await MikrofonIstegiGonder(room.id);
        if (!r.ok) {
          Alert.alert('Mikrofon', r.hata ?? 'İstek gönderilemedi');
          return;
        }
        Alert.alert(
          'Mikrofon',
          'İstek gönderildi. Host kabul edince koltuğa oturursun.',
        );
      }
    });
  }, [islemiDene, isDemo, room, isHost, kendiKoltukta, muted]);
  const moderasyonUygula = (targetUserId: string, action: ModerasyonAksiyonu) => {
    if (!room || isDemo) {
      Alert.alert('Demo', 'Gerçek odada moderasyon migration 010 ile çalışır.');
      return;
    }
    void (async () => {
      const r = await OdaModerasyonUygula({
        roomId: room.id,
        targetUserId,
        action,
      });
      if (!r.ok) Alert.alert('Moderasyon', r.hata);
      else {
        Alert.alert('Tamam', `${action} uygulandı`);
        await load();
      }
    })();
  };

  const hostModMenu = () => {
    const targets = seats.filter((s) => s.user_id && s.user_id !== user?.id);
    if (targets.length === 0) {
      Alert.alert('Moderasyon', 'Hedef konuşmacı yok.');
      return;
    }
    const seat = targets[0];
    const name = seat.profile?.display_name ?? seat.user_id!.slice(0, 8);
    Alert.alert(`Moderasyon · ${name}`, 'Aksiyon seç', [
      { text: 'Sessize al', onPress: () => moderasyonUygula(seat.user_id!, 'mute') },
      { text: 'Odadan at', onPress: () => moderasyonUygula(seat.user_id!, 'kick') },
      {
        text: 'Yasakla',
        style: 'destructive',
        onPress: () => moderasyonUygula(seat.user_id!, 'ban'),
      },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const load = useCallback(async () => {
    if (!id || isDemo) {
      setRoom({
        id: id ?? 'demo',
        host_id: 'demo',
        title: 'Demo canlı oda',
        topic: 'Ses + hediye önizleme',
        cover_url: null,
        mode: 'dating',
        max_seats: 8,
        is_live: true,
        is_locked: false,
        listener_count: 42,
        total_coins_earned: 900,
        created_at: new Date().toISOString(),
        layout_code: 'floating_glass',
      });
      setSeats(
        Array.from({ length: 8 }, (_, seat_index) => ({
          id: `s${seat_index}`,
          room_id: id ?? 'demo',
          seat_index,
          user_id: seat_index === 0 ? 'demo' : null,
          is_muted: false,
          is_locked: false,
          profile:
            seat_index === 0
              ? {
                  id: 'demo',
                  username: 'host',
                  display_name: 'Ev sahibi',
                  bio: '',
                  avatar_url: null,
                  gender: 'female',
                  birth_date: null,
                  country: null,
                  language: 'tr',
                  is_host: true,
                  is_verified: true,
                  level: 10,
                  xp: 0,
                  created_at: new Date().toISOString(),
                }
              : null,
        })),
      );
      KonusmaciSesSeviyesi.mockBaslat('demo');
      setLkDurum('Demo');
      setLoading(false);
      return;
    }

    try {
      // Yeni açılan oda: önbellekten anında UI — kullanıcı beklemesin
      const onbellek = YeniOdaOnbellektenAl(id);
      if (onbellek) {
        setRoom(onbellek.room);
        setSeats(onbellek.seats);
        setLoading(false);
        if (user?.id === onbellek.room.host_id) {
          setMuted(false);
          konusmaciYukseltildi.current = true;
        }
      } else {
        setLoading(true);
      }

      // Hediyeler UI'ı bloklamasın
      void HediyeKatalogunuGetir()
        .then((g) => {
          if (g.length >= 20) setGifts(g);
          else if (g.length) {
            setGifts(
              [
                ...g,
                ...HEDIYE_FALLBACK_50.filter((f) => !g.some((x) => x.code === f.code)),
              ].slice(0, 50),
            );
          }
        })
        .catch(() => undefined);

      const [r, s] = await Promise.all([
        onbellek ? Promise.resolve(onbellek.room) : fetchRoom(id),
        onbellek
          ? fetchRoomSeats(id).catch(() => onbellek.seats)
          : fetchRoomSeats(id),
      ]);

      if (!r || !r.is_live) {
        setRoom(null);
        Alert.alert('Oda', 'Bu oda artık canlı değil');
        guvenliGeriDon('/(tabs)');
        return;
      }
      setRoom(r);
      setSeats(s);
      setLoading(false);

      const hostMu = !!user?.id && user.id === r.host_id;
      if (user?.id) {
        // Host createRoom'da zaten üye — await etme
        void joinRoom(id, user.id, hostMu ? 'host' : 'listener').catch(
          () => undefined,
        );
        void AnalyticsOlayEkle('room_join', { room_id: id });
      }

      const roomName = r.livekit_room_name ?? `voice_${id}`;
      setLkDurum('Ses bağlanıyor…');
      const medya = await MedyaOdasiBaglan({
        roomName,
        role: hostMu ? 'host' : 'listener',
      });
      if (medya.ok) {
        setLkDurum(medya.mock ? `Demo · ${medya.saglayici}` : `Bağlı · ${medya.saglayici}`);
        MedyaHoparlorAyarla(true);
        if (hostMu) {
          setMuted(false);
          MedyaMikrofonAyarla(true);
          konusmaciYukseltildi.current = true;
        }
        if (medya.mock && r.host_id) KonusmaciSesSeviyesi.mockBaslat(r.host_id);
      } else {
        setLkDurum(medya.hata ?? 'Bağlantı hatası');
        if (hostMu) {
          Alert.alert(
            'Ses bağlantısı',
            medya.hata ??
              'Mikrofon yayınlanamadı. İzinleri kontrol edip odadan çıkıp tekrar dene.',
          );
        }
      }
    } catch (e) {
      Alert.alert('Oda yüklenemedi', e instanceof Error ? e.message : 'Hata');
      setLoading(false);
    }
  }, [id, isDemo, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      void (async () => {
        await load();
        if (iptal) {
          void MedyaOdasiKes();
        }
      })();
      return () => {
        iptal = true;
        KonusmaciSesSeviyesi.mockDurdur();
        void MedyaOdasiKes();
      };
    }, [load]),
  );

  const onSendGift = (gift: Gift, quantity = 1) => {
    if (!user || !room) return;
    const adet = Math.max(1, quantity);
    islemiDene('hediye_gonder', async () => {
      if (isDemo) {
        setLastGift(`${gift.emoji} ${gift.name}${adet > 1 ? ` x${adet}` : ''}`);
        HediyeAnimasyonuKuyrugu.ekle({
          giftId: gift.id,
          emoji: gift.emoji,
          name: adet > 1 ? `${gift.name} x${adet}` : gift.name,
          senderName: profile?.display_name ?? profile?.username ?? 'Sen',
          durationMs: 2200,
          fullScreen: gift.coin_cost >= 999 || adet >= 77,
          coinCost: gift.coin_cost,
          quantity: adet,
        });
        setTimeout(() => setLastGift(null), 1800);
        return;
      }
      if (gift.id.startsWith('fb_')) {
        Alert.alert('Hediye', 'Katalog yükleniyor — biraz sonra dene.');
        return;
      }
      const sonuc = await HediyeGonder({
        giftId: gift.id,
        receiverId: room.host_id,
        roomId: room.id,
        quantity: adet,
      });
      if (!sonuc.ok) {
        Alert.alert('Hediye', sonuc.hata ?? 'Gönderilemedi');
        return;
      }
      if (typeof sonuc.coinsAfter === 'number') {
        adjustWallet({ coins: sonuc.coinsAfter });
      } else {
        void refreshWallet();
      }
      setLastGift(`${gift.emoji} ${gift.name}${adet > 1 ? ` x${adet}` : ''}`);
      HediyeAnimasyonuKuyrugu.ekle({
        giftId: gift.id,
        emoji: gift.emoji,
        name: adet > 1 ? `${gift.name} x${adet}` : gift.name,
        senderName: profile?.display_name ?? profile?.username ?? 'Sen',
        durationMs: 2200,
        fullScreen: gift.coin_cost >= 999 || adet >= 77,
        coinCost: gift.coin_cost,
        quantity: adet,
      });
      setTimeout(() => setLastGift(null), 1800);
      void AnalyticsOlayEkle('gift_send', {
        gift_id: gift.id,
        room_id: room.id,
        quantity: adet,
      });
      setGiftOpen(false);
    });
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 80 }}>
          Oda bulunamadı
        </Text>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <LinearGradient colors={[...colors.gradientRoom]} style={StyleSheet.absoluteFill} />

      <View style={styles.root}>
        {/* SAHNE — boş alana dokununca klavye kapansın */}
        <Pressable
          style={styles.stage}
          onPress={Keyboard.dismiss}
          accessible={false}
        >
          <OdaCanliAtmosfer />
          <View style={styles.topBar}>
            <Pressable
              onPress={odadanCik}
              disabled={cikiyor}
              style={styles.iconBtn}
              accessibilityLabel="Odadan çık"
            >
              <Ionicons name="chevron-down" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topMeta}>
              <Text style={styles.roomTitle} numberOfLines={1}>
                {room.title}
              </Text>
              <Text style={styles.roomTopic} numberOfLines={1}>
                {OdaDuzeniniCoz(room.layout_code).ad} · {OdaModunuCoz(room.mode).ad}
                {room.topic ? ` · ${room.topic}` : ''}
                {` · ${lkDurum}`}
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{room.listener_count}</Text>
            </View>
          </View>

          <TamusoBanner placement="VOICE_ROOM_TOP" screen="VOICE_ROOM" compact />

          <View style={styles.seatsWrap} pointerEvents="box-none">
            <SesOdasiMikrofonDuzeni seats={seats} layoutCode={room.layout_code} />
          </View>

          {isHost && !isDemo ? (
            <View style={styles.micIstekWrap} pointerEvents="box-none">
              <ModulHataSiniri modulAdi="mikrofon-istek" varyant="kart">
                <MikrofonIstekPaneli
                  roomId={room.id}
                  onDegisti={() => {
                    void fetchRoomSeats(room.id).then(setSeats).catch(() => undefined);
                  }}
                />
              </ModulHataSiniri>
            </View>
          ) : null}

          {lastGift ? (
            <View style={styles.giftToast}>
              <Text style={styles.giftToastText}>{lastGift} gönderildi!</Text>
            </View>
          ) : null}

          {/* Yorumlar — sol/sağ kenara yapışık, tam genişlik */}
          {chatOpen && !isDemo ? (
            <View
              style={[styles.yorumOverlay, klavyeAcik && styles.yorumOverlayKlavye]}
              pointerEvents="box-none"
            >
              <ModulHataSiniri modulAdi="oda-sohbeti" varyant="kart">
                <OdaCanliYorumAkisi
                  roomId={room.id}
                  currentUserId={user?.id}
                  hostId={room.host_id}
                  yenileSinyali={yorumYenile}
                  onClose={() => setChatOpen(false)}
                />
              </ModulHataSiniri>
            </View>
          ) : null}
        </Pressable>

        {/* ALT BAR — composer üst satır, aksiyonlar alt satır (iç içe girmez) */}
        <View
          style={[
            styles.altBar,
            {
              marginBottom:
                Platform.OS === 'android' && klavyeAcik ? klavyeH : 0,
              paddingBottom: klavyeAcik
                ? Platform.OS === 'android'
                  ? 8
                  : Math.max(8, klavyeH)
                : Math.max(10, insets.bottom + 8),
            },
          ]}
        >
          {!chatOpen && !isDemo ? (
            <Pressable
              style={styles.chatPeek}
              onPress={() => {
                setGiftOpen(false);
                setChatOpen(true);
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color={colors.mint} />
              <Text style={styles.chatPeekText}>Yorumları aç</Text>
            </Pressable>
          ) : null}

          {chatOpen && !isDemo ? (
            <View style={styles.composerRow}>
              <OdaCanliYorumComposer
                roomId={room.id}
                canSend={!isGuest}
                onNeedUpgrade={upgradeAc}
                onSent={() => {
                  setYorumYenile((n) => n + 1);
                  Keyboard.dismiss();
                }}
              />
            </View>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.controls}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={mikrofonToggle} style={styles.controlBtn}>
              <Ionicons
                name={muted ? 'mic-off' : 'mic'}
                size={22}
                color={muted ? colors.textMuted : colors.micOn}
              />
            </Pressable>

            {!klavyeAcik ? (
              <Pressable
                onPress={() =>
                  islemiDene('hediye_gonder', () => {
                    setGiftOpen((v) => !v);
                  })
                }
                style={styles.giftBtn}
              >
                <LinearGradient colors={[...colors.gradientPrimary]} style={styles.giftBtnInner}>
                  <Text style={styles.giftBtnText}>🎁</Text>
                </LinearGradient>
              </Pressable>
            ) : null}

            {!klavyeAcik ? (
              <Pressable
                onPress={() => {
                  setGiftOpen(false);
                  if (isDemo) {
                    Alert.alert('Sohbet', 'Demo odada sohbet yok.');
                    return;
                  }
                  setChatOpen((v) => !v);
                }}
                style={styles.controlBtn}
              >
                <Ionicons
                  name="chatbubble-ellipses"
                  size={22}
                  color={chatOpen ? colors.mint : colors.textMuted}
                />
              </Pressable>
            ) : null}

            {oyunlarAcik && !isDemo && !klavyeAcik ? (
              <Pressable
                onPress={() =>
                  islemiDene('oyun_baslat', () => {
                    setGiftOpen(false);
                    if (!isHost) {
                      Alert.alert(
                        'Oyunlar',
                        'Oyunu oda sahibi başlatır. Davet geldiğinde katılabilirsin.',
                      );
                      return;
                    }
                    void gorunurOyunlariYenile();
                    setGameOpen(true);
                  })
                }
                style={styles.controlBtn}
              >
                <Ionicons
                  name="game-controller"
                  size={22}
                  color={gameOpen ? colors.accent : colors.textMuted}
                />
              </Pressable>
            ) : null}

            {isHost && !klavyeAcik ? (
              <Pressable onPress={hostModMenu} style={styles.controlBtn}>
                <Ionicons name="shield" size={22} color={colors.accent} />
              </Pressable>
            ) : null}

            {isHost && !isDemo && !klavyeAcik && OzellikBayragiAktifMi('pk_enabled') ? (
              <Pressable
                onPress={() =>
                  islemiDene('pk_baslat', async () => {
                    const r = await PkMacBaslat({
                      roomAId: room.id,
                      sureSaniye: 300,
                    });
                    if (!r.ok) {
                      Alert.alert('PK', r.hata);
                      return;
                    }
                    Alert.alert('PK başladı', '5 dk canlı arena. Hediyeler skor ekler.', [
                      {
                        text: 'Arenaya git',
                        onPress: () => router.push('/pk' as any),
                      },
                      { text: 'Tamam' },
                    ]);
                  })
                }
                style={styles.controlBtn}
              >
                <Ionicons name="flash" size={22} color="#F0B429" />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <ModulHataSiniri modulAdi="hediyeler" varyant="kart">
        <HediyeMagazaPaneli
          visible={giftOpen}
          gifts={gifts}
          coins={wallet?.coins}
          aliciAdi={room.host?.display_name ?? room.host?.username ?? 'Ev sahibi'}
          onSend={onSendGift}
          onClose={() => setGiftOpen(false)}
          onCoinYukle={() => {
            setGiftOpen(false);
            router.push('/(tabs)/wallet' as any);
          }}
        />
      </ModulHataSiniri>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={upgradeKapat}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
      <HediyeAnimasyonKatmani />

      <TamusoBanner placement="VOICE_ROOM_BOTTOM" screen="VOICE_ROOM" compact />

      {oyunlarAcik && room && user ? (
        <ModulHataSiniri modulAdi="oyunlar" varyant="kart">
          <OyunOdaLazyKatmani
            aktif={oyunAktif}
            roomMeta={{
              roomId: room.id,
              roomName: room.title ?? 'Ses Odası',
              participantCount: seats.filter((s) => s.user_id).length,
              micEnabled: !muted,
            }}
            isHost={isHost}
            selfUserId={user.id}
            hostDisplayName={profile?.display_name ?? room.host_id?.slice(0, 8) ?? 'Host'}
            startModalVisible={gameOpen && isHost}
            onStartModalClose={() => setGameOpen(false)}
            inviteSession={filtreliDavet}
            onInviteDismiss={() => {
              clearInvite();
              setOyunMonteli(false);
            }}
            onOverlayClosed={() => {
              setGameOpen(false);
              setOyunMonteli(false);
              clearInvite();
            }}
            visibleGameCodes={gorunurOyunKodlari}
          />
        </ModulHataSiniri>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  seatsWrap: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
    flexShrink: 0,
    zIndex: 3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMeta: { flex: 1, minWidth: 0 },
  roomTitle: { ...typography.h1, color: colors.text },
  roomTopic: { ...typography.caption, color: colors.textMuted },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,61,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  liveText: { ...typography.caption, color: colors.primarySoft, fontWeight: '700' },
  giftToast: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,61,129,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    flexShrink: 0,
    zIndex: 4,
  },
  giftToastText: { ...typography.body, color: colors.text, fontWeight: '700' },
  micIstekWrap: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 8,
  },
  yorumOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    height: '38%',
    maxHeight: 280,
    minHeight: 140,
    zIndex: 5,
    paddingHorizontal: 10,
  },
  yorumOverlayKlavye: {
    height: '32%',
    maxHeight: 200,
    minHeight: 100,
  },
  altBar: {
    flexShrink: 0,
    gap: 8,
    paddingTop: 8,
    backgroundColor: 'rgba(8,6,14,0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  composerRow: {
    paddingHorizontal: 12,
    width: '100%',
  },
  chatPeek: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(12,10,18,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatPeekText: {
    ...typography.caption,
    color: colors.mint,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 10,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  giftBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    flexShrink: 0,
  },
  giftBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBtnText: { fontSize: 20 },
});
