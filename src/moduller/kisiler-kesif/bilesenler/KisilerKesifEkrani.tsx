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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '../../../components/Screen';
import { EkranBasligi } from '../../../components/EkranBasligi';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
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
import { KISILER_ULKE_LISTESI, ulkeBayragi } from '../utils/KisilerYardimcilar';
import { useCeviri } from '../../../i18n/useCeviri';

type AramaHedefi = {
  userId: string;
  callType: 'audio' | 'video';
};

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aramaDebounced, setAramaDebounced] = useState('');
  const cursorRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const istekSayacRef = useRef(0);
  const configRef = useRef<KisilerConfig | null>(null);

  const feat = features ?? config;

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

  const onAramaDegis = (t: string) => {
    setArama(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAramaDebounced(t.trim().length >= 2 ? t.trim() : '');
    }, 350);
  };

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

  const mesajAc = async (userId: string) => {
    if (!feat?.message_enabled) return;
    const r = await OzelSohbetAcVeyaGetir(userId);
    if (!r.ok) {
      Alert.alert(t('kisilerX.mesaj'), r.hata);
      return;
    }
    router.push(`/mesaj/${r.threadId}` as any);
  };

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

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="kisiler-kesif">
        <LinearGradient
          colors={['#12081a', '#0a0a12', '#0d0614']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <EkranBasligi
          title={t('kisiler.baslik')}
          subtitle={t('kisiler.altBaslik')}
          fallbackHref="/(tabs)"
          right={
            <Pressable
              onPress={() => router.push('/ayarlar/kisiler-aramalar' as any)}
              accessibilityLabel={t('ayarlar.kisilerAramalar')}
              hitSlop={10}
            >
              <Ionicons name="options-outline" size={22} color={RenkTokenlari.text} />
            </Pressable>
          }
        />

        <View style={styles.headerGlass}>
          <CamArkaplan intensity={28} hafif style={StyleSheet.absoluteFill} />
          <View style={styles.aramaWrap}>
            <Ionicons name="search" size={16} color={RenkTokenlari.textMuted} />
            <TextInput
              value={arama}
              onChangeText={onAramaDegis}
              placeholder={t('kisiler.araPlaceholder')}
              placeholderTextColor={RenkTokenlari.textMuted}
              style={styles.arama}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.sekmeler}>
            {sekmeler.map((s) => {
              const aktif = tab === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setTab(s.id);
                  }}
                  style={[styles.sekme, aktif && styles.sekmeAktif]}
                >
                  <Text style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.filtreler}>
            {feat?.country_filter_enabled ? (
              <FiltreCip
                label={ulke ? `${ulkeBayragi(ulke)} ${ulke}` : t('kisilerX.ulke')}
                aktif={!!ulke}
                onPress={() => setUlkeSheet(true)}
              />
            ) : null}
            {feat?.online_filter_enabled ? (
              <FiltreCip
                label={t('kisilerX.cevrimici')}
                aktif={onlineOnly}
                onPress={() => setOnlineOnly((v) => !v)}
              />
            ) : null}
            {(ulke || onlineOnly) && (
              <FiltreCip
                label={t('kisilerX.temizle')}
                aktif={false}
                onPress={() => {
                  setUlke(null);
                  setOnlineOnly(false);
                }}
              />
            )}
          </View>

          {tab === 'for_you' && feat?.personalized_enabled ? (
            <Text style={styles.info}>
              {t('kisilerX.onerilerInfo')}
            </Text>
          ) : null}
        </View>

        {loading && items.length === 0 ? (
          <View style={styles.iskelet}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.iskeletKart} />
            ))}
          </View>
        ) : hata ? (
          <View style={styles.bos}>
            <Text style={styles.bosBaslik}>{hata}</Text>
            <Pressable style={styles.cta} onPress={() => void yukle({ refresh: true })}>
              <Text style={styles.ctaYazi}>{t('ortak.tekrarDene')}</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.bos}>
            <Text style={styles.bosBaslik}>{t('kisilerX.filtreBos')}</Text>
            <Pressable
              style={styles.cta}
              onPress={() => {
                setUlke(null);
                setOnlineOnly(false);
                setArama('');
                setAramaDebounced('');
              }}
            >
              <Text style={styles.ctaYazi}>{t('kisilerX.filtreleriTemizle')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.user_id}
            numColumns={2}
            columnWrapperStyle={styles.satir}
            contentContainerStyle={styles.liste}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void yukle({ refresh: true })}
                tintColor={RenkTokenlari.primary}
              />
            }
            onEndReached={() => {
              if (cursor != null && !loadingMore) void yukle({ more: true });
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator color={RenkTokenlari.primary} style={{ margin: 16 }} />
              ) : null
            }
            renderItem={({ item }) => (
              <KisilerKart
                kart={item}
                showPrices={!!feat?.show_prices}
                showOnline={!!feat?.show_online_indicators}
                sesEnabled={
                  !!feat?.voice_call_enabled && item.call_availability !== 'BUSY'
                }
                videoEnabled={
                  !!feat?.video_call_enabled && item.call_availability !== 'BUSY'
                }
                onProfil={() => router.push(`/kullanici/${item.user_id}` as any)}
                onMesaj={() => void mesajAc(item.user_id)}
                onSesli={() => setOnay({ userId: item.user_id, callType: 'audio' })}
                onGoruntulu={() => setOnay({ userId: item.user_id, callType: 'video' })}
              />
            )}
          />
        )}

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
              <CamArkaplan intensity={40} hafif style={StyleSheet.absoluteFill} />
              <Text style={styles.ulkeBaslik}>{t('kisilerX.ulke')}</Text>
              <TextInput
                value={ulkeArama}
                onChangeText={setUlkeArama}
                placeholder={t('kisilerX.ulkeAra')}
                placeholderTextColor={RenkTokenlari.textMuted}
                style={styles.arama}
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
                style={{ maxHeight: 360 }}
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
            </Pressable>
          </Pressable>
        </Modal>
      </ModulHataSiniri>
    </Screen>
  );
}

function FiltreCip({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filtre, aktif && styles.filtreAktif]}
    >
      <Text style={[styles.filtreYazi, aktif && styles.filtreYaziAktif]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerGlass: {
    marginHorizontal: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.sm,
  },
  aramaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: YaricapTokenlari.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  arama: {
    flex: 1,
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    paddingVertical: 4,
  },
  sekmeler: {
    flexDirection: 'row',
    gap: 8,
  },
  sekme: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sekmeAktif: {
    backgroundColor: RenkTokenlari.primary,
  },
  sekmeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  sekmeYaziAktif: {
    color: '#fff',
  },
  filtreler: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filtre: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  filtreAktif: {
    borderColor: RenkTokenlari.mint,
    backgroundColor: `${RenkTokenlari.mint}22`,
  },
  filtreYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  filtreYaziAktif: {
    color: RenkTokenlari.mint,
  },
  info: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
  },
  liste: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: 120,
  },
  satir: {
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.md,
  },
  iskelet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  iskeletKart: {
    width: '47%',
    aspectRatio: 0.65,
    borderRadius: YaricapTokenlari.xl,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: BoslukTokenlari.xl,
    gap: 16,
  },
  bosBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: RenkTokenlari.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.lg,
  },
  ctaYazi: {
    ...TipografiTokenlari.caption,
    color: '#fff',
  },
  modalBg: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  ulkeSheet: {
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    padding: BoslukTokenlari.lg,
    maxHeight: '70%',
  },
  ulkeBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginBottom: 12,
  },
  ulkeSatir: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  ulkeYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
});
