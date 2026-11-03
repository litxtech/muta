/**
 * Kişiler keşif ekranı — Sana Özel / Kadın / Erkek + filtreler + 2 kolon grid.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../../components/Screen';
import { EkranBasligi, TamusoScreenHeader } from '../../../components/EkranBasligi';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { KlavyeGuvenliAlan } from '../../../bilesenler/klavye/KlavyeGuvenliAlan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  HeaderTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { OzelSohbetAcVeyaGetir } from '../../mesajlasma/islemler/MesajGonder';
import {
  KisilerConfigGetir,
  KisilerKesifGetir,
  KisilerAramaKapaliBildir,
  KisilerUcretliGorusmeBaslat,
} from '../islemler/KisilerKesifIslemleri';
import type {
  KisilerConfig,
  KisilerEffectiveFeatures,
  KisilerKesifKarti,
  KisilerKesifSekmesi,
} from '../tipler';
import { KisilerKart } from './KisilerKart';
import { KisilerAramaOnaySheet } from './KisilerAramaOnaySheet';
import { KisilerUlkeSeridi } from './KisilerUlkeSeridi';
import {
  KisilerKesfetSeritleri,
  type CanliOzet,
} from './KisilerKesfetSeritleri';
import { KISILER_ULKE_LISTESI, ulkeBayragi } from '../utils/KisilerYardimcilar';
import { useCeviri } from '../../../i18n/useCeviri';
import { AnalyticsOlayEkle } from '../../guvenlik/analytics/AnalyticsOlayEkle';
import { CanliYayinlariGetir } from '../../canli-yayin/islemler/CanliYayinIslemleri';
import { CanliYayinaGit } from '../../canli-yayin/navigasyon/CanliYayinaGit';
import { OzellikBayragiAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';

type AramaHedefi = {
  userId: string;
  callType: 'audio' | 'video';
};

function canliOzetle(rows: unknown[]): CanliOzet[] {
  const out: CanliOzet[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as {
      id?: string;
      host_id?: string;
      title?: string | null;
      viewer_count?: number | null;
      host?:
        | { display_name?: string | null; username?: string | null; avatar_url?: string | null }
        | { display_name?: string | null; username?: string | null; avatar_url?: string | null }[]
        | null;
    };
    if (!row.id || !row.host_id) continue;
    const host = Array.isArray(row.host) ? row.host[0] : row.host;
    const ad = host?.display_name?.trim() || host?.username?.trim() || '';
    out.push({
      id: row.id,
      hostId: row.host_id,
      ad,
      avatar: host?.avatar_url ?? null,
      baslik: row.title?.trim() || null,
      izleyici: Number.isFinite(Number(row.viewer_count)) ? Number(row.viewer_count) : 0,
    });
  }
  return out;
}

function kisilerTekille(liste: KisilerKesifKarti[]): KisilerKesifKarti[] {
  const seen = new Set<string>();
  const out: KisilerKesifKarti[] = [];
  for (const item of liste) {
    const id = item.user_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export function KisilerKesifEkrani() {
  const { t, dil } = useCeviri();
  const insets = useSafeAreaInsets();
  const { width: ekranGen, height: ekranYuk } = useWindowDimensions();
  const kartGen = Math.floor(
    (ekranGen - BoslukTokenlari.lg * 2 - BoslukTokenlari.md) / 2,
  );
  const [config, setConfig] = useState<KisilerConfig | null>(null);
  const [features, setFeatures] = useState<KisilerEffectiveFeatures | null>(null);
  const [tab, setTab] = useState<KisilerKesifSekmesi>('for_you');
  const [arama, setArama] = useState('');
  const [ulke, setUlke] = useState<string | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [items, setItems] = useState<KisilerKesifKarti[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [ulkeSheet, setUlkeSheet] = useState(false);
  const [ulkeArama, setUlkeArama] = useState('');
  const [onay, setOnay] = useState<AramaHedefi | null>(null);
  const [aramaBusy, setAramaBusy] = useState(false);
  const [canlilar, setCanlilar] = useState<CanliOzet[]>([]);
  const [vurguCanli, setVurguCanli] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aramaDebounced, setAramaDebounced] = useState('');
  const cursorRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const istekSayacRef = useRef(0);
  const configRef = useRef<KisilerConfig | null>(null);

  const feat = features ?? config;
  const featRef = useRef(feat);
  featRef.current = feat;

  const yukle = useCallback(
    async (opts?: { refresh?: boolean; more?: boolean }) => {
      if (opts?.more) {
        if (loadingMoreRef.current || cursorRef.current == null) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        if (opts?.refresh) setRefreshing(true);
        else setLoading(true);
        cursorRef.current = null;
      }

      const istekNo = ++istekSayacRef.current;

      try {
        let cfg = configRef.current;
        if (!cfg) {
          cfg = await KisilerConfigGetir();
          if (istekNo !== istekSayacRef.current) return;
          configRef.current = cfg;
          setConfig(cfg);
          setFeatures(cfg);
          if (!cfg.people_discovery_enabled) {
            setHata('feature_unavailable');
            setItems([]);
            return;
          }
        }

        const res = await KisilerKesifGetir(
          {
            tab,
            countryCode: ulke,
            onlineOnly,
            query: aramaDebounced || null,
          },
          opts?.more ? cursorRef.current : null,
        );

        if (istekNo !== istekSayacRef.current) return;

        setFeatures(res.features);
        if (!res.ok && res.error === 'feature_unavailable') {
          setHata('feature_unavailable');
          setItems([]);
          return;
        }
        if (!res.ok) {
          setHata(res.message ?? res.error ?? t('kisilerX.yuklenemedi'));
          if (!opts?.more) setItems([]);
          return;
        }
        setHata(null);
        setItems((prev) =>
          kisilerTekille(opts?.more ? [...prev, ...res.items] : res.items),
        );
        cursorRef.current = res.next_cursor;
        setCursor(res.next_cursor);
      } catch (e) {
        if (istekNo !== istekSayacRef.current) return;
        setHata(e instanceof Error ? e.message : t('kisilerX.yuklenemediBody'));
      } finally {
        if (istekNo === istekSayacRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [aramaDebounced, onlineOnly, tab, ulke],
  );

  // Profil'e gidip dönünce listeyi yeniden çekme — kart kaybolmasın.
  // Sadece filtre / arama değişince veya pull-to-refresh ile yenile.
  useEffect(() => {
    void yukle();
  }, [yukle]);

  const raylariYukle = useCallback(async () => {
    const isler: Promise<void>[] = [];
    if (OzellikBayragiAktifMi('live_enabled')) {
      isler.push(
        CanliYayinlariGetir(8)
          .then((rows) => setCanlilar(canliOzetle(rows as unknown[])))
          .catch(() => setCanlilar([])),
      );
    }
    await Promise.all(isler);
  }, []);

  useEffect(() => {
    void AnalyticsOlayEkle('discover_opened', { screen: 'kisiler' });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void raylariYukle();
    }, [raylariYukle]),
  );

  const onAramaDegis = (metin: string) => {
    setArama(metin);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = metin.trim();
      const lower = q.toLocaleLowerCase();
      if (['canlı', 'canli', 'live'].includes(lower)) {
        setVurguCanli(true);
        setAramaDebounced('');
        void AnalyticsOlayEkle('discover_search', { screen: 'kisiler', kind: 'live' });
        return;
      }
      const ulkeEslesen = KISILER_ULKE_LISTESI().find(
        (u) => u.name.toLocaleLowerCase() === lower,
      );
      if (ulkeEslesen && q.length >= 3) {
        setUlke(ulkeEslesen.code);
        setAramaDebounced('');
        void AnalyticsOlayEkle('discover_search', { screen: 'kisiler', kind: 'country' });
        return;
      }
      setAramaDebounced(q.length >= 2 ? q : '');
    }, 350);
  };

  const profilAc = useCallback((userId: string) => {
    void AnalyticsOlayEkle('discover_profile_opened', { screen: 'kisiler' });
    router.push(`/kullanici/${userId}` as any);
  }, []);

  const mesajAc = useCallback(
    async (userId: string) => {
      void Haptics.selectionAsync();
      void AnalyticsOlayEkle('discover_intro_clicked', { screen: 'kisiler' });
      if (!featRef.current?.message_enabled) return;
      const r = await OzelSohbetAcVeyaGetir(userId);
      if (!r.ok) {
        Alert.alert(t('kisilerX.mesaj'), r.hata);
        return;
      }
      router.push(`/mesaj/${r.threadId}` as any);
    },
    [t],
  );

  const sesAc = useCallback((userId: string) => {
    void AnalyticsOlayEkle('discover_voice_clicked', { screen: 'kisiler' });
    setOnay({ userId, callType: 'audio' });
  }, []);

  const videoAc = useCallback((userId: string) => {
    void AnalyticsOlayEkle('discover_video_clicked', { screen: 'kisiler' });
    setOnay({ userId, callType: 'video' });
  }, []);

  const canliAc = useCallback((sessionId: string) => {
    void Haptics.selectionAsync();
    void AnalyticsOlayEkle('discover_live_opened', { screen: 'kisiler' });
    CanliYayinaGit(sessionId);
  }, []);

  const canliHostlar = useMemo(
    () => new Set(canlilar.map((c) => c.hostId)),
    [canlilar],
  );
  const cevrimiciler = useMemo(
    () => items.filter((k) => k.online_display).slice(0, 12),
    [items],
  );

  const sekmeler = useMemo(() => {
    const list: { id: KisilerKesifSekmesi; label: string }[] = [
      { id: 'for_you', label: t('kisilerX.sanaOzel') },
    ];
    if (feat?.gender_filter_enabled) {
      list.push({ id: 'female', label: t('kisilerX.kadin') });
      list.push({ id: 'male', label: t('kisilerX.erkek') });
    }
    return list;
  }, [feat?.gender_filter_enabled, t]);

  const aramaBaslat = async () => {
    if (!onay) return;
    setAramaBusy(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const r = await KisilerUcretliGorusmeBaslat(onay.userId, onay.callType);
      if (!r.ok) {
        if (r.error_code === 'calls_closed') {
          void KisilerAramaKapaliBildir(onay.userId, onay.callType);
        }
        Alert.alert(t('kisilerX.arama'), r.hata);
        return;
      }
      const callId = String((r.call as { id?: string }).id ?? '');
      if (!callId) {
        Alert.alert(t('kisilerX.arama'), t('kisilerX.cagriIdYok'));
        return;
      }
      setOnay(null);
      router.push(`/gorusme/${callId}` as any);
    } catch (e) {
      Alert.alert(t('kisilerX.arama'), e instanceof Error ? e.message : t('kisilerX.baslatilamadi'));
    } finally {
      setAramaBusy(false);
    }
  };

  const ulkeFiltresi = useMemo(() => {
    const list = KISILER_ULKE_LISTESI();
    const q = ulkeArama.trim().toLocaleLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLocaleLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q),
    );
  }, [ulkeArama, dil]);

  const showPrices = !!feat?.show_prices;
  const showOnline = !!feat?.show_online_indicators;
  const sesGlob = !!feat?.voice_call_enabled;
  const videoGlob = !!feat?.video_call_enabled;

  const renderKart: ListRenderItem<KisilerKesifKarti> = useCallback(
    ({ item }) => (
      <KisilerKart
        kart={item}
        genislik={kartGen}
        showPrices={showPrices}
        showOnline={showOnline}
        canli={canliHostlar.has(item.user_id)}
        sesEnabled={sesGlob && item.call_availability !== 'BUSY'}
        videoEnabled={videoGlob && item.call_availability !== 'BUSY'}
        onProfil={profilAc}
        onMesaj={mesajAc}
        onSesli={sesAc}
        onGoruntulu={videoAc}
      />
    ),
    [
      canliHostlar,
      kartGen,
      mesajAc,
      profilAc,
      sesAc,
      sesGlob,
      showOnline,
      showPrices,
      videoAc,
      videoGlob,
    ],
  );

  if (hata === 'feature_unavailable') {
    return (
      <Screen edges={['top']}>
        <EkranBasligi title={t('kisiler.baslik')} fallbackHref="/(tabs)" />
        <View style={styles.bos}>
          <Text style={styles.bosBaslik}>{t('kisiler.ozellikKapali')}</Text>
          <Pressable style={styles.cta} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.ctaYazi}>{t('kisiler.anaSayfayaDon')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const listeAltBosluk = insets.bottom + BoslukTokenlari.xl;

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="kisiler-kesif">
        <KlavyeGuvenliAlan style={styles.kok}>
          <FlatList
            style={styles.listeAlani}
            data={items}
            keyExtractor={(item) => item.user_id}
            renderItem={renderKart}
            numColumns={2}
            columnWrapperStyle={styles.satir}
            contentContainerStyle={[styles.liste, { paddingBottom: listeAltBosluk }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void raylariYukle();
                  void yukle({ refresh: true });
                }}
                tintColor={RenkTokenlari.primary}
              />
            }
            onEndReached={() => {
              if (cursor != null && !loadingMore) void yukle({ more: true });
            }}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
              <View>
                {/* Header ve arama liste ile birlikte kayar. */}
                <TamusoScreenHeader
                  title={t('kisiler.baslik')}
                  fallbackHref="/(tabs)"
                  rightAction={
                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setUlkeSheet(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('kisilerX.filtre')}
                      accessibilityState={{
                        selected: ulke != null || onlineOnly || vurguCanli,
                      }}
                      hitSlop={HeaderTokenlari.backHitSlop}
                      style={({ pressed }) => [
                        styles.filtreDugme,
                        pressed && styles.filtreDugmeBasili,
                      ]}
                    >
                      <Ionicons
                        name="options-outline"
                        size={20}
                        color={RenkTokenlari.text}
                      />
                      {ulke != null || onlineOnly || vurguCanli ? (
                        <View style={styles.filtreNokta} />
                      ) : null}
                    </Pressable>
                  }
                  search={
                    <View style={styles.ustKontroller}>
                      <View style={styles.aramaWrap}>
                        <View style={styles.aramaTint} pointerEvents="none" />
                        <Ionicons
                          name="search"
                          size={17}
                          color={RenkTokenlari.textMuted}
                        />
                        <TextInput
                          value={arama}
                          onChangeText={onAramaDegis}
                          placeholder={t('kisiler.araPlaceholder')}
                          placeholderTextColor={RenkTokenlari.textMuted}
                          accessibilityLabel={t('kisiler.araPlaceholder')}
                          style={styles.arama}
                          autoCorrect={false}
                          autoCapitalize="none"
                          returnKeyType="search"
                        />
                        {arama.length > 0 ? (
                          <Pressable
                            onPress={() => setArama('')}
                            hitSlop={8}
                            accessibilityLabel={t('kisilerX.temizle')}
                            style={styles.aramaTemizle}
                          >
                            <Ionicons
                              name="close"
                              size={14}
                              color={RenkTokenlari.textMuted}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.cipSatir}
                      >
                        {sekmeler.map((s) => (
                          <FiltreCip
                            key={s.id}
                            label={s.label}
                            aktif={tab === s.id}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              setTab(s.id);
                              void AnalyticsOlayEkle('discover_filter_used', {
                                screen: 'kisiler',
                                filter: s.id,
                              });
                            }}
                          />
                        ))}
                        {feat?.online_filter_enabled ? (
                          <FiltreCip
                            label={t('kisilerX.cevrimici')}
                            nokta={RenkTokenlari.mint}
                            aktif={onlineOnly}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              setOnlineOnly((v) => !v);
                              void AnalyticsOlayEkle('discover_filter_used', {
                                screen: 'kisiler',
                                filter: 'online',
                              });
                            }}
                          />
                        ) : null}
                        {OzellikBayragiAktifMi('live_enabled') ? (
                          <FiltreCip
                            label={t('kisiler.cipCanli')}
                            nokta={RenkTokenlari.danger}
                            aktif={vurguCanli}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              setVurguCanli((v) => !v);
                              void AnalyticsOlayEkle('discover_filter_used', {
                                screen: 'kisiler',
                                filter: 'live',
                              });
                            }}
                          />
                        ) : null}
                      </ScrollView>
                    </View>
                  }
                />

                <View style={styles.listeUst}>
                  {feat?.country_filter_enabled ? (
                    <KisilerUlkeSeridi
                      secili={ulke}
                      onSec={(kod) => {
                        setUlke(kod);
                        void AnalyticsOlayEkle('discover_world_opened', {
                          screen: 'kisiler',
                        });
                      }}
                      onTumunuAc={() => setUlkeSheet(true)}
                    />
                  ) : null}
                  <KisilerKesfetSeritleri
                    canlilar={canlilar}
                    cevrimiciler={cevrimiciler}
                    vurguCanli={vurguCanli}
                    onlineOnly={onlineOnly}
                    aramaMetni={arama}
                    onProfil={profilAc}
                    onCanli={canliAc}
                  />
                  {items.length > 0 || loading ? (
                    <View style={styles.bolumBaslikSatir}>
                      <Ionicons
                        name="sparkles"
                        size={15}
                        color={RenkTokenlari.primarySoft}
                      />
                      <Text style={styles.bolumBaslik}>
                        {onlineOnly ? t('kisilerX.cevrimici') : t('kisilerX.oneCikanlar')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.iskelet}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.iskeletKart, { width: kartGen }]} />
                  ))}
                </View>
              ) : (
                <View style={styles.bos}>
                  <Text style={styles.bosBaslik}>
                    {hata ?? t('kisilerX.filtreBos')}
                  </Text>
                  <Pressable
                    style={styles.cta}
                    onPress={() => {
                      if (hata) {
                        void yukle({ refresh: true });
                        return;
                      }
                      setUlke(null);
                      setOnlineOnly(false);
                      setVurguCanli(false);
                      setArama('');
                      setAramaDebounced('');
                    }}
                  >
                    <Text style={styles.ctaYazi}>
                      {hata ? t('ortak.tekrarDene') : t('kisilerX.filtreleriTemizle')}
                    </Text>
                  </Pressable>
                </View>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  color={RenkTokenlari.primary}
                  style={styles.sayfaYukleniyor}
                />
              ) : null
            }
          />
        </KlavyeGuvenliAlan>

        <KisilerAramaOnaySheet
          visible={!!onay}
          calleeId={onay?.userId ?? null}
          callType={onay?.callType ?? null}
          onKapat={() => setOnay(null)}
          onOnayla={() => void aramaBaslat()}
          busy={aramaBusy}
        />

        <Modal visible={ulkeSheet} transparent animationType="slide">
          <Pressable style={styles.modalBg} onPress={() => setUlkeSheet(false)}>
            <Pressable style={styles.ulkeSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.filtreBaslikSatir}>
                <Text style={styles.ulkeBaslik}>{t('kisilerX.filtreler')}</Text>
                <Pressable
                  onPress={() => setUlkeSheet(false)}
                  hitSlop={BoslukTokenlari.sm}
                  accessibilityRole="button"
                  accessibilityLabel={t('ortak.kapat')}
                  style={styles.filtreKapat}
                >
                  <Ionicons name="close" size={18} color={RenkTokenlari.textMuted} />
                </Pressable>
              </View>

              {feat?.online_filter_enabled ? (
                <AyarSatiri
                  icon="ellipse"
                  label={t('kisilerX.cevrimici')}
                  acik={onlineOnly}
                  onPress={() => setOnlineOnly((v) => !v)}
                />
              ) : null}
              {OzellikBayragiAktifMi('live_enabled') ? (
                <AyarSatiri
                  icon="radio"
                  label={t('kisiler.cipCanli')}
                  acik={vurguCanli}
                  onPress={() => setVurguCanli((v) => !v)}
                />
              ) : null}

              {ulke || onlineOnly || vurguCanli ? (
                <Pressable
                  style={styles.filtreTemizle}
                  onPress={() => {
                    setUlke(null);
                    setOnlineOnly(false);
                    setVurguCanli(false);
                  }}
                >
                  <Ionicons name="refresh" size={14} color={RenkTokenlari.primarySoft} />
                  <Text style={styles.filtreTemizleYazi}>
                    {t('kisilerX.filtreleriTemizle')}
                  </Text>
                </Pressable>
              ) : null}

              <Text style={styles.ulkeAltBaslik}>{t('kisilerX.ulke')}</Text>
              <TextInput
                value={ulkeArama}
                onChangeText={setUlkeArama}
                placeholder={t('kisilerX.ulkeAra')}
                placeholderTextColor={RenkTokenlari.textMuted}
                style={styles.ulkeArama}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Pressable
                style={styles.ulkeSatir}
                onPress={() => {
                  setUlke(null);
                  setUlkeSheet(false);
                }}
              >
                <Text style={styles.ulkeYazi}>{t('kisilerX.tumUlkeler')}</Text>
              </Pressable>
              <FlatList
                data={ulkeFiltresi}
                keyExtractor={(u) => u.code}
                style={{ maxHeight: ekranYuk * 0.45 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: u }) => (
                  <Pressable
                    style={styles.ulkeSatir}
                    onPress={() => {
                      setUlke(u.code);
                      setUlkeSheet(false);
                    }}
                  >
                    <Text style={styles.ulkeYazi}>
                      {ulkeBayragi(u.code)}  {u.name}
                    </Text>
                  </Pressable>
                )}
              />

              <Pressable
                style={styles.ayarBaglantisi}
                onPress={() => {
                  setUlkeSheet(false);
                  router.push('/ayarlar/kisiler-aramalar' as any);
                }}
              >
                <Ionicons
                  name="settings-outline"
                  size={15}
                  color={RenkTokenlari.textMuted}
                />
                <Text style={styles.ayarBaglantiYazi}>
                  {t('ayarlar.kisilerAramalar')}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={RenkTokenlari.textMuted}
                />
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ModulHataSiniri>
    </Screen>
  );
}

