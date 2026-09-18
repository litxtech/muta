import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { TamusoBanner } from '../../src/banner';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import {
  fetchRoom,
  fetchRoomSeats,
  joinRoom,
  leaveRoom,
} from '../../src/services/api';
import { OdadanCikisYonlendir } from '../../src/moduller/ses-odalari/navigasyon/OdadanCikisYonlendir';
import { OdaCikisKilidiAktifMi } from '../../src/moduller/ses-odalari/navigasyon/OdaCikisKilidi';
import { OdayiSil } from '../../src/moduller/ses-odalari/islemler/OdayiSil';
import { HediyeKatalogunuGetir } from '../../src/moduller/hediyeler/okuma/HediyeKatalogunuGetir';
import { HediyeGonder } from '../../src/moduller/hediyeler/islemler/HediyeGonder';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import type { Gift, Profile, Room, RoomSeat } from '../../src/types/models';
import { ProfilGetir } from '../../src/moduller/kullanici-profili/okuma/ProfilGetir';
import type { CanliSohbetMesajGorunum } from '../../src/moduller/canli-sohbet/bilesenler/CanliSohbetMesajKarti';
import { colors, radii, typography } from '../../src/theme/colors';
import { HediyeAnimasyonuKuyrugu } from '../../src/moduller/hediyeler/animasyon/HediyeAnimasyonuKuyrugu';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { useOdaHediyeCanlisi } from '../../src/moduller/hediyeler/gercek-zamanli/useOdaHediyeCanlisi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { SesOdasiMikrofonDuzeni } from '../../src/moduller/ses-odalari/bilesenler/SesOdasiMikrofonDuzeni';
import { SahipGirisAnimasyonu } from '../../src/moduller/ses-odalari/bilesenler/SahipGirisAnimasyonu';
import { SeviyeGirisAnimasyonu } from '../../src/moduller/ses-odalari/bilesenler/SeviyeGirisAnimasyonu';
import { useOdaSeviyeGiris } from '../../src/moduller/ses-odalari/animasyon/useOdaSeviyeGiris';
import { OdaCanliAtmosfer } from '../../src/moduller/ses-odalari/bilesenler/OdaCanliAtmosfer';
import { OdaSahneArkaPlan } from '../../src/moduller/ses-odalari/bilesenler/OdaSahneArkaPlan';
import { OdaProfilCubugu } from '../../src/moduller/ses-odalari/bilesenler/OdaProfilCubugu';
import { OdaProfilKartiPaneli } from '../../src/moduller/ses-odalari/bilesenler/OdaProfilKartiPaneli';
import { LiderligiDevret } from '../../src/moduller/ses-odalari/islemler/LiderligiDevret';
import {
  MedyaHoparlorAyarla,
  MedyaKonusmaciyaYukselt,
  MedyaDinleyiciyeDusur,
  MedyaMikrofonAyarla,
  MedyaOdasiBaglan,
  MedyaOdasiKes,
  MedyaSesOturumunuYenile,
  MedyaUzakSesHacmiAyarla,
  MedyaYayinciMi,
} from '../../src/moduller/livekit/MedyaBaglantisi';
import {
  YardimciLiderAta,
  YardimciLiderKaldir,
} from '../../src/moduller/ses-odalari/islemler/YardimciLiderAta';
import { KonusmaciSesSeviyesi } from '../../src/moduller/livekit/ses/KonusmaciSesSeviyesi';
import { YeniOdaOnbellektenAl } from '../../src/moduller/ses-odalari/onbellek/YeniOdaOnbellek';
import {
  AktifSesOdasiArkaPlanaAl,
  AktifSesOdasiArkaPlandaMi,
  AktifSesOdasiBaslat,
  AktifSesOdasiBitir,
  AktifSesOdasiDurumunuAl,
  AktifSesOdasiGuncelle,
  AktifSesOdasiOneCikar,
} from '../../src/moduller/ses-odalari/oturum/AktifSesOdasiOturumu';
import { MikrofonIstegiGonder } from '../../src/moduller/ses-odalari/mikrofon/MikrofonIstegiGonder';
import { HostTahtaOtur } from '../../src/moduller/ses-odalari/islemler/HostTahtaOtur';
import { MikrofonIstekPaneli } from '../../src/moduller/ses-odalari/bilesenler/MikrofonIstekPaneli';
import { OdaDinleyiciPaneli } from '../../src/moduller/ses-odalari/bilesenler/OdaDinleyiciPaneli';
import {
  ODA_DOCK_BTN,
  ODA_DOCK_ICON,
} from '../../src/moduller/ses-odalari/bilesenler/OdaButonOlculeri';
import { OdaKapakDuzenlePaneli } from '../../src/moduller/ses-odalari/bilesenler/OdaKapakDuzenlePaneli';
import { OdaOyunDockButonu } from '../../src/moduller/ses-odalari/bilesenler/OdaOyunDockButonu';
import { OdaCanliYorumAkisi } from '../../src/moduller/oda-sohbeti/bilesenler/OdaCanliYorumAkisi';
import { OdaCanliYorumComposer } from '../../src/moduller/oda-sohbeti/bilesenler/OdaCanliYorumComposer';
import { CanliYorumCekilebilirKart } from '../../src/moduller/canli-sohbet/bilesenler/CanliYorumCekilebilirKart';
import {
  OdaModerasyonUygula,
  type ModerasyonAksiyonu,
} from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { HediyeMagazaPaneli } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaPaneli';
import { CoinYuklePaneli } from '../../src/moduller/cuzdan/bilesenler/CoinYuklePaneli';
import { useCoinYuklePaneli } from '../../src/moduller/cuzdan/islemler/useCoinYuklePaneli';
import { HEDIYE_FALLBACK_50 } from '../../src/moduller/hediyeler/katalog/HediyeFallback50';
import { AnalyticsOlayEkle } from '../../src/moduller/guvenlik/analytics/AnalyticsOlayEkle';
import { OyunOdaLazyKatmani } from '../../src/moduller/oyunlar/oda/OyunOdaLazyKatmani';
import { useGorunurOyunKodlari } from '../../src/moduller/oyunlar/ortak/hooks/useGorunurOyunKodlari';
import type { GameCode } from '../../src/moduller/oyunlar/ortak/tipler/OyunTipleri';
import { useKlavyeYuksekligi } from '../../src/bilesenler/klavye/useKlavyeYuksekligi';

