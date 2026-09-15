import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
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
import { AnaSayfaAtmosfer } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaAtmosfer';
import { AnaSayfaFeedBasligi } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaFeedBasligi';
import { AnaSayfaFeedKart } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaFeedKart';
import {
  AnaSayfaHizliErisim,
  type AnaSayfaHizliOge,
} from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaHizliErisim';
import {
  AnaSayfaCekmeceMenu,
  AnaSayfaHamburgerDugmesi,
  type AnaSayfaMenuOgesi,
} from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaCekmeceMenu';
import { AnaSayfaSesCubuklari } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaSesCubuklari';
import { CihazPushTokeniniKaydet } from '../../src/moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import { useBildirimler } from '../../src/moduller/bildirimler/baglam/BildirimSaglayici';
import { BildirimZiliDugmesi } from '../../src/moduller/bildirimler/bilesenler/BildirimZiliDugmesi';
import { useAjansYonetim } from '../../src/moduller/ajanslar/kancalar/useAjansYonetim';
import { supabase } from '../../src/lib/supabase';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { Ionicons } from '@expo/vector-icons';
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

/** Ana akım — sadece canlı içerik, buton kalabalığı yok */
export default function HomeScreen() {
  const { profile } = useAuth();
  const isAdmin = AdminYetkisiVarMi(profile);
  const { okunmamis, yenile: bildirimYenile } = useBildirimler();
  const { yetkili: ajansYetkili, yonetimHref } = useAjansYonetim();
  const [feed, setFeed] = useState<FeedOggesi[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAcik, setMenuAcik] = useState(false);
  const odakli = useRef(false);
  const bolumler = useMemo(() => AnaSayfaBolumleriniGetir().filter((b) => b.aktif), []);

  const load = useCallback(async (sessiz = false) => {
    try {
      if (!sessiz) setLoading(true);
      const data = await CanliFeedGetir(40);
      setFeed(data);
      if (!sessiz) void CihazPushTokeniniKaydet();
    } catch {
      if (!sessiz) setFeed([]);
    } finally {
      if (!sessiz) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      odakli.current = true;
      void load();
      void bildirimYenile();
      const timer = setInterval(() => {
        if (odakli.current) void load(true);
      }, YENILE_MS);
      return () => {
        odakli.current = false;
        clearInterval(timer);
      };
    }, [load, bildirimYenile]),
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const topic = 'feed-live-rooms';
    // Ayni isimli kanal subscribe sonrasi .on() eklenemez (Strict Mode / yeniden mount)
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    const yenile = () => {
      if (odakli.current) void loadRef.current(true);
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

  const hizliErisim = useMemo<AnaSayfaHizliOge[]>(
    () => [
      {
        key: 'oda-ac',
        baslik: 'Ses odası aç',
        alt: 'Yeni oda kur, yayına geç',
        icon: 'add-circle-outline',
        tint: RenkTokenlari.primarySoft,
        href: '/(tabs)/create',
      },
      {
        key: 'odalari-gez',
        baslik: 'Odaları gez',
        alt: 'Canlı ses odalarına katıl',
        icon: 'headset-outline',
        tint: RenkTokenlari.mint,
        href: '/(tabs)/rooms',
      },
      {
        key: 'ajans-kur',
        baslik: 'Ajans kur',
        alt: 'Başvur → admin onaylar',
        icon: 'business-outline',
        tint: RenkTokenlari.magenta,
        href: '/ajans',
      },
      {
        key: 'kesfet',
        baslik: 'Keşfet',
        alt: 'Modlara göre gez',
        icon: 'compass-outline',
        tint: RenkTokenlari.violet,
        href: '/kesfet',
      },
    ],
    [],
  );

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
        tint: RenkTokenlari.primarySoft,
        href: '/(tabs)/create',
      },
      {
        key: 'rooms',
        baslik: 'Canlı odalar',
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
        icon: 'radio-outline',
        tint: RenkTokenlari.live,
        href: '/canli',
      },
      {
        key: 'agency',
        baslik: 'Ajans kur',
        alt: 'Başvuru · paneller',
        icon: 'business-outline',
        tint: RenkTokenlari.magenta,
        href: '/ajans',
      },
      ...(ajansYetkili
        ? [
            {
              key: 'agency_manage',
              baslik: 'Ajans Yönetim',
              alt: 'Kurallar · ödeme · coin',
              icon: 'briefcase-outline' as const,
              tint: RenkTokenlari.magenta,
              href: yonetimHref,
            },
          ]
        : []),
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
              alt: 'Odasız · coin’siz denetim',
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
  }, [bolumler, ajansYetkili, yonetimHref, isAdmin]);

  const feedRows = useMemo(
    () => buildFeedBannerRows(feed, [3, 8, 15]),
    [feed],
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ana-sayfa">
        <View style={styles.root}>
          <AnaSayfaAtmosfer />

          <AnaSayfaFeedBasligi
            canliSayisi={feed.length}
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

          {loading && feed.length === 0 ? (
            <ActivityIndicator color={RenkTokenlari.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={feedRows}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={() => void load()}
                  tintColor={RenkTokenlari.primary}
                />
              }
              ListHeaderComponent={
                <View>
                  <TamusoBanner placement="HOME_TOP" screen="HOME" />
                  <TamusoBanner placement="FEED_TOP" screen="FEED" />
                  <AnaSayfaHizliErisim
                    ogeler={hizliErisim}
                    onSec={(href) => router.push(href as any)}
                  />
                  <TamusoBanner placement="HOME_MIDDLE" screen="HOME" />
                  {feed.length > 0 ? (
                    <View style={styles.bolumBaslik}>
                      <Text style={styles.bolumYazi}>Şimdi yayında</Text>
                      <View style={styles.bolumCizgi} />
                    </View>
                  ) : null}
                </View>
              }
              ListFooterComponent={
                <TamusoBanner placement="HOME_BOTTOM" screen="HOME" />
              }
              ListEmptyComponent={
                <Animated.View
                  entering={FadeInUp.delay(120)
                    .duration(AnimasyonTokenlari.yavas)
                    .springify()
                    .damping(16)}
                >
                  <LinearGradient
                    colors={['#3A1A38', '#1A1226', '#121018']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bos}
                  >
                    <View style={styles.bosUst}>
                      <AnaSayfaSesCubuklari yukseklik={16} />
                      <Text style={styles.bosEyebrow}>SAHNE BEKLİYOR</Text>
                    </View>
                    <Text style={styles.bosBaslik}>İlk ses odasını aç</Text>
                    <Text style={styles.bosAlt}>
                      Canlı oda yok — kendi sahneni kur veya odaları gez.
                    </Text>
                    <View style={styles.bosAksiyonlar}>
                      <Pressable
                        onPress={() => router.navigate('/(tabs)/create')}
                        style={styles.bosBtn}
                      >
                        <LinearGradient
                          colors={[...RenkTokenlari.gradientPrimary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.bosBtnIc}
                        >
                          <Ionicons name="mic" size={15} color="#12040C" />
                          <Text style={styles.bosBtnYazi}>Ses odası aç</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable
                        onPress={() => router.navigate('/(tabs)/rooms')}
                        style={styles.bosBtnIkincil}
                      >
                        <Text style={styles.bosBtnIkincilYazi}>Odaları gez</Text>
                      </Pressable>
                    </View>
                  </LinearGradient>
                </Animated.View>
              }
              renderItem={({ item, index }) => {
                if (item.kind === 'banner') {
                  return <FeedBannerRowView placement={item.placement} />;
                }
                return (
                  <View style={styles.satir}>
                    {item.items.map((oge: FeedOggesi, i: number) => (
                      <View key={oge.id} style={styles.kartWrap}>
                        <AnaSayfaFeedKart
                          oge={oge}
                          index={index * 2 + i}
                          onPress={() => router.push(oge.href as any)}
                        />
                      </View>
                    ))}
                    {item.items.length === 1 ? (
                      <View style={[styles.kartWrap, { opacity: 0 }]} />
                    ) : null}
                  </View>
                );
              }}
            />
          )}

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
          />
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    paddingTop: BoslukTokenlari.xs,
    gap: BoslukTokenlari.md,
  },
  satir: {
    gap: BoslukTokenlari.md,
  },
  kartWrap: {
    flex: 1,
    maxWidth: '48.5%',
  },
  bolumBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.xs,
  },
  bolumYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  bolumCizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  loader: { marginTop: 48 },
  bos: {
    marginTop: BoslukTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.35)',
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
    color: RenkTokenlari.primarySoft,
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
    color: '#12040C',
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