function AyarSatiri({
  icon,
  label,
  acik,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  acik: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: acik }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.ayarSatir, pressed && styles.ayarSatirBasili]}
    >
      <Ionicons
        name={icon}
        size={13}
        color={acik ? RenkTokenlari.primarySoft : RenkTokenlari.textMuted}
      />
      <Text style={[styles.ayarSatirYazi, acik && styles.ayarSatirYaziAcik]}>
        {label}
      </Text>
      <View style={[styles.anahtar, acik && styles.anahtarAcik]}>
        <View style={[styles.anahtarTopu, acik && styles.anahtarTopuAcik]} />
      </View>
    </Pressable>
  );
}

function FiltreCip({
  label,
  aktif,
  onPress,
  ikon,
  nokta,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
  ikon?: keyof typeof Ionicons.glyphMap;
  nokta?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={BoslukTokenlari.xs}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.filtre,
        aktif && styles.filtreAktif,
        pressed && styles.filtreBasili,
      ]}
    >
      {aktif ? (
        <LinearGradient
          colors={[...RenkTokenlari.gradientPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.filtreDolgu}
          pointerEvents="none"
        />
      ) : null}
      {nokta ? <View style={[styles.cipNokta, { backgroundColor: nokta }]} /> : null}
      {ikon ? (
        <Ionicons
          name={ikon}
          size={12}
          color={aktif ? RenkTokenlari.textOnOverlay : RenkTokenlari.primarySoft}
        />
      ) : null}
      <Text style={[styles.filtreYazi, aktif && styles.filtreYaziAktif]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    minHeight: 0,
    backgroundColor: RenkTokenlari.bg,
  },
  filtreDugme: {
    width: HeaderTokenlari.touchTarget,
    height: HeaderTokenlari.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: YaricapTokenlari.pill,
  },
  filtreDugmeBasili: {
    backgroundColor: RenkTokenlari.pressFill,
  },
  filtreNokta: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.primary,
    borderWidth: 1,
    borderColor: RenkTokenlari.bg,
  },
  ustKontroller: {
    gap: BoslukTokenlari.md,
  },
  listeAlani: {
    flex: 1,
  },
  aramaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    minHeight: 46,
    backgroundColor: RenkTokenlari.chipFill,
    borderRadius: YaricapTokenlari.pill,
    paddingHorizontal: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    overflow: 'hidden',
  },
  aramaTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: RenkTokenlari.primary,
    opacity: 0.12,
  },
  arama: {
    flex: 1,
    minWidth: 0,
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    paddingVertical: 0,
  },
  aramaTemizle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
  },
  cipSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: BoslukTokenlari.sm,
  },
  listeUst: {
    gap: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  bolumBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: BoslukTokenlari.xs,
    marginBottom: BoslukTokenlari.xs,
  },
  bolumBaslik: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.1,
    color: RenkTokenlari.text,
  },
  filtre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.chipFill,
  },
  filtreAktif: {
    borderColor: RenkTokenlari.primary,
  },
  filtreBasili: {
    opacity: 0.8,
  },
  filtreDolgu: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cipNokta: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filtreYazi: {
    ...TipografiTokenlari.micro,
    letterSpacing: 0,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  filtreYaziAktif: {
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },
  liste: {
    paddingTop: 0,
  },
  satir: {
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  iskelet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  iskeletKart: {
    aspectRatio: 0.68,
    borderRadius: YaricapTokenlari.xl,
    backgroundColor: RenkTokenlari.surface,
  },
  bos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: BoslukTokenlari.xl,
    gap: BoslukTokenlari.lg,
  },
  bosBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: RenkTokenlari.primary,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
  },
  ctaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
  },
  sayfaYukleniyor: {
    margin: BoslukTokenlari.lg,
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: RenkTokenlari.scrim,
  },
  ulkeSheet: {
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    backgroundColor: RenkTokenlari.bgElevated,
    padding: BoslukTokenlari.lg,
    maxHeight: '72%',
  },
  filtreBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: BoslukTokenlari.sm,
  },
  ulkeBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  filtreKapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
  },
  ayarSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    minHeight: HeaderTokenlari.touchTarget,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.pressFill,
    marginBottom: BoslukTokenlari.xs,
  },
  ayarSatirBasili: {
    opacity: 0.75,
  },
  ayarSatirYazi: {
    flex: 1,
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  ayarSatirYaziAcik: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  anahtar: {
    width: 34,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  anahtarAcik: {
    backgroundColor: RenkTokenlari.primary,
  },
  anahtarTopu: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: RenkTokenlari.textMuted,
  },
  anahtarTopuAcik: {
    alignSelf: 'flex-end',
    backgroundColor: RenkTokenlari.textOnPrimary,
  },
  filtreTemizle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 36,
    marginTop: BoslukTokenlari.xs,
    borderRadius: YaricapTokenlari.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.borderAccent,
  },
  filtreTemizleYazi: {
    ...TipografiTokenlari.micro,
    letterSpacing: 0,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  ulkeAltBaslik: {
    ...TipografiTokenlari.micro,
    letterSpacing: 0,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginTop: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.xs,
  },
  ayarBaglantisi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: HeaderTokenlari.touchTarget,
    marginTop: BoslukTokenlari.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.divider,
  },
  ayarBaglantiYazi: {
    flex: 1,
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  ulkeArama: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.pressFill,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: HeaderTokenlari.touchTarget,
    marginBottom: BoslukTokenlari.sm,
  },
  ulkeSatir: {
    paddingVertical: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.divider,
  },
  ulkeYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
});