/**
 * Sesli oda — sahne (koltuklar) + alt panelde yorum akışı + composer + dock.
 * Yorum input sol altta; kontrol butonları sağında.
 * Oyun motoru tembel yüklenir; odaya girişte donma olmaz.
 */

function koltuklarEsit(a: RoomSeat[], b: RoomSeat[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.user_id !== y.user_id ||
      x.is_muted !== y.is_muted ||
      x.seat_index !== y.seat_index ||
      x.profile?.avatar_url !== y.profile?.avatar_url ||
      x.profile?.display_name !== y.profile?.display_name ||
      x.profile?.username !== y.profile?.username ||
      x.profile?.level !== y.profile?.level ||
      x.is_cohost !== y.is_cohost
    ) {
      return false;
    }
  }
  return true;
}

/** Strict Mode / Fast Refresh ayni topic'e ikinci .on() eklemesin. */
function odaRealtimeKanaliniTemizle(imza: string) {
  for (const ch of supabase.getChannels()) {
    const topic = ch.topic ?? '';
    if (topic === imza || topic === `realtime:${imza}` || topic.includes(imza)) {
      void supabase.removeChannel(ch);
    }
  }
}

export default function RoomScreen() {
  const { id, oyun: oyunParam } = useLocalSearchParams<{ id: string; oyun?: string }>();
  const { user, refreshWallet, adjustWallet, isGuest, refreshProfile, wallet, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } = useMisafirIslemKapisi(isGuest);
  const coinYukle = useCoinYuklePaneli();
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi(0);
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<RoomSeat[]>([]);
  const [gifts, setGifts] = useState<Gift[]>(HEDIYE_FALLBACK_50);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [memberRole, setMemberRole] = useState<
    'host' | 'cohost' | 'speaker' | 'listener' | null
  >(null);
  const [cikiyor, setCikiyor] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [odaKartAcik, setOdaKartAcik] = useState(false);
  const [profilKart, setProfilKart] = useState<{
    userId: string;
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    level?: number | null;
    coins?: number | null;
    diamonds?: number | null;
    baslik?: string;
  } | null>(null);
  const [hostProfilYedek, setHostProfilYedek] = useState<Profile | null>(null);
  const [balonOyunKodu, setBalonOyunKodu] = useState<GameCode | null>(null);
  const [lastGift, setLastGift] = useState<string | null>(null);
  const [lkDurum, setLkDurum] = useState('Hazır');
  const [chatOpen, setChatOpen] = useState(true);
  const [yorumYenile, setYorumYenile] = useState(0);
  /** Oyun oturumu açıkken lazy katman unmount olmasın */
  const [oyunMonteli, setOyunMonteli] = useState(false);
  const [sahipGiris, setSahipGiris] = useState<{
    ad: string;
    avatarUrl: string | null;
  } | null>(null);
  const konusmaciYukseltildi = React.useRef(false);
  /** Focus remount — gecikmeli disconnect'i iptal etmek için */
  const odaFocusNesil = React.useRef(0);
  const sahipTahtOnceki = React.useRef<boolean | null>(null);

  const isDemo = useMemo(() => id?.startsWith('demo'), [id]);
  const isHost = !!user?.id && !!room?.host_id && user.id === room.host_id;
  const isCohost =
    !isHost &&
    (memberRole === 'cohost' ||
      (!!user?.id && seats.some((s) => s.user_id === user.id && s.is_cohost)));
  const isModerator = isHost || isCohost;

  const seviyeGirisSelf = useMemo(() => {
    if (!user?.id || isDemo) return null;
    const level = typeof profile?.level === 'number' ? profile.level : 0;
    return {
      userId: user.id,
      ad:
        profile?.display_name?.trim() ||
        profile?.username?.trim() ||
        'Sen',
      avatarUrl: profile?.avatar_url ?? null,
      level,
    };
  }, [
    user?.id,
    isDemo,
    profile?.level,
    profile?.display_name,
    profile?.username,
    profile?.avatar_url,
  ]);

  const { aktif: seviyeGiris, bitti: seviyeGirisBitti } = useOdaSeviyeGiris({
    roomId: !isDemo && room?.id ? room.id : null,
    enabled: !loading && !isDemo && !!room?.id,
    self: seviyeGirisSelf,
  });

  const {
    codes: gorunurOyunKodlari,
    anyVisible: herhangiOyunGorunur,
    platformAcik: oyunPlatformAcik,
    yenile: gorunurOyunlariYenile,
  } = useGorunurOyunKodlari({
    enabled: !isDemo,
  });
  const oyunlarAcik = oyunPlatformAcik && herhangiOyunGorunur;

  useFocusEffect(
    useCallback(() => {
      if (!isDemo) void gorunurOyunlariYenile();
    }, [isDemo, gorunurOyunlariYenile]),
  );

  React.useEffect(() => {
    const kod = Array.isArray(oyunParam) ? oyunParam[0] : oyunParam;
    if (!kod || isDemo) return;
    setBalonOyunKodu(kod as GameCode);
    setGameOpen(true);
    setOyunMonteli(true);
  }, [oyunParam, isDemo]);

  useOdaHediyeCanlisi({
    roomId: room?.id,
    selfUserId: user?.id,
    gifts,
    enabled: !isDemo && !!room?.id,
  });

  /** Admin odayı kapattığında herkesi çıkar · feed zaten is_live=false ile düşer */
  React.useEffect(() => {
    if (!id || isDemo) return;
    const imza = `room-force-end-${id}`;
    odaRealtimeKanaliniTemizle(imza);
    const topic = `${imza}-${Date.now().toString(36)}`;
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
          const next = payload.new as {
            is_live?: boolean;
            host_id?: string;
            max_seats?: number;
            microphone_capacity?: number | null;
            capacity_tier_code?: string | null;
            cover_url?: string | null;
            theme_code?: string | null;
            title?: string;
            topic?: string | null;
          } | null;
          if (next?.host_id) {
            setRoom((prev) =>
              prev ? { ...prev, host_id: next.host_id as string } : prev,
            );
          }
          if (
            next &&
            (next.cover_url !== undefined ||
              next.theme_code !== undefined ||
              next.title !== undefined ||
              next.topic !== undefined)
          ) {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    ...(next.cover_url !== undefined
                      ? { cover_url: next.cover_url }
                      : null),
                    ...(next.theme_code !== undefined
                      ? { theme_code: next.theme_code }
                      : null),
                    ...(next.title !== undefined ? { title: next.title } : null),
                    ...(next.topic !== undefined ? { topic: next.topic } : null),
                  }
                : prev,
            );
            if (next.title) AktifSesOdasiGuncelle({ title: next.title });
          }
          if (
            next &&
            (next.max_seats != null ||
              next.microphone_capacity != null ||
              next.capacity_tier_code != null)
          ) {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    ...(next.max_seats != null
                      ? { max_seats: next.max_seats }
                      : null),
                    ...(next.microphone_capacity != null
                      ? { microphone_capacity: next.microphone_capacity }
                      : null),
                    ...(next.capacity_tier_code != null
                      ? { capacity_tier_code: next.capacity_tier_code }
                      : null),
                  }
                : prev,
            );
            void fetchRoomSeats(id)
              .then((s) => {
                setSeats((prev) => (koltuklarEsit(prev, s) ? prev : s));
              })
              .catch(() => undefined);
          }
          if (next && next.is_live === false) {
            void MedyaOdasiKes();
            AktifSesOdasiBitir();
            // Host odayı kendisi sildiyse zaten çıkış yönlendirmesi çalışıyor
            if (OdaCikisKilidiAktifMi()) return;
            Alert.alert(
              'Oda kapatıldı',
              'Yönetim bu ses odasını kapattı. Feed’den kaldırıldı.',
              [{ text: 'Tamam', onPress: () => OdadanCikisYonlendir() }],
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

  const koltukUserIds = useMemo(
    () =>
      seats
        .map((s) => s.user_id)
        .filter((id): id is string => !!id),
    [seats],
  );

  const sahipTahtta = useMemo(() => {
    if (!room?.host_id) return false;
    return seats.some(
      (s) => s.seat_index === 0 && s.user_id === room.host_id,
    );
  }, [seats, room?.host_id]);

  /** Oda sahibi tahta oturunca giriş animasyonu */
  const oncekiHostIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (loading || !room?.host_id) return;

    if (
      oncekiHostIdRef.current !== null &&
      oncekiHostIdRef.current !== room.host_id
    ) {
      sahipTahtOnceki.current = false;
    }
    oncekiHostIdRef.current = room.host_id;

    if (sahipTahtOnceki.current === null) {
      sahipTahtOnceki.current = sahipTahtta;
      return;
    }
    if (!sahipTahtOnceki.current && sahipTahtta) {
      const taht = seats.find(
        (s) => s.seat_index === 0 && s.user_id === room.host_id,
      );
      const ad =
        taht?.profile?.display_name?.trim() ||
        taht?.profile?.username?.trim() ||
        'Oda sahibi';
      setSahipGiris({
        ad,
        avatarUrl: taht?.profile?.avatar_url ?? null,
      });
    }
    sahipTahtOnceki.current = sahipTahtta;
  }, [loading, room?.host_id, sahipTahtta, seats]);

  const oyunAktif = gameOpen || oyunMonteli;

  React.useEffect(() => {
    if (gameOpen) setOyunMonteli(true);
  }, [gameOpen]);

  /** Başvuru kabul edilmeden / koltuktan düşünce ses yayınlanmaz */
  React.useEffect(() => {
    if (isDemo || isHost || !user?.id || !room) return;
    if (kendiKoltukta) return;
    // Profil ziyaretinde koltuk state geçici boşalırsa mic'i ezme
    if (AktifSesOdasiArkaPlandaMi()) return;
    const oncekiYayinci = konusmaciYukseltildi.current;
    konusmaciYukseltildi.current = false;
    setMuted(true);
    MedyaMikrofonAyarla(false);
    AktifSesOdasiGuncelle({ micAcik: false });
    // Mute yetmez: konuşmacı token'ı canPublish açık kalır — dinleyiciye düşür
    if (oncekiYayinci) {
      const roomName = room.livekit_room_name ?? `voice_${room.id}`;
      void MedyaDinleyiciyeDusur(roomName).then((medya) => {
        if (medya.ok) {
          setLkDurum(medya.mock ? `Demo · dinleyici` : `Bağlı · dinleyici`);
        }
      });
    }
  }, [isDemo, isHost, user?.id, kendiKoltukta, room]);

  /** Mikrofon kabulü sonrası konuşmacı token'ına yükselt */
  React.useEffect(() => {
    if (isDemo || !room || !user?.id || isHost) return;
    if (!kendiKoltukta) return;
    // Profil ziyareti / arka plan: token veya mic'e dokunma
    if (AktifSesOdasiArkaPlandaMi()) return;
    // load() zaten speaker bağladıysa tekrar join etme
    if (konusmaciYukseltildi.current && MedyaYayinciMi()) return;
    konusmaciYukseltildi.current = true;
    const roomName = room.livekit_room_name ?? `voice_${room.id}`;
    void (async () => {
      const medya = await MedyaKonusmaciyaYukselt(roomName);
      if (medya.ok) {
        // Profil dönüşü / yeniden yükseltme: mevcut mic tercihini koru
        const micAcik = !!AktifSesOdasiDurumunuAl()?.micAcik;
        setMuted(!micAcik);
        MedyaMikrofonAyarla(micAcik);
        MedyaHoparlorAyarla(true);
        MedyaUzakSesHacmiAyarla(1);
        setLkDurum(medya.mock ? `Demo · konuşmacı` : `Bağlı · konuşmacı`);
        AktifSesOdasiGuncelle({ micAcik });
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
      void fetchRoomSeats(room.id)
        .then((next) => {
          setSeats((prev) => (koltuklarEsit(prev, next) ? prev : next));
        })
        .catch(() => undefined);
    };
    const imza = `oda-koltuk-${room.id}`;
    odaRealtimeKanaliniTemizle(imza);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
    channel = supabase
      .channel(`${imza}-${Date.now().toString(36)}`)
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          yenile();
          if (user?.id) {
            void supabase
              .from('room_members')
              .select('role')
              .eq('room_id', room.id)
              .eq('user_id', user.id)
              .maybeSingle()
              .then(({ data }) => {
                setMemberRole(
                  (data?.role as
                    | 'host'
                    | 'cohost'
                    | 'speaker'
                    | 'listener'
                    | null) ?? null,
                );
              });
          }
        },
      )
      .subscribe();
    } catch {
      channel = null;
    }
    const poll = setInterval(yenile, 5_000);
    return () => {
      clearInterval(poll);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isDemo, room?.id, user?.id]);

  const odadanAyril = useCallback(
    async (odayiSil: boolean) => {
      if (cikiyor) return;
      setCikiyor(true);
      try {
        KonusmaciSesSeviyesi.mockDurdur();
        AktifSesOdasiBitir();

        const roomId = room?.id;
        const uid = user?.id;
        const sil = odayiSil && isHost && !isDemo && !!roomId;

        // Önce üyelikten düş — aksi halde dinleyici listesinde hayalet kalır
        void MedyaOdasiKes().catch(() => undefined);
        if (uid && roomId && !isDemo) {
          try {
            if (sil) {
              const r = await OdayiSil(roomId);
              if (!r.ok) {
                Alert.alert('Oda', r.hata);
                await leaveRoom(roomId, uid);
              } else {
                void AnalyticsOlayEkle('room_delete', { room_id: roomId });
              }
            } else {
              await leaveRoom(roomId, uid);
              void AnalyticsOlayEkle('room_leave', { room_id: roomId });
            }
          } catch {
            /* ağ hatası — yine de çık */
          }
        }
        OdadanCikisYonlendir();
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
          onPress: () => {
            Alert.alert(
              'Odayı sil',
              'Bu ses odası kalıcı olarak silinecek. Emin misin?',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Evet, sil',
                  style: 'destructive',
                  onPress: () => void odadanAyril(true),
                },
              ],
            );
          },
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
        AktifSesOdasiGuncelle({ micAcik: !sonraki });
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

  const profileZiyaretEt = useCallback((userId: string) => {
    if (!userId || isDemo) return;
    AktifSesOdasiArkaPlanaAl();
    router.push(`/kullanici/${userId}` as any);
  }, [isDemo]);

  const odaSahibi = useMemo(() => {
    if (room?.host?.id && room.host.id === room.host_id) return room.host;
    if (hostProfilYedek?.id === room?.host_id) return hostProfilYedek;
    const taht = seats.find((s) => s.user_id === room?.host_id);
    if (taht?.profile && room?.host_id) {
      return {
        id: room.host_id,
        display_name: taht.profile.display_name ?? null,
        username: taht.profile.username ?? null,
        avatar_url: taht.profile.avatar_url ?? null,
        level: taht.profile.level ?? 1,
        bio: '',
      } as Profile;
    }
    return null;
  }, [room?.host, room?.host_id, hostProfilYedek, seats]);

  React.useEffect(() => {
    if (!room?.host_id || isDemo) {
      setHostProfilYedek(null);
      return;
    }
    if (room.host?.id === room.host_id) {
      setHostProfilYedek(null);
      return;
    }
    let iptal = false;
    void ProfilGetir(room.host_id).then((p) => {
      if (!iptal && p) setHostProfilYedek(p);
    });
    return () => {
      iptal = true;
    };
  }, [room?.host_id, room?.host?.id, isDemo]);

  const profilKartAc = useCallback(
    (input: {
      userId: string;
      displayName?: string | null;
      username?: string | null;
      avatarUrl?: string | null;
      bio?: string | null;
      level?: number | null;
      baslik?: string;
    }) => {
      if (!input.userId || isDemo) return;
      const kendi = input.userId === user?.id;
      setProfilKart({
        ...input,
        coins: kendi ? wallet?.coins : undefined,
        diamonds: kendi ? wallet?.diamonds : undefined,
      });
      void ProfilGetir(input.userId).then((p) => {
        if (!p) return;
        setProfilKart((prev) =>
          prev?.userId === p.id
            ? {
                ...prev,
                displayName: p.display_name ?? prev.displayName,
                username: p.username ?? prev.username,
                avatarUrl: p.avatar_url ?? prev.avatarUrl,
                bio: p.bio ?? prev.bio,
                level: p.level ?? prev.level,
              }
            : prev,
        );
      });
    },
    [isDemo, user?.id, wallet?.coins, wallet?.diamonds],
  );

  const odaSahibiKartAc = useCallback(() => {
    const hid = room?.host_id;
    if (!hid) return;
    profilKartAc({
      userId: hid,
      displayName: odaSahibi?.display_name,
      username: odaSahibi?.username,
      avatarUrl: odaSahibi?.avatar_url,
      bio: odaSahibi?.bio,
      level: odaSahibi?.level,
      baslik: 'Oda sahibi',
    });
  }, [room?.host_id, odaSahibi, profilKartAc]);

  const yorumProfilAc = useCallback(
    (item: CanliSohbetMesajGorunum) => {
      profilKartAc({
        userId: item.user_id,
        displayName: item.display_name,
        username: item.username,
        avatarUrl: item.avatar_url,
        level: item.level,
        baslik: 'Profil',
      });
    },
    [profilKartAc],
  );

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

  const liderligiDevret = useCallback(
    (yeniHostId: string) => {
      if (!room || isDemo) {
        Alert.alert('Demo', 'Liderlik devri gerçek odada çalışır.');
        return;
      }
      const hedef = seats.find((s) => s.user_id === yeniHostId);
      const ad =
        hedef?.profile?.display_name?.trim() ||
        hedef?.profile?.username?.trim() ||
        'bu kullanıcıya';
      Alert.alert(
        'Liderliği devret',
        `${ad} oda sahibi olacak. Tahta oturacak. Emin misin?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Devret',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                const r = await LiderligiDevret({
                  roomId: room.id,
                  yeniHostId,
                });
                if (!r.ok) {
                  Alert.alert('Liderlik', r.hata ?? 'Devredilemedi');
                  return;
                }
                setRoom((prev) =>
                  prev
                    ? {
                        ...prev,
                        host_id: yeniHostId,
                        host: null,
                      }
                    : prev,
                );
                const s = await fetchRoomSeats(room.id).catch(() => null);
                if (s) setSeats(s);
              })();
            },
          },
        ],
      );
    },
    [room, isDemo, seats],
  );

  const yardimciLiderToggle = useCallback(
    (hedefId: string, suanCohost: boolean) => {
      if (!room || isDemo || !isHost) return;
      void (async () => {
        const r = suanCohost
          ? await YardimciLiderKaldir({ roomId: room.id, userId: hedefId })
          : await YardimciLiderAta({ roomId: room.id, userId: hedefId });
        if (!r.ok) {
          Alert.alert('Yardımcı lider', r.hata ?? 'İşlem başarısız');
          return;
        }
        const s = await fetchRoomSeats(room.id).catch(() => null);
        if (s) setSeats(s);
      })();
    },
    [room, isDemo, isHost],
  );

  const koltukMenusu = useCallback(
    (seat: RoomSeat) => {
      // Boş koltuk: dinleyici hedef koltuk için talep gönderir
      if (!seat.user_id) {
        if (isDemo || !room || !user?.id) return;
        if (isHost || kendiKoltukta) return;
        if (seat.seat_index === 0) {
          Alert.alert('Taht', 'Taht yalnızca oda sahibine aittir.');
          return;
        }
        if (seat.is_locked) {
          Alert.alert('Koltuk', 'Bu koltuk kilitli.');
          return;
        }
        void islemiDene('mikrofon', async () => {
          Alert.alert(
            'Koltuk talebi',
            `Koltuk ${seat.seat_index + 1} için istek gönderilsin mi?`,
            [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'İstek gönder',
                onPress: () => {
                  void (async () => {
                    const r = await MikrofonIstegiGonder(room.id, seat.seat_index);
                    if (!r.ok) {
                      Alert.alert('Koltuk', r.hata ?? 'İstek gönderilemedi');
                      return;
                    }
                    Alert.alert(
                      'Koltuk',
                      'İstek gönderildi. Host kabul edince bu koltuğa oturacaksın.',
                    );
                  })();
                },
              },
            ],
          );
        });
        return;
      }
      if (isModerator && !isDemo && seat.user_id !== user?.id) {
        const name =
          seat.profile?.display_name?.trim() ||
          seat.profile?.username?.trim() ||
          seat.user_id.slice(0, 8);
        const hedefHostMu = !!room?.host_id && seat.user_id === room.host_id;
        const ops: {
          text: string;
          style?: 'cancel' | 'destructive';
          onPress?: () => void;
        }[] = [
          {
            text: 'Profil',
            onPress: () => profileZiyaretEt(seat.user_id!),
          },
        ];
        if (isHost && !hedefHostMu) {
          ops.push({
            text: seat.is_cohost
              ? 'Yardımcı liderliği kaldır'
              : 'Yardımcı lider yap',
            onPress: () =>
              yardimciLiderToggle(seat.user_id!, !!seat.is_cohost),
          });
          ops.push({
            text: 'Liderliği devret',
            onPress: () => liderligiDevret(seat.user_id!),
          });
        }
        if (!hedefHostMu) {
          ops.push({
            text: 'Sessize al',
            onPress: () => moderasyonUygula(seat.user_id!, 'mute'),
          });
          ops.push({
            text: 'Odadan at',
            onPress: () => moderasyonUygula(seat.user_id!, 'kick'),
          });
          if (isHost) {
            ops.push({
              text: 'Yasakla',
              style: 'destructive',
              onPress: () => moderasyonUygula(seat.user_id!, 'ban'),
            });
          }
        }
        ops.push({ text: 'İptal', style: 'cancel' });
        Alert.alert(name, 'Aksiyon seç', ops);
        return;
      }
      profileZiyaretEt(seat.user_id);
    },
    [
      isModerator,
      isHost,
      isDemo,
      user?.id,
      room,
      kendiKoltukta,
      islemiDene,
      liderligiDevret,
      yardimciLiderToggle,
      profileZiyaretEt,
    ],
  );

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
        theme_code: 'midnight_plum',
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
          setMuted(true);
          konusmaciYukseltildi.current = true;
        } else if (onbellek.seats.some((seat) => seat.user_id === user?.id)) {
          setMuted(true);
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
        if (!OdaCikisKilidiAktifMi()) {
          Alert.alert('Oda', 'Bu oda artık canlı değil');
          OdadanCikisYonlendir();
        }
        return;
      }
      setRoom(r);
      setSeats(s);
      setLoading(false);

      const hostMu = !!user?.id && user.id === r.host_id;
      const koltukta =
        !!user?.id && s.some((seat) => seat.user_id === user.id);
      // Effect yarışını kes: load speaker/host bağlarken yükseltme effect'i dinleyici join atmasın
      if (hostMu || koltukta) {
        konusmaciYukseltildi.current = true;
      }
      if (hostMu) {
        const tahtta = s.some(
          (seat) => seat.seat_index === 0 && seat.user_id === user.id,
        );
        if (!tahtta) {
          void HostTahtaOtur(r.id).then(async (res) => {
            if (!res.ok) return;
            const next = await fetchRoomSeats(r.id).catch(() => null);
            if (next) setSeats(next);
          });
        }
      }
      if (user?.id) {
        // Host createRoom'da zaten üye — await etme
        void joinRoom(id, user.id, hostMu ? 'host' : 'listener').catch(
          () => undefined,
        );
        void AnalyticsOlayEkle('room_join', { room_id: id });
        void supabase
          .from('room_members')
          .select('role')
          .eq('room_id', id)
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (hostMu) setMemberRole('host');
            else
              setMemberRole(
                (data?.role as
                  | 'host'
                  | 'cohost'
                  | 'speaker'
                  | 'listener'
                  | null) ?? 'listener',
              );
          });
      }

      const roomName = r.livekit_room_name ?? `voice_${id}`;
      setLkDurum('Ses bağlanıyor…');
      const medya = await MedyaOdasiBaglan({
        roomName,
        role: hostMu ? 'host' : koltukta ? 'speaker' : 'listener',
      });
      if (medya.ok) {
        setLkDurum(medya.mock ? `Demo · ${medya.saglayici}` : `Bağlı · ${medya.saglayici}`);
        MedyaHoparlorAyarla(true);
        MedyaUzakSesHacmiAyarla(1);

        // Aynı oda oturumu (profil ziyareti vb.): mic tercihini koru — kapatma
        const oncekiOturum = AktifSesOdasiDurumunuAl();
        const ayniOturum = oncekiOturum?.roomId === r.id;
        const micAcikKalacak = !!(ayniOturum && oncekiOturum?.micAcik);

        if (hostMu || koltukta) {
          konusmaciYukseltildi.current = true;
        } else {
          konusmaciYukseltildi.current = false;
        }

        setMuted(!micAcikKalacak);
        MedyaMikrofonAyarla(micAcikKalacak);

        // Join sonrası soft routing (tam configure yarışını tetikleme)
        setTimeout(() => {
          MedyaSesOturumunuYenile(false);
          MedyaHoparlorAyarla(true);
          MedyaUzakSesHacmiAyarla(1);
          // Yenile mic tercihini ezmesin — açıkken yeniden doğrula
          if (micAcikKalacak) MedyaMikrofonAyarla(true);
        }, 800);
        if (medya.mock && r.host_id) KonusmaciSesSeviyesi.mockBaslat(r.host_id);

        if (ayniOturum) {
          AktifSesOdasiGuncelle({
            title: r.title,
            dinleyiciSayisi: r.listener_count ?? 0,
          });
        } else {
          AktifSesOdasiBaslat({
            roomId: r.id,
            title: r.title,
            micAcik: false,
            dinleyiciSayisi: r.listener_count ?? 0,
          });
        }
        AktifSesOdasiOneCikar();
      } else {
        setLkDurum(medya.hata ?? 'Bağlantı hatası');
        if (hostMu || koltukta) {
          konusmaciYukseltildi.current = false;
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
      const oturum = ++odaFocusNesil.current;
      let iptal = false;
      const profilDonusu = AktifSesOdasiArkaPlandaMi();
      const micAcikOnce =
        profilDonusu && AktifSesOdasiDurumunuAl()?.roomId === id
          ? !!AktifSesOdasiDurumunuAl()?.micAcik
          : null;
      AktifSesOdasiOneCikar();
      void (async () => {
        await load();
        if (oturum !== odaFocusNesil.current) return;
        if (!iptal) {
          MedyaSesOturumunuYenile(false);
          MedyaHoparlorAyarla(true);
          // Profil dönüşünde açık mic'i yenile sonrası geri koy
          if (micAcikOnce) {
            setMuted(false);
            MedyaMikrofonAyarla(true);
            AktifSesOdasiGuncelle({ micAcik: true });
          }
        }
      })();
      return () => {
        iptal = true;
        // Profil ziyareti: ses + mic açık kalsın
        if (AktifSesOdasiArkaPlandaMi()) return;
        KonusmaciSesSeviyesi.mockDurdur();
        // Strict Mode / hızlı remount LiveKit'i öldürmesin — yeni focus iptal eder
        setTimeout(() => {
          if (odaFocusNesil.current !== oturum) return;
          if (AktifSesOdasiArkaPlandaMi()) return;
          void MedyaOdasiKes();
          AktifSesOdasiBitir();
        }, 500);
      };
    }, [load, id]),
  );

  const onSendGift = (gift: Gift, quantity = 1) => {
    if (!user || !room) return;
    const adet = Math.max(1, quantity);
    const maliyet = gift.coin_cost * adet;
    if (maliyet > (wallet?.coins ?? 0)) {
      // Panel içi coin modu — HediyeMagazaPaneli yetmezken coinAc çağırır
      coinYukle.paketleriYenile();
      return;
    }
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
        const yetersiz = /insufficient|yetersiz/i.test(sonuc.hata ?? '');
        if (yetersiz) {
          coinYukle.paketleriYenile();
          Alert.alert('Yetersiz coin', 'Hediye kartında Coin yükle’ye bas.');
          return;
        }
        Alert.alert('Hediye', sonuc.hata ?? 'Gönderilemedi');
        return;
      }
      if (sonuc.coinsSpent > 0) {
        adjustWallet({ coins: -sonuc.coinsSpent });
      }
      void refreshWallet();
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
      void (async () => {
        try {
          const { SehirHediyeSonrasiOzet } = await import(
            '../../src/moduller/sehirler/islemler/SehirModernIslemleri'
          );
          const ozet = await SehirHediyeSonrasiOzet();
          if (ozet.has_city && (ozet.last_delta ?? 0) > 0) {
            Alert.alert(
              'Şehrine güç',
              `${ozet.city_name}: +${ozet.last_delta} güç\nBugün toplam ${ozet.today_power} güç kattın.`,
            );
          }
        } catch {
          /* şehir opsiyonel */
        }
      })();
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
      <Screen koyuSahne>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen koyuSahne>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 80 }}>
          Oda bulunamadı
        </Text>
      </Screen>
    );
  }


  return (
    <Screen koyuSahne edges={['top']}>
      <OdaSahneArkaPlan url={room.cover_url} themeCode={room.theme_code} />

      <SahipGirisAnimasyonu
        gorunur={!!sahipGiris}
        ad={sahipGiris?.ad ?? ''}
        avatarUrl={sahipGiris?.avatarUrl}
        onBitti={() => setSahipGiris(null)}
      />
      <SeviyeGirisAnimasyonu
        gorunur={!!seviyeGiris}
        ad={seviyeGiris?.ad ?? ''}
        level={seviyeGiris?.level ?? 0}
        kademe={seviyeGiris?.kademe ?? 'bronz'}
        avatarUrl={seviyeGiris?.avatarUrl}
        onBitti={seviyeGirisBitti}
      />

      {room && isHost && !isDemo ? (
        <OdaKapakDuzenlePaneli
          visible={odaKartAcik}
          roomId={room.id}
          title={room.title}
          topic={room.topic}
          coverUrl={room.cover_url}
          themeCode={room.theme_code}
          maxSeats={room.max_seats ?? (seats.length || 8)}
          doluKoltuk={seats.filter((s) => !!s.user_id).length}
          onClose={() => setOdaKartAcik(false)}
          onKaydedildi={(next) => {
            setRoom((prev) =>
              prev
                ? {
                    ...prev,
                    title: next.title,
                    topic: next.topic,
                    cover_url: next.cover_url,
                    theme_code: next.theme_code,
                    ...(next.max_seats != null
                      ? { max_seats: next.max_seats }
                      : null),
                    ...(next.capacity_tier_code != null
                      ? { capacity_tier_code: next.capacity_tier_code }
                      : null),
                    ...(next.max_seats != null
                      ? { microphone_capacity: next.max_seats }
                      : null),
                  }
                : prev,
            );
            AktifSesOdasiGuncelle({ title: next.title });
            if (next.max_seats != null) {
              void fetchRoomSeats(room.id)
                .then((s) => {
                  setSeats((prev) => (koltuklarEsit(prev, s) ? prev : s));
                })
                .catch(() => undefined);
            }
          }}
        />
      ) : null}

      <OdaProfilKartiPaneli
        visible={!!profilKart}
        onClose={() => setProfilKart(null)}
        displayName={profilKart?.displayName}
        username={profilKart?.username}
        avatarUrl={profilKart?.avatarUrl}
        bio={profilKart?.bio}
        level={profilKart?.level}
        coins={profilKart?.coins}
        diamonds={profilKart?.diamonds}
        baslik={profilKart?.baslik}
        onProfilAc={
          profilKart?.userId && !isDemo
            ? () => {
                const uid = profilKart.userId;
                setProfilKart(null);
                profileZiyaretEt(uid);
              }
            : undefined
        }
      />

      <View style={styles.root}>
        {/* Klavye açıkken sahneye dokununca kapanır — alt kartın üstünde değil */}
        {klavyeAcik ? (
          <Pressable
            style={styles.klavyeKapatKatman}
            onPress={Keyboard.dismiss}
            accessibilityRole="button"
            accessibilityLabel="Klavyeyi kapat"
          />
        ) : null}

        {/* SAHNE */}
        <View style={styles.stage} pointerEvents={klavyeAcik ? 'box-none' : 'auto'}>
          <OdaCanliAtmosfer yogunluk="hafif" />
          <View style={styles.topBar}>
            <OdaProfilCubugu
              displayName={
                odaSahibi?.display_name ??
                (isHost ? profile?.display_name : null) ??
                'Oda sahibi'
              }
              username={
                odaSahibi?.username ?? (isHost ? profile?.username : null)
              }
              avatarUrl={
                odaSahibi?.avatar_url ?? (isHost ? profile?.avatar_url : null)
              }
              level={odaSahibi?.level ?? (isHost ? profile?.level : null)}
              altEtiket="Oda sahibi"
              onPress={odaSahibiKartAc}
            />
            <View style={styles.topMetaCard} accessibilityLabel="Oda kodu">
              {room.room_code ? (
                <Text style={styles.roomCode} numberOfLines={1}>
                  {room.room_code}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
            <View style={styles.topBarSag}>
              <ModulHataSiniri modulAdi="oda-dinleyici" varyant="kart">
                <OdaDinleyiciPaneli
                  roomId={room.id}
                  demoMi={isDemo}
                  currentUserId={user?.id}
                  koltukUserIds={koltukUserIds}
                  onProfil={profileZiyaretEt}
                  boyut="ust"
                />
              </ModulHataSiniri>
              <View style={styles.livePill} accessibilityLabel="Canlı dinleyici">
                <View
                  style={[
                    styles.liveDot,
                    /bagli|bağlı/i.test(lkDurum) && {
                      backgroundColor: colors.mint,
                    },
                  ]}
                />
                <Text style={styles.liveText}>{room.listener_count}</Text>
              </View>
              {isHost && !isDemo ? (
                <Pressable
                  onPress={() => setOdaKartAcik(true)}
                  style={styles.ustIconBtn}
                  accessibilityLabel="Oda kartını ve koltuk sayısını düzenle"
                  accessibilityRole="button"
                >
                  <Ionicons name="images-outline" size={18} color="#F0D78C" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={odadanCik}
                disabled={cikiyor}
                style={styles.ustIconBtn}
                accessibilityLabel="Odayı kapat"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={20} color="#F7F2E8" />
              </Pressable>
            </View>
          </View>

          <TamusoBanner placement="VOICE_ROOM_TOP" screen="VOICE_ROOM" compact />

          <ScrollView
            style={styles.seatsWrap}
            contentContainerStyle={styles.seatsContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            bounces={false}
            overScrollMode="never"
            scrollEventThrottle={32}
          >
            <SesOdasiMikrofonDuzeni
              seats={seats}
              hostId={room.host_id}
              layoutCode={room.layout_code}
              onSeatPress={koltukMenusu}
            />
          </ScrollView>

          {oyunlarAcik && !isDemo && !klavyeAcik ? (
            <View style={styles.oyunFab} pointerEvents="box-none">
              <OdaOyunDockButonu
                aktif={gameOpen}
                onPress={() =>
                  islemiDene('oyun_baslat', () => {
                    setGiftOpen(false);
                    void gorunurOyunlariYenile();
                    setGameOpen(true);
                  })
                }
              />
            </View>
          ) : null}

          {lastGift ? (
            <View style={styles.giftToast}>
              <Text style={styles.giftToastText}>{lastGift} gönderildi!</Text>
            </View>
          ) : null}
        </View>

        {/* ALT KART — yorum + composer + dock tek yüzey */}
        <View
          style={[
            styles.altKart,
            {
              marginBottom:
                Platform.OS === 'android' && klavyeAcik ? klavyeH : 0,
              paddingBottom: klavyeAcik
                ? Platform.OS === 'android'
                  ? 8
                  : Math.max(8, klavyeH)
                : Math.max(insets.bottom, 6),
            },
          ]}
        >
          {chatOpen && !isDemo ? (
            <View style={styles.yorumBolum} pointerEvents="box-none">
              <ModulHataSiniri modulAdi="oda-sohbeti" varyant="kart">
                <CanliYorumCekilebilirKart
                  birlesik
                  klavyeAcik={klavyeAcik}
                  onClose={() => setChatOpen(false)}
                >
                  <OdaCanliYorumAkisi
                    roomId={room.id}
                    currentUserId={user?.id}
                    hostId={room.host_id}
                    moderatorMu={isModerator}
                    yenileSinyali={yorumYenile}
                    baslikGizle
                    onProfil={yorumProfilAc}
                  />
                </CanliYorumCekilebilirKart>
              </ModulHataSiniri>
            </View>
          ) : !isDemo && !chatOpen ? (
            <Pressable
              onPress={() => setChatOpen(true)}
              style={styles.yorumAcChip}
              accessibilityRole="button"
              accessibilityLabel="Yorumları göster"
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.yorumAcYazi}>Yorumlar</Text>
            </Pressable>
          ) : null}

          <View style={styles.dockBolum}>
            {!isDemo ? (
              <View style={styles.composerSlot}>
                <OdaCanliYorumComposer
                  roomId={room.id}
                  canSend={!isGuest}
                  onNeedUpgrade={upgradeAc}
                  onFocus={() => {
                    if (!chatOpen) setChatOpen(true);
                  }}
                  onSent={() => {
                    setYorumYenile((n) => n + 1);
                    if (!chatOpen) setChatOpen(true);
                    Keyboard.dismiss();
                  }}
                />
              </View>
            ) : null}

            <View style={styles.controls}>
              <Pressable
                onPress={mikrofonToggle}
                style={[styles.controlBtn, !muted && styles.controlBtnAktif]}
                accessibilityLabel={muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={muted ? 'mic-off' : 'mic'}
                  size={ODA_DOCK_ICON}
                  color={muted ? colors.textMuted : colors.micOn}
                />
              </Pressable>

              {isModerator && !isDemo ? (
                <ModulHataSiniri modulAdi="mikrofon-istek" varyant="kart">
                  <MikrofonIstekPaneli
                    roomId={room.id}
                    onDegisti={() => {
                      void fetchRoomSeats(room.id)
                        .then((next) => {
                          setSeats((prev) =>
                            koltuklarEsit(prev, next) ? prev : next,
                          );
                        })
                        .catch(() => undefined);
                    }}
                  />
                </ModulHataSiniri>
              ) : null}

              {!klavyeAcik ? (
                <Pressable
                  onPress={() =>
                    islemiDene('hediye_gonder', () => {
                      setGiftOpen((v) => !v);
                    })
                  }
                  style={styles.giftBtn}
                  accessibilityLabel="Hediye gönder"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[...colors.gradientPrimary]}
                    style={styles.giftBtnInner}
                  >
                    <Ionicons name="gift" size={ODA_DOCK_ICON} color="#fff" />
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {oyunlarAcik && room && user ? (
          <View
            pointerEvents="box-none"
            collapsable={false}
            style={styles.oyunOverlay}
          >
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
                hostDisplayName={
                  odaSahibi?.display_name ??
                  odaSahibi?.username ??
                  room.host_id?.slice(0, 8) ??
                  'Host'
                }
                startModalVisible={gameOpen}
                onStartModalClose={() => setGameOpen(false)}
                onOverlayClosed={() => {
                  setGameOpen(false);
                  setOyunMonteli(false);
                  setBalonOyunKodu(null);
                  router.setParams({ oyun: undefined } as any);
                }}
                visibleGameCodes={gorunurOyunKodlari}
                initialGameCode={balonOyunKodu}
              />
            </ModulHataSiniri>
          </View>
        ) : null}
      </View>

      <ModulHataSiniri modulAdi="hediyeler" varyant="kart">
        <HediyeMagazaPaneli
          visible={giftOpen}
          gifts={gifts}
          coins={wallet?.coins}
          aliciAdi={
            odaSahibi?.display_name ??
            odaSahibi?.username ??
            room.host?.display_name ??
            room.host?.username ??
            'Ev sahibi'
          }
          onSend={onSendGift}
          onClose={() => setGiftOpen(false)}
          coinPackages={coinYukle.packages}
          coinLocked={coinYukle.purchaseLocked}
          onCoinBuy={coinYukle.satinAl}
          onCoinPaketHazirla={coinYukle.paketleriYenile}
        />
      </ModulHataSiniri>

      <CoinYuklePaneli
        visible={coinYukle.acik}
        packages={coinYukle.packages}
        locked={coinYukle.purchaseLocked}
        coins={wallet?.coins}
        onBuy={coinYukle.satinAl}
        onClose={coinYukle.kapat}
        upgradeAcik={coinYukle.upgradeAcik}
        upgradeKapat={coinYukle.upgradeKapat}
        onPaketleriYenile={coinYukle.paketleriYenile}
      />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
    position: 'relative',
  },
  stage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  klavyeKapatKatman: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  seatsWrap: {
    flex: 1,
    minHeight: 0,
    zIndex: 2,
  },
  seatsContent: {
    paddingTop: 4,
    paddingBottom: 28,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 6,
    flexShrink: 0,
    zIndex: 3,
  },
  topBarSag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  ustIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMetaCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  roomCode: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(232, 64, 145, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.live,
  },
  liveText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '800',
    fontSize: 12,
  },
  giftToast: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(232, 64, 145, 0.28)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.4)',
    flexShrink: 0,
    zIndex: 4,
  },
  giftToastText: { ...typography.body, color: colors.text, fontWeight: '700' },
  oyunFab: {
    position: 'absolute',
    right: Platform.OS === 'android' ? 10 : 14,
    bottom: 10,
    zIndex: 12,
    elevation: 12,
    // Kaydırmayı engellemesin — sadece buton alanı
    pointerEvents: 'box-none',
  },
  oyunOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 400,
    elevation: 400,
  },
  altKart: {
    flexShrink: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: 'rgba(12, 10, 18, 0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    zIndex: 50,
    elevation: 50,
  },
  yorumBolum: {
    overflow: 'visible',
    zIndex: 6,
  },
  yorumAcChip: {
    alignSelf: 'flex-start',
    marginLeft: 14,
    marginTop: 10,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  yorumAcYazi: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  dockBolum: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 90,
    elevation: 90,
  },
  composerSlot: {
    flex: 1,
    minWidth: 100,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  controlBtn: {
    width: ODA_DOCK_BTN,
    height: ODA_DOCK_BTN,
    borderRadius: ODA_DOCK_BTN / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  controlBtnAktif: {
    borderColor: 'rgba(61, 207, 176, 0.45)',
    backgroundColor: 'rgba(61, 207, 176, 0.16)',
  },
  giftBtn: {
    width: ODA_DOCK_BTN,
    height: ODA_DOCK_BTN,
    borderRadius: ODA_DOCK_BTN / 2,
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232, 64, 145, 0.4)',
  },
  giftBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
