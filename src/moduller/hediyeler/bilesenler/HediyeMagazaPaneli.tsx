import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { CanliHediyeSimgesi } from '../../cuzdan/bilesenler/CanliCoinSimgesi';
import { CoinPaketMagaza } from '../../cuzdan/bilesenler/CoinPaketMagaza';
import type { CoinPackage, Gift, GiftRarity } from '../../../types/models';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { HediyePkAlici } from '../islemler/HediyeMagazaTipleri';

const ANDROID = Platform.OS === 'android';
const SUTUN = 5;

const SHEET_GIRIS = ANDROID
  ? undefined
  : SlideInDown.duration(260).easing(Easing.out(Easing.cubic));
const SHEET_CIKIS = ANDROID
  ? undefined
  : SlideOutDown.duration(180).easing(Easing.in(Easing.cubic));
const PERDE_GIRIS = ANDROID ? undefined : FadeIn.duration(180);
const PERDE_CIKIS = ANDROID ? undefined : FadeOut.duration(140);

const SEKMELER: { id: 'populer' | 'all' | GiftRarity; label: string }[] = [
  { id: 'populer', label: 'Popüler' },
  { id: 'all', label: 'Tümü' },
  { id: 'common', label: 'Klasik' },
  { id: 'rare', label: 'Nadir' },
  { id: 'epic', label: 'Lüks' },
  { id: 'legendary', label: 'Efsane' },
];

const ADET_SECENEKLERI = [1, 7, 17, 77, 188, 777] as const;

type Props = {
  visible: boolean;
  gifts: Gift[];
  coins?: number;
  aliciAdi?: string | null;
  pkAlicilar?: HediyePkAlici[];
  seciliPkAliciId?: string | null;
  onPkAliciSec?: (id: string) => void;
  onSend: (gift: Gift, quantity: number) => void;
  onClose: () => void;
  /** Eski: ayrı Modal. coinPackages verilirse panel içi moda geçilir (iOS güvenli). */
  onCoinYukle?: () => void;
  /** Panel içi coin yükleme — ikinci Modal açılmaz */
  coinPackages?: CoinPackage[];
  coinLocked?: boolean;
  onCoinBuy?: (pkg: CoinPackage) => void;
  onCoinPaketHazirla?: () => void;
  /** Gönderim sürerken buton kilidi */
  gonderiyor?: boolean;
};

type KartProps = {
  item: Gift;
  aktif: boolean;
  ucuz: boolean;
  onSec: (g: Gift) => void;
  onHizliGonder: (g: Gift) => void;
};

const HediyeKart = React.memo(function HediyeKart({
  item,
  aktif,
  ucuz,
  onSec,
  onHizliGonder,
}: KartProps) {
  return (
    <Pressable
      onPress={() => onSec(item)}
      onLongPress={() => onHizliGonder(item)}
      delayLongPress={280}
      style={[
        styles.hediye,
        aktif && styles.hediyeAktif,
        ucuz && styles.hediyeUcuz,
      ]}
    >
      <CanliHediyeSimgesi emoji={item.emoji} size={30} secili={aktif} />
      <Text style={styles.hediyeAd} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.fiyatSatir}>
        <Text style={styles.coinIcon}>🪙</Text>
        <Text style={styles.fiyat}>
          {item.coin_cost.toLocaleString('tr-TR')}
        </Text>
      </View>
    </Pressable>
  );
});

