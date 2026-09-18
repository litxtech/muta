import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AnaSayfaBolumleriniGetir } from '../../src/moduller/ana-sayfa/okuma/AnaSayfaBolumleriniGetir';
import {
  CanliFeedGetir,
  type FeedOggesi,
} from '../../src/moduller/ana-sayfa/okuma/AnaSayfaIcerikleriniGetir';
import {
  FEED_AKTIF_ANIMASYON_KART_SAYISI,
  feedIzgarasiniKur,
  type FeedIzgaraOgesi,
} from '../../src/moduller/ana-sayfa/okuma/AnaSayfaFeedIzgarasi';
import { AnaSayfaAtmosfer } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaAtmosfer';
import { AnaSayfaFeedBasligi } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaFeedBasligi';
import { AnaSayfaFeedKart } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaFeedKart';
import {
  AnaSayfaFiltreCipleri,
  type FeedFiltre,
  type FeedFiltreOgesi,
} from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaFiltreCipleri';
import { AnaSayfaIskelet } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaIskelet';
import {
  AnaSayfaCekmeceMenu,
  AnaSayfaHamburgerDugmesi,
  type AnaSayfaMenuOgesi,
} from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaCekmeceMenu';
import { CihazPushTokeniniKaydet } from '../../src/moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import { useBildirimler } from '../../src/moduller/bildirimler/baglam/BildirimSaglayici';
import { BildirimZiliDugmesi } from '../../src/moduller/bildirimler/bilesenler/BildirimZiliDugmesi';
import { useAjansYonetim } from '../../src/moduller/ajanslar/kancalar/useAjansYonetim';
import { supabase } from '../../src/lib/supabase';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';
import {
  buildFeedBannerRows,
  FeedBannerRowView,
} from '../../src/banner/components/FeedBannerRows';

const BOLUM_IKON: Record<string, keyof typeof Ionicons.glyphMap> = {
  official_city_rooms: 'business-outline',
  city_league: 'trophy-outline',
  events: 'calendar-outline',
  pk_now: 'flash-outline',
  popular_agencies: 'people-outline',
  creators_for_you: 'star-outline',
};

const BOLUM_TINT: Record<string, string> = {
  official_city_rooms: RenkTokenlari.primarySoft,
  city_league: RenkTokenlari.accent,
  events: RenkTokenlari.magenta,
  pk_now: RenkTokenlari.accent,
  popular_agencies: RenkTokenlari.violet,
  creators_for_you: RenkTokenlari.mint,
};

function bolumHedef(kod: string): string {
  if (kod === 'city_league') return '/sehir/lig';
  if (kod === 'official_city_rooms') return '/sehir';
  if (kod === 'events') return '/platform';
  if (kod === 'pk_now') return '/pk';
  if (kod === 'popular_agencies') return '/ajans';
  return '/kesfet';
}

const YENILE_MS = 18000;

