/**
 * Instagram Reels tarzı yukarı çekilebilir yorum kartı.
 * Klavye açıkken de sürüklenerek büyütülüp küçültülebilir.
 */

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  children: ReactNode;
  /** Klavye açık — kart yine büyütülebilir; varsayılan orta yükseklik */
  klavyeAcik?: boolean;
  onClose?: () => void;
  baslik?: string;
  /**
   * Parent tek kabuk sağlıyorsa: kendi border/arka plan yok
   * (ses odası alt kartı ile birleşik görünüm).
   */
  birlesik?: boolean;
};

const EKRAN_H = Dimensions.get('window').height;
/** Kompakt varsayılan — sahneyi boğmasın */
const COLLAPSED = 88;
/** Yazarken okunabilir orta boy */
const MID_KLAVYE = 160;
const EXPANDED = Math.min(Math.round(EKRAN_H * 0.42), 340);
/** Klavye açıkken üst sınır (sahne + klavye payı) */
const EXPANDED_KLAVYE = Math.min(Math.round(EKRAN_H * 0.32), 260);
const SPRING = { damping: 26, stiffness: 280, mass: 0.8 };
const HIZ_ESIK = 650;

export function CanliYorumCekilebilirKart({
  children,
  klavyeAcik = false,
  onClose,
  baslik = 'Yorumlar',
  birlesik = false,
}: Props) {
  const [genis, setGenis] = useState(false);
  const heightSv = useSharedValue(COLLAPSED);
  const dragStartH = useSharedValue(COLLAPSED);
  const maxH = klavyeAcik ? EXPANDED_KLAVYE : EXPANDED;

  useEffect(() => {
    if (klavyeAcik) {
      // Yazmaya geçince okunabilir boyuta aç; kullanıcı sonra sürükleyebilir
      setGenis(true);
      heightSv.value = withSpring(MID_KLAVYE, SPRING);
      return;
    }
    heightSv.value = withSpring(genis ? EXPANDED : COLLAPSED, SPRING);
  }, [klavyeAcik, heightSv]);

  // klavye kapalıyken genis değişince snap
  useEffect(() => {
    if (klavyeAcik) return;
    heightSv.value = withSpring(genis ? EXPANDED : COLLAPSED, SPRING);
  }, [genis, klavyeAcik, heightSv]);

  const snap = useCallback((acik: boolean) => {
    setGenis(acik);
  }, []);

  const toggle = useCallback(() => {
    if (klavyeAcik) {
      const hedef = heightSv.value > (MID_KLAVYE + EXPANDED_KLAVYE) / 2
        ? MID_KLAVYE
        : EXPANDED_KLAVYE;
      heightSv.value = withSpring(hedef, SPRING);
      setGenis(hedef >= EXPANDED_KLAVYE - 8);
      return;
    }
    snap(!genis);
  }, [genis, klavyeAcik, snap, heightSv]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-28, 28])
        .onBegin(() => {
          dragStartH.value = heightSv.value;
        })
        .onUpdate((e) => {
          'worklet';
          const ust = klavyeAcik ? EXPANDED_KLAVYE : EXPANDED;
          const next = dragStartH.value - e.translationY;
          heightSv.value = Math.min(ust, Math.max(COLLAPSED, next));
        })
        .onEnd((e) => {
          'worklet';
          const ust = klavyeAcik ? EXPANDED_KLAVYE : EXPANDED;
          const orta = klavyeAcik ? MID_KLAVYE : (COLLAPSED + EXPANDED) / 2;
          const hizYukari = e.velocityY < -HIZ_ESIK;
          const hizAsagi = e.velocityY > HIZ_ESIK;
          let hedef = orta;
          if (hizYukari) hedef = ust;
          else if (hizAsagi) hedef = COLLAPSED;
          else if (heightSv.value >= (orta + ust) / 2) hedef = ust;
          else if (heightSv.value <= (COLLAPSED + orta) / 2) hedef = COLLAPSED;
          else hedef = klavyeAcik ? MID_KLAVYE : COLLAPSED;
          heightSv.value = withSpring(hedef, SPRING);
          runOnJS(setGenis)(hedef > COLLAPSED + 24);
        }),
    [klavyeAcik, heightSv, dragStartH],
  );

  const kartStil = useAnimatedStyle(() => ({
    height: heightSv.value,
  }));

  return (
    <Animated.View
      style={[
        styles.kart,
        birlesik && styles.kartBirlesik,
        { maxHeight: maxH },
        kartStil,
      ]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View style={styles.handleWrap}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Pressable
              onPress={toggle}
              hitSlop={8}
              style={styles.baslikHit}
              accessibilityRole="button"
              accessibilityLabel={
                genis ? 'Yorumları küçült' : 'Yorumları büyüt'
              }
            >
              <Text style={styles.baslik}>{baslik}</Text>
              <Ionicons
                name={genis ? 'chevron-down' : 'chevron-up'}
                size={12}
                color={RenkTokenlari.textMuted}
              />
            </Pressable>
            {onClose ? (
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.close}
                accessibilityLabel="Yorumları gizle"
              >
                <Ionicons
                  name="close"
                  size={14}
                  color={RenkTokenlari.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>

      <View
        style={[styles.body, birlesik && styles.bodyBirlesik]}
        pointerEvents="box-none"
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: 14,
    backgroundColor: 'rgba(14, 12, 20, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    minHeight: COLLAPSED,
  },
  kartBirlesik: {
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  handleWrap: {
    paddingTop: 5,
    paddingBottom: 2,
    paddingHorizontal: 10,
    zIndex: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslikHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  close: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  bodyBirlesik: {
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
});