export function HediyeMagazaPaneli({
  visible,
  gifts,
  coins,
  aliciAdi,
  pkAlicilar,
  seciliPkAliciId,
  onPkAliciSec,
  onSend,
  onClose,
  onCoinYukle,
  coinPackages,
  coinLocked,
  onCoinBuy,
  onCoinPaketHazirla,
  gonderiyor = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]['id']>('populer');
  const [secili, setSecili] = useState<Gift | null>(null);
  const [adet, setAdet] = useState(1);
  /** Aynı Modal içinde coin paketleri — iOS ikinci Modal açmaz */
  const [coinModu, setCoinModu] = useState(false);
  const icindeCoin = coinPackages != null && !!onCoinBuy;

  /** Android nav / gesture çubuğu — kartı yukarı, Gönder tıklanabilir */
  const sheetLift = ANDROID
    ? Math.max(insets.bottom, 12) + 20
    : Math.max(insets.bottom, 8);
  const sheetPadBottom = ANDROID
    ? Math.max(insets.bottom, 10) + 14
    : Math.max(insets.bottom, 8) + BoslukTokenlari.md;

  const sirali = useMemo(
    () => [...gifts].sort((a, b) => a.coin_cost - b.coin_cost),
    [gifts],
  );

  const liste = useMemo(() => {
    if (sekme === 'populer') {
      return sirali
        .filter(
          (g) =>
            g.coin_cost <= 999 ||
            g.code === 'rose' ||
            g.code === 'heart' ||
            g.code === 'crown' ||
            g.code === 'rocket' ||
            g.rarity === 'rare',
        )
        .slice(0, 24);
    }
    if (sekme === 'all') return sirali;
    return sirali.filter((g) => g.rarity === sekme);
  }, [sekme, sirali]);

  useEffect(() => {
    if (!visible) {
      setAdet(1);
      setCoinModu(false);
      return;
    }
    if (!secili && liste[0]) setSecili(liste[0]);
  }, [visible, liste, secili]);

  useEffect(() => {
    if (secili && !liste.some((g) => g.id === secili.id) && liste[0]) {
      setSecili(liste[0]);
    }
  }, [liste, secili]);

  const toplam = secili != null ? secili.coin_cost * adet : 0;
  const yetmez = coins != null && toplam > coins;

  const coinAc = useCallback(() => {
    if (icindeCoin) {
      setCoinModu(true);
      onCoinPaketHazirla?.();
      return;
    }
    onCoinYukle?.();
  }, [icindeCoin, onCoinPaketHazirla, onCoinYukle]);

  const onSec = useCallback((g: Gift) => setSecili(g), []);
  const onHizliGonder = useCallback(
    (g: Gift) => {
      if (gonderiyor) return;
      setSecili(g);
      setAdet(1);
      if (coins != null && g.coin_cost > coins) {
        coinAc();
        return;
      }
      onSend(g, 1);
    },
    [coins, coinAc, gonderiyor, onSend],
  );

  const gonder = useCallback(() => {
    if (!secili || gonderiyor) return;
    if (yetmez) {
      coinAc();
      return;
    }
    onSend(secili, adet);
  }, [adet, coinAc, gonderiyor, onSend, secili, yetmez]);

  const renderItem = useCallback(
    ({ item }: { item: Gift }) => (
      <HediyeKart
        item={item}
        aktif={secili?.id === item.id}
        ucuz={coins != null && item.coin_cost > coins}
        onSec={onSec}
        onHizliGonder={onHizliGonder}
      />
    ),
    [coins, onHizliGonder, onSec, secili?.id],
  );

  const keyExtractor = useCallback((item: Gift) => item.id, []);

  const extraData = useMemo(
    () => ({ seciliId: secili?.id, coins }),
    [secili?.id, coins],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={ANDROID ? 'fade' : 'none'}
      onRequestClose={() => {
        if (coinModu) {
          setCoinModu(false);
          return;
        }
        onClose();
      }}
      statusBarTranslucent
      hardwareAccelerated
      presentationStyle="overFullScreen"
    >
      <View style={[styles.root, { paddingBottom: sheetLift }]}>
        <Pressable
          style={styles.perde}
          onPress={() => {
            if (coinModu) {
              setCoinModu(false);
              return;
            }
            onClose();
          }}
        >
          {PERDE_GIRIS ? (
            <Animated.View
              entering={PERDE_GIRIS}
              exiting={PERDE_CIKIS}
              style={[StyleSheet.absoluteFill, styles.perdeRenk]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.perdeRenk]} />
          )}
        </Pressable>

        <Animated.View
          entering={SHEET_GIRIS}
          exiting={SHEET_CIKIS}
          style={[styles.sheet, coinModu && styles.sheetCoin]}
        >
          <CamArkaplan
            intensity={ANDROID ? 0 : 36}
            hafif={ANDROID}
            style={StyleSheet.absoluteFill}
            fallbackColor={RenkTokenlari.bgElevated}
            pointerEvents="none"
          />
          <View style={[styles.sheetIc, { paddingBottom: sheetPadBottom }]}>
            <View style={styles.handle} />

            <View style={styles.ust}>
              <View style={{ flex: 1 }}>
                <Text style={styles.baslik}>
                  {coinModu ? 'Coin yükle' : 'Hediye gönder'}
                </Text>
                <Text style={styles.alt}>
                  {coinModu
                    ? '1 coin = 0,10 ₺ · anında yükle'
                    : aliciAdi
                      ? `Alıcı: ${aliciAdi}`
                      : 'Canlı hediyeler'}
                  {coinModu ? '' : ` · ${sirali.length}`}
                </Text>
              </View>
              {coinModu ? (
                <Pressable
                  onPress={() => setCoinModu(false)}
                  style={styles.kapatBtn}
                  hitSlop={8}
                  accessibilityLabel="Hediyeye dön"
                >
                  <Ionicons
                    name="arrow-back"
                    size={20}
                    color={RenkTokenlari.textMuted}
                  />
                </Pressable>
              ) : (
                <Pressable onPress={onClose} style={styles.kapatBtn} hitSlop={8}>
                  <Ionicons
                    name="close"
                    size={20}
                    color={RenkTokenlari.textMuted}
                  />
                </Pressable>
              )}
            </View>

            {coinModu && coinPackages && onCoinBuy ? (
              <ScrollView
                style={styles.coinScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.coinScrollIc}
                keyboardShouldPersistTaps="handled"
              >
                <CoinPaketMagaza
                  packages={coinPackages}
                  locked={coinLocked}
                  onBuy={onCoinBuy}
                  baslikGoster={false}
                  onPaketleriYenile={onCoinPaketHazirla}
                />
              </ScrollView>
            ) : (
              <>
                {pkAlicilar && pkAlicilar.length > 1 ? (
                  <View style={styles.pkAlicilar}>
                    <Text style={styles.pkBaslik}>PK — kime?</Text>
                    <View style={styles.pkSatir}>
                      {pkAlicilar.map((a) => {
                        const aktif = seciliPkAliciId === a.id;
                        return (
                          <Pressable
                            key={a.id}
                            onPress={() => onPkAliciSec?.(a.id)}
                            style={[styles.pkChip, aktif && styles.pkChipAktif]}
                          >
                            <Text
                              style={[
                                styles.pkChipYazi,
                                aktif && styles.pkChipYaziAktif,
                              ]}
                              numberOfLines={1}
                            >
                              {a.side === 'a' ? '🔵 ' : a.side === 'b' ? '🩷 ' : ''}
                              {a.ad}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sekmeler}
                >
                  {SEKMELER.map((s) => {
                    const aktif = sekme === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setSekme(s.id)}
                        style={[styles.sekme, aktif && styles.sekmeAktif]}
                      >
                        <Text
                          style={[
                            styles.sekmeYazi,
                            aktif && styles.sekmeYaziAktif,
                          ]}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.gridWrap}>
                  <FlashList
                    data={liste}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    numColumns={SUTUN}
                    extraData={extraData}
                    showsVerticalScrollIndicator={false}
                    drawDistance={ANDROID ? 180 : 250}
                    contentContainerStyle={styles.grid}
                  />
                </View>

                <View style={styles.adetBar}>
                  <Text style={styles.adetEtiket}>Adet</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.adetList}
                  >
                    {ADET_SECENEKLERI.map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setAdet(n)}
                        style={[
                          styles.adetChip,
                          adet === n && styles.adetChipAktif,
                        ]}
                      >
                        <Text
                          style={[
                            styles.adetChipYazi,
                            adet === n && styles.adetChipYaziAktif,
                          ]}
                        >
                          ×{n}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.altBar}>
                  <Pressable
                    style={styles.bakiye}
                    onPress={coinAc}
                    disabled={!icindeCoin && !onCoinYukle}
                  >
                    <Text style={styles.bakiyeIcon}>🪙</Text>
                    <Text style={styles.bakiyeYazi}>
                      {(coins ?? 0).toLocaleString('tr-TR')}
                    </Text>
                    {icindeCoin || onCoinYukle ? (
                      <Ionicons
                        name="add-circle"
                        size={18}
                        color={RenkTokenlari.accent}
                      />
                    ) : null}
                  </Pressable>

                  <Pressable
                    onPress={gonder}
                    disabled={!secili || gonderiyor}
                    hitSlop={{ top: 10, bottom: 14, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      styles.gonderWrap,
                      (!secili || gonderiyor) && { opacity: 0.45 },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <LinearGradient
                      colors={
                        yetmez
                          ? ['#F5C462', '#E8A838']
                          : [...RenkTokenlari.gradientPrimary]
                      }
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.gonder}
                    >
                      <Text
                        style={[
                          styles.gonderYazi,
                          yetmez && { color: '#1A1208' },
                        ]}
                      >
                        {gonderiyor
                          ? 'Gönderiliyor…'
                          : yetmez
                            ? 'Coin yükle'
                            : `Gönder${secili ? ` · ${toplam.toLocaleString('tr-TR')}` : ''}`}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  perde: { ...StyleSheet.absoluteFill },
  perdeRenk: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '72%',
    minHeight: '52%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgElevated,
    zIndex: 2,
    elevation: ANDROID ? 16 : 24,
  },
  sheetCoin: {
    maxHeight: '88%',
    minHeight: '70%',
  },
  coinScroll: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  coinScrollIc: {
    paddingBottom: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  sheetIc: {
    flex: 1,
    zIndex: 2,
    elevation: 6,
    gap: BoslukTokenlari.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 10,
    marginBottom: 4,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 18,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 2,
  },
  kapatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  sekmeler: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: 8,
    paddingVertical: 4,
  },
  sekme: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sekmeAktif: {
    backgroundColor: 'rgba(232,64,145,0.28)',
  },
  sekmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  sekmeYaziAktif: {
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  gridWrap: {
    height: ANDROID ? 240 : 268,
    paddingHorizontal: BoslukTokenlari.xs,
  },
  grid: {
    paddingHorizontal: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.sm,
  },
  hediye: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    gap: 3,
    margin: 2,
  },
  hediyeAktif: {
    backgroundColor: 'rgba(232,64,145,0.18)',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  hediyeUcuz: { opacity: 0.45 },
  pkAlicilar: {
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
    gap: 6,
  },
  pkBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontWeight: '800',
  },
  pkSatir: { flexDirection: 'row', gap: 8 },
  pkChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  pkChipAktif: {
    borderColor: '#F0B429',
    backgroundColor: 'rgba(240,180,41,0.16)',
  },
  pkChipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  pkChipYaziAktif: { color: RenkTokenlari.text },
  hediyeAd: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  fiyatSatir: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  coinIcon: { fontSize: 9 },
  fiyat: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    fontSize: 10,
  },
  adetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
  },
  adetEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
  },
  adetList: { gap: 6, alignItems: 'center' },
  adetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  adetChipAktif: {
    borderColor: RenkTokenlari.accent,
    backgroundColor: 'rgba(240,180,41,0.16)',
  },
  adetChipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  adetChipYaziAktif: { color: RenkTokenlari.accent },
  altBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
  },
  bakiye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  bakiyeIcon: { fontSize: 14 },
  bakiyeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  gonderWrap: { flex: 1 },
  gonder: {
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: ANDROID ? 16 : 14,
    alignItems: 'center',
    minHeight: ANDROID ? 52 : 48,
    justifyContent: 'center',
  },
  gonderYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
});