/** Ana akım — yayın ve ses odası kartları 2'li ızgarada aşağı akar */
export default function HomeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();
  const isAdmin = AdminYetkisiVarMi(profile);
  const { okunmamis, yenile: bildirimYenile } = useBildirimler();
  const { yonetimHref } = useAjansYonetim();
  const [feed, setFeed] = useState<FeedOggesi[]>([]);
  /** İlk açılış iskeleti — odak dönüşünde tekrar açılmaz */
  const [loading, setLoading] = useState(true);
  /** Sadece kullanıcı aşağı çekince */
  const [refreshing, setRefreshing] = useState(false);
  const [menuAcik, setMenuAcik] = useState(false);
  const [filtre, setFiltre] = useState<FeedFiltre>('tumu');
  const odakli = useRef(false);
  const ilkYuklemeBitti = useRef(false);
  const loadNesil = useRef(0);
  const bolumler = useMemo(() => AnaSayfaBolumleriniGetir().filter((b) => b.aktif), []);

  const load = useCallback(async (mod: 'ilk' | 'sessiz' | 'pull' = 'sessiz') => {
    const nesil = ++loadNesil.current;
    try {
      if (mod === 'ilk') setLoading(true);
      if (mod === 'pull') setRefreshing(true);

      const data = await Promise.race([
        CanliFeedGetir(40),
        new Promise<FeedOggesi[]>((_, reject) => {
          setTimeout(() => reject(new Error('feed-timeout')), 12_000);
        }),
      ]);
      if (nesil !== loadNesil.current) return;
      setFeed(data);
      if (mod === 'ilk') void CihazPushTokeniniKaydet();
    } catch {
      if (nesil !== loadNesil.current) return;
      if (mod === 'ilk') setFeed([]);
    } finally {
      if (nesil !== loadNesil.current) return;
      if (mod === 'ilk') setLoading(false);
      if (mod === 'pull') setRefreshing(false);
      ilkYuklemeBitti.current = true;
    }
  }, []);

  /** Ana sayfada swipe-back / geçmiş geri kilit — sol kenar hamburger'a kalsın */
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      });

      const onBack = () => {
        if (menuAcik) {
          setMenuAcik(false);
          return true;
        }
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);

      return () => {
        sub.remove();
      };
    }, [navigation, menuAcik]),
  );

  useFocusEffect(
    useCallback(() => {
      odakli.current = true;
      // Oda/profil dönüşünde spinner açma — sessiz yenile
      void load(ilkYuklemeBitti.current ? 'sessiz' : 'ilk');
      void bildirimYenile();
      const timer = setInterval(() => {
        if (odakli.current) void load('sessiz');
      }, YENILE_MS);
      return () => {
        odakli.current = false;
        // Yarım kalan istek finally'de loading'i kaçırmasın
        loadNesil.current += 1;
        setRefreshing(false);
        setLoading(false);
        clearInterval(timer);
      };
    }, [load, bildirimYenile]),
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const topic = 'feed-live-rooms';
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    const yenile = () => {
      if (odakli.current) void loadRef.current('sessiz');
    };

    const kanal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        yenile,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        yenile,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, []);

  const menuOgeleri = useMemo<AnaSayfaMenuOgesi[]>(() => {
    const dunyalar = bolumler
      .filter(
        (b) =>
          !['live_now', 'voice_rooms', 'trending', 'popular_agencies', 'pk_now'].includes(
            b.kod,
          ),
      )
      .map((b) => ({
        key: b.kod,
        baslik: b.baslik,
        alt: b.alt,
        icon: BOLUM_IKON[b.kod] ?? 'compass-outline',
        tint: BOLUM_TINT[b.kod] ?? RenkTokenlari.primary,
        href: bolumHedef(b.kod),
      }));

    const ekstra: AnaSayfaMenuOgesi[] = [
      {
        key: 'create_room',
        baslik: 'Ses odası aç',
        alt: 'Yeni oda kur',
        icon: 'add-circle-outline',
        tint: RenkTokenlari.mint,
        href: '/(tabs)/create',
      },
      {
        key: 'rooms',
        baslik: 'Ses odaları',
        alt: 'Listeye gir · katıl',
        icon: 'headset-outline',
        tint: RenkTokenlari.mint,
        href: '/(tabs)/rooms',
      },
      {
        key: 'kesfet',
        baslik: 'Keşfet',
        alt: 'Mod · oda gezgini',
        icon: 'compass-outline',
        tint: RenkTokenlari.violet,
        href: '/kesfet',
      },
      {
        key: 'live',
        baslik: 'Canlı yayın',
        alt: 'Kamerayla yayına çık',
        icon: 'videocam-outline',
        tint: RenkTokenlari.live,
        href: '/canli',
      },
      {
        key: 'agency_manage',
        baslik: 'Ajansım',
        alt: 'Kurallar · ödeme · coin',
        icon: 'briefcase-outline',
        tint: RenkTokenlari.magenta,
        href: yonetimHref,
      },
      {
        key: 'host',
        baslik: 'Host ol',
        alt: 'Ev sahibi başvurusu',
        icon: 'mic-outline',
        tint: RenkTokenlari.mint,
        href: '/host',
      },
      {
        key: 'pk',
        baslik: 'PK',
        alt: 'Karşılaşma arenası',
        icon: 'flash-outline',
        tint: RenkTokenlari.accent,
        href: '/pk',
      },
      {
        key: 'ranks',
        baslik: 'Sıralama',
        alt: 'Liderlik tabloları',
        icon: 'trophy-outline',
        tint: RenkTokenlari.violet,
        href: '/siralamalar',
      },
      {
        key: 'destek',
        baslik: 'Canlı destek',
        alt: 'Temsilci Toprak',
        icon: 'headset-outline',
        tint: RenkTokenlari.primarySoft,
        href: '/destek',
      },
      ...(isAdmin
        ? [
            {
              key: 'admin_oyun_test',
              baslik: 'Oyun testi',
              alt: "Odasız · coin'siz denetim",
              icon: 'flask-outline' as const,
              tint: RenkTokenlari.violet,
              href: '/admin/oyun-test',
            },
            {
              key: 'admin_panel',
              baslik: 'Admin panel',
              alt: 'Kontrol merkezi',
              icon: 'shield-checkmark-outline' as const,
              tint: RenkTokenlari.accent,
              href: '/admin',
            },
          ]
        : []),
    ];

    const keys = new Set<string>(dunyalar.map((d) => d.key));
    return [...dunyalar, ...ekstra.filter((e) => !keys.has(e.key))];
  }, [bolumler, yonetimHref, isAdmin]);

  const yayinSayisi = useMemo(() => feed.filter((o) => o.tur === 'canli').length, [feed]);
  const sesSayisi = useMemo(() => feed.filter((o) => o.tur === 'oda').length, [feed]);

  const izgara = useMemo(() => feedIzgarasiniKur(feed, filtre), [feed, filtre]);

  const feedRows = useMemo(
    () => buildFeedBannerRows(izgara),
    [izgara],
  );

  const filtreler = useMemo<FeedFiltreOgesi[]>(
    () => [
      {
        kod: 'tumu',
        etiket: 'Tümü',
        icon: 'sparkles',
        tint: RenkTokenlari.primarySoft,
      },
      {
        kod: 'canli',
        etiket: 'Canlı',
        icon: 'videocam',
        sayi: yayinSayisi,
        tint: RenkTokenlari.primarySoft,
      },
      {
        kod: 'ses',
        etiket: 'Ses odası',
        icon: 'headset',
        sayi: sesSayisi,
        tint: RenkTokenlari.mint,
      },
    ],
    [sesSayisi, yayinSayisi],
  );

  const kartAc = useCallback((oge: FeedIzgaraOgesi) => {
    router.push(oge.oge.href as any);
  }, []);

  const bosMesaj =
    filtre === 'canli'
      ? { eyebrow: 'CANLI YAYIN', baslik: 'Şu an yayın yok', alt: 'Kamerayı aç, sahne senin olsun.' }
      : filtre === 'ses'
        ? { eyebrow: 'SES SAHNESİ', baslik: 'İlk ses odasını aç', alt: 'Canlı ses odası yok — kendi odanı kur.' }
        : { eyebrow: 'SAHNE', baslik: 'Sahne sessiz', alt: 'Canlı içerik yok — ilk odayı sen aç veya yayına çık.' };

  return (
    <Screen edges={[]} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="ana-sayfa">
        <AnaSayfaCekmeceMenu
          acik={menuAcik}
          onAcikDegisti={setMenuAcik}
          ogeler={menuOgeleri}
          onOgeSec={(href) => router.push(href as any)}
          profil={{
            displayName:
              profile?.display_name ??
              (profile?.username ? `@${profile.username}` : 'Misafir'),
            username: profile?.username,
            avatarUrl: profile?.avatar_url,
          }}
          onProfilPress={() => router.navigate('/(tabs)/profile')}
        >
          <View style={styles.root}>
            <AnaSayfaAtmosfer />

            <AnaSayfaFeedBasligi
              sesSayisi={sesSayisi}
              yayinSayisi={yayinSayisi}
              solAksiyon={
                <AnaSayfaHamburgerDugmesi onPress={() => setMenuAcik(true)} />
              }
              sagAksiyon={
                <BildirimZiliDugmesi
                  sayi={okunmamis}
                  onPress={() => router.push('/bildirimler' as any)}
                />
              }
            />

            <AnaSayfaFiltreCipleri ogeler={filtreler} secili={filtre} onSec={setFiltre} />

            <TamusoBanner placement="HOME_TOP" screen="HOME" compact />

            {loading && feed.length === 0 ? (
              <AnaSayfaIskelet satir={3} />
            ) : (
              <FlatList
                data={feedRows}
                keyExtractor={(item) => item.key}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
                initialNumToRender={4}
                windowSize={5}
                maxToRenderPerBatch={4}
                removeClippedSubviews
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void load('pull')}
                    tintColor={RenkTokenlari.primary}
                  />
                }
                ListFooterComponent={
                  <View style={styles.footer}>
                    <TamusoBanner placement="HOME_BOTTOM" screen="HOME" compact />
                  </View>
                }
                ListEmptyComponent={
                  <View>
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPlaceholder]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.bos}
                    >
                      <View style={styles.bosUst}>
                        <Text style={styles.bosEyebrow}>{bosMesaj.eyebrow}</Text>
                      </View>
                      <Text style={styles.bosBaslik}>{bosMesaj.baslik}</Text>
                      <Text style={styles.bosAlt}>{bosMesaj.alt}</Text>
                      <View style={styles.bosAksiyonlar}>
                        <Pressable
                          onPress={() =>
                            filtre === 'canli'
                              ? router.push('/canli' as any)
                              : router.navigate('/(tabs)/create')
                          }
                          style={styles.bosBtn}
                        >
                          <LinearGradient
                            colors={[...RenkTokenlari.gradientPrimary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.bosBtnIc}
                          >
                            <Ionicons
                              name={filtre === 'canli' ? 'videocam' : 'mic'}
                              size={15}
                              color={RenkTokenlari.textOnPrimary}
                            />
                            <Text style={styles.bosBtnYazi}>
                              {filtre === 'canli' ? 'Yayına çık' : 'Ses odası aç'}
                            </Text>
                          </LinearGradient>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push('/kesfet' as any)}
                          style={styles.bosBtnIkincil}
                        >
                          <Text style={styles.bosBtnIkincilYazi}>Keşfet</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  </View>
                }
                renderItem={({ item, index }) => {
                  if (item.kind === 'banner') {
                    return <FeedBannerRowView placement={item.placement} />;
                  }
                  return (
                    <View style={styles.satir}>
                      {item.items.map((oge: FeedIzgaraOgesi, i: number) => {
                        const kartIndex = index * 2 + i;
                        const aktif = kartIndex < FEED_AKTIF_ANIMASYON_KART_SAYISI;
                        return (
                          <View key={oge.id} style={styles.kartWrap}>
                            <AnaSayfaFeedKart
                              oge={oge.oge}
                              index={kartIndex}
                              aktif={aktif}
                              onPress={() => kartAc(oge)}
                            />
                          </View>
                        );
                      })}
                      {item.items.length === 1 ? (
                        <View style={styles.kartWrap} pointerEvents="none" />
                      ) : null}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </AnaSayfaCekmeceMenu>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    paddingTop: BoslukTokenlari.sm,
    gap: BoslukTokenlari.md + 2,
  },
  satir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
    overflow: 'visible',
  },
  kartWrap: {
    flex: 1,
    minWidth: 0,
    overflow: 'visible',
  },
  footer: {
    marginTop: BoslukTokenlari.sm,
  },
  bos: {
    marginTop: BoslukTokenlari.md,
    padding: BoslukTokenlari.xl,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.28)',
    gap: 8,
    overflow: 'hidden',
  },
  bosUst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  bosEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    letterSpacing: 1.6,
    fontWeight: '800',
  },
  bosBaslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    letterSpacing: -0.4,
  },
  bosAlt: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    marginBottom: 10,
  },
  bosAksiyonlar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    flexWrap: 'wrap',
  },
  bosBtn: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  bosBtnIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bosBtnYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  bosBtnIkincil: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  bosBtnIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
});
