import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { CanliHediyeSimgesi } from '../../cuzdan/bilesenler/CanliCoinSimgesi';
import type { Gift, GiftRarity } from '../../../types/models';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

const SHEET_GIRIS = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));
const SHEET_CIKIS = SlideOutDown.duration(200).easing(Easing.in(Easing.cubic));
const PERDE_GIRIS = FadeIn.duration(200);
const PERDE_CIKIS = FadeOut.duration(160);

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
  onSend: (gift: Gift, quantity: number) => void;
  onClose: () => void;
  onCoinYukle?: () => void;
};

export function HediyeMagazaPaneli({
  visible,
  gifts,
  coins,
  aliciAdi,
  onSend,
  onClose,
  onCoinYukle,
}: Props) {
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]['id']>('populer');
  const [secili, setSecili] = useState<Gift | null>(null);
  const [adet, setAdet] = useState(1);

  const sirali = useMemo(
    () => [...gifts].sort((a, b) => a.coin_cost - b.coin_cost),
    [gifts],
  );

  const liste = useMemo(() => {
    if (sekme === 'populer') {
      return sirali.filter(
        (g) =>
          g.coin_cost <= 999 ||
          g.code === 'rose' ||
          g.code === 'heart' ||
          g.code === 'crown' ||
          g.code === 'rocket' ||
          g.rarity === 'rare',
      ).slice(0, 24);
    }
    if (sekme === 'all') return sirali;
    return sirali.filter((g) => g.rarity === sekme);
  }, [sekme, sirali]);

  useEffect(() => {
    if (!visible) return;
    if (!secili && liste[0]) setSecili(liste[0]);
  }, [visible, liste, secili]);

  useEffect(() => {
    if (secili && !liste.some((g) => g.id === secili.id) && liste[0]) {
      setSecili(liste[0]);
    }
  }, [liste, secili]);

  const toplam =
    secili != null ? secili.coin_cost * adet : 0;
  const yetmez = coins != null && toplam > coins;

  const gonder = () => {
    if (!secili || yetmez) return;
    onSend(secili, adet);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.perde} onPress={onClose}>
          <Animated.View
            entering={PERDE_GIRIS}
            exiting={PERDE_CIKIS}
            style={[StyleSheet.absoluteFill, styles.perdeRenk]}
          />
        </Pressable>

        <Animated.View
          entering={SHEET_GIRIS}
          exiting={SHEET_CIKIS}
          style={styles.sheet}
        >
          <CamArkaplan
            intensity={40}
            tint="dark"
            style={StyleSheet.absoluteFill}
            fallbackColor={RenkTokenlari.bgElevated}
            pointerEvents="none"
          />
          <View style={styles.sheetIc}>
            <View style={styles.handle} />

            <View style={styles.ust}>
              <View style={{ flex: 1 }}>
                <Text style={styles.baslik}>Hediye gönder</Text>
                <Text style={styles.alt}>
                  {aliciAdi ? `Alıcı: ${aliciAdi}` : 'TikTok tarzı canlı hediyeler'}
                  {` · ${sirali.length} simge`}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.kapatBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={RenkTokenlari.textMuted} />
              </Pressable>
            </View>

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
                    <Text style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
            >
              {liste.map((item, index) => {
                const aktif = secili?.id === item.id;
                const ucuz = coins != null && item.coin_cost > coins;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSecili(item)}
                    onLongPress={() => {
                      setSecili(item);
                      setAdet(1);
                      if (!(coins != null && item.coin_cost > coins)) {
                        onSend(item, 1);
                      }
                    }}
                    style={[
                      styles.hediye,
                      aktif && styles.hediyeAktif,
                      ucuz && { opacity: 0.45 },
                    ]}
                  >
                    <CanliHediyeSimgesi
                      emoji={item.emoji}
                      size={32}
                      delayMs={40 + (index % 12) * 28}
                      secili={aktif}
                    />
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
              })}
            </ScrollView>

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
                    style={[styles.adetChip, adet === n && styles.adetChipAktif]}
                  >
                    <Text
                      style={[
                        styles.adetChipYazi,
                        adet === n && styles.adetChipYaziAktif,
                      ]}
                    >
                      x{n}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.altBar}>
              <Pressable
                style={styles.bakiye}
                onPress={onCoinYukle}
                disabled={!onCoinYukle}
              >
                <Text style={styles.bakiyeIcon}>🪙</Text>
                <Text style={styles.bakiyeYazi}>
                  {(coins ?? 0).toLocaleString('tr-TR')}
                </Text>
                {onCoinYukle ? (
                  <Ionicons
                    name="add-circle"
                    size={18}
                    color={RenkTokenlari.accent}
                  />
                ) : null}
              </Pressable>

              <Pressable
                onPress={gonder}
                disabled={!secili || yetmez}
                style={({ pressed }) => [
                  styles.gonderWrap,
                  (!secili || yetmez) && { opacity: 0.45 },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gonder}
                >
                  <Text style={styles.gonderYazi}>
                    {yetmez
                      ? 'Yetersiz coin'
                      : `Gönder${secili ? ` · ${toplam.toLocaleString('tr-TR')}` : ''}`}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
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
    elevation: 24,
  },
  sheetIc: {
    flex: 1,
    zIndex: 2,
    elevation: 6,
    paddingBottom: BoslukTokenlari.lg,
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
  gridScroll: { flexGrow: 0, maxHeight: 280 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.sm,
  },
  hediye: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    gap: 3,
  },
  hediyeAktif: {
    backgroundColor: 'rgba(232,64,145,0.18)',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  gonderYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
});
