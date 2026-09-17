/**

 * Büyük kazanç overlay — sinematik rays + pulse rings + count-up.

 */



import React, { memo, useEffect, useRef, useState } from 'react';

import {

  ActivityIndicator,

  Modal,

  Pressable,

  StyleSheet,

  Text,

  useWindowDimensions,

  View,

} from 'react-native';

import Animated, {

  Easing,

  FadeIn,

  ZoomIn,

  useAnimatedStyle,

  useSharedValue,

  withRepeat,

  withSequence,

  withTiming,

} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';

import { WIN_HOLD_MS, WIN_TIER_LABELS, winCountDurationMs } from '../sabitler/KaskadSabitleri';

import type { PerformanceProfile, WinTier } from '../tipler/KaskadTipleri';

import { AnimatedNumber, type AnimatedNumberHandle } from './AnimatedNumber';

import { ParticleBurst } from './ParticleController';

import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';



type Props = {

  visible: boolean;

  tier: WinTier;

  amount: number;

  baseWin: number;

  totalMultiplier: number;

  performance?: PerformanceProfile;

  sharing?: boolean;

  shared?: boolean;

  onShare?: () => void;

  onDone: () => void;

};



function durationForTier(tier: WinTier): number {

  return winCountDurationMs(tier);

}



const TIER_GRADIENTS: Record<

  Exclude<WinTier, 'NONE'>,

  readonly [string, string, string]

> = {

  STORM: ['#0E1A33', '#1E3A6E', '#4DA3FF'],

  THUNDER: ['#1A0A2E', '#4A1A8A', '#C43BFF'],

  COSMIC: ['#2A0A28', '#E84091', '#F0B429'],

  DIVINE: ['#1A0828', '#E84091', '#FFE28A'],

};



function BigWinAnimationInner({

  visible,

  tier,

  amount,

  baseWin,

  totalMultiplier,

  performance = 'HIGH',

  sharing = false,

  shared = false,

  onShare,

  onDone,

}: Props) {

  const numberRef = useRef<AnimatedNumberHandle>(null);

  const { width, height } = useWindowDimensions();

  const [actionsReady, setActionsReady] = useState(false);

  const raySpin = useSharedValue(0);

  const ring = useSharedValue(0.6);

  const flash = useSharedValue(0);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  useEffect(() => {

    if (!visible) {

      setActionsReady(false);

      if (holdTimerRef.current) {

        clearTimeout(holdTimerRef.current);

        holdTimerRef.current = null;

      }

      return;

    }

    raySpin.value = withRepeat(

      withTiming(360, { duration: 12000, easing: Easing.linear }),

      -1,

      false,

    );

    ring.value = withRepeat(

      withSequence(

        withTiming(1.15, { duration: 620, easing: Easing.inOut(Easing.sin) }),

        withTiming(0.7, { duration: 620, easing: Easing.inOut(Easing.sin) }),

      ),

      -1,

      true,

    );

    flash.value = withSequence(

      withTiming(0.55, { duration: 80 }),

      withTiming(0, { duration: 420 }),

    );

    return () => {

      if (holdTimerRef.current) {

        clearTimeout(holdTimerRef.current);

        holdTimerRef.current = null;

      }

    };

  }, [flash, raySpin, ring, visible]);



  const rayStyle = useAnimatedStyle(() => ({

    transform: [{ rotate: `${raySpin.value}deg` }, { scale: ring.value }],

    opacity: 0.35,

  }));



  const ringStyle = useAnimatedStyle(() => ({

    transform: [{ scale: ring.value }],

    opacity: 0.25 + ring.value * 0.25,

  }));



  const flashStyle = useAnimatedStyle(() => ({

    opacity: flash.value,

  }));



  if (!visible || tier === 'NONE') return null;



  const gradient = TIER_GRADIENTS[tier];

  const bigParticles = tier === 'DIVINE' || tier === 'COSMIC';



  return (

    <Modal transparent visible animationType="fade" onRequestClose={onDone}>

      <View style={styles.backdrop}>

        <Animated.View style={[styles.screenFlash, flashStyle]} />

        <Pressable

          style={StyleSheet.absoluteFill}

          onPress={() => {

            if (actionsReady) return;

            if (holdTimerRef.current) {

              clearTimeout(holdTimerRef.current);

              holdTimerRef.current = null;

              setActionsReady(true);

              return;

            }

            numberRef.current?.skip();

          }}

        />



        {performance !== 'LOW' ? (

          <>

            <Animated.View

              style={[

                styles.rays,

                { width: width * 1.4, height: width * 1.4 },

                rayStyle,

              ]}

            >

              <LinearGradient

                colors={['transparent', 'rgba(255,224,138,0.35)', 'transparent']}

                start={{ x: 0.5, y: 0 }}

                end={{ x: 0.5, y: 1 }}

                style={StyleSheet.absoluteFill}

              />

            </Animated.View>

            <Animated.View

              style={[

                styles.energyRing,

                {

                  width: Math.min(width * 0.72, 320),

                  height: Math.min(width * 0.72, 320),

                  borderRadius: 999,

                },

                ringStyle,

              ]}

            />

          </>

        ) : null}



        <ParticleBurst

          preset={bigParticles ? 'SUPER_WIN' : 'BIG_WIN'}

          performance={performance}

          x={width / 2}

          y={height * 0.38}

        />



        <Animated.View entering={ZoomIn.duration(280).springify().damping(14).stiffness(220)}>

          <LinearGradient

            colors={[...gradient]}

            start={{ x: 0, y: 0 }}

            end={{ x: 1, y: 1 }}

            style={styles.card}

          >

            <View style={styles.cardGlow} />

            <Text style={styles.tier}>{WIN_TIER_LABELS[tier]}</Text>

            {totalMultiplier > 1 ? (

              <Animated.Text entering={FadeIn.delay(200)} style={styles.formula}>

                {Math.floor(baseWin).toLocaleString('tr-TR')} × {totalMultiplier}

              </Animated.Text>

            ) : null}

            <AnimatedNumber

              ref={numberRef}

              value={Math.floor(amount)}

              durationMs={durationForTier(tier)}

              style={styles.amount}

              onDone={() => {

                if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

                holdTimerRef.current = setTimeout(() => {

                  holdTimerRef.current = null;

                  setActionsReady(true);

                }, WIN_HOLD_MS);

              }}

            />

            {!actionsReady ? (

              <Text style={styles.hint}>Atlamak için dokun</Text>

            ) : (

              <Animated.View entering={FadeIn} style={styles.actions}>

                {onShare ? (

                  <Pressable

                    style={[styles.shareBtn, shared && styles.shareBtnDone]}

                    onPress={onShare}

                    disabled={sharing || shared}

                    accessibilityRole="button"

                    accessibilityLabel="Durumda paylaş"

                  >

                    {sharing ? (

                      <ActivityIndicator color="#0B1020" />

                    ) : (

                      <>

                        <Ionicons

                          name={shared ? 'checkmark-circle' : 'share-social'}

                          size={18}

                          color="#0B1020"

                        />

                        <Text style={styles.shareText}>

                          {shared ? 'Durumda paylaşıldı' : 'Durumda paylaş'}

                        </Text>

                      </>

                    )}

                  </Pressable>

                ) : null}

                <Pressable

                  style={styles.continueBtn}

                  onPress={onDone}

                  accessibilityRole="button"

                >

                  <Text style={styles.continueText}>Devam</Text>

                </Pressable>

              </Animated.View>

            )}

          </LinearGradient>

        </Animated.View>

      </View>

    </Modal>

  );

}



export const BigWinAnimation = memo(BigWinAnimationInner);



const styles = StyleSheet.create({

  backdrop: {

    flex: 1,

    backgroundColor: 'rgba(0,0,0,0.82)',

    alignItems: 'center',

    justifyContent: 'center',

  },

  screenFlash: {

    ...StyleSheet.absoluteFill,

    backgroundColor: '#E8F2FF',

  },

  rays: {

    position: 'absolute',

    borderRadius: 999,

    overflow: 'hidden',

  },

  energyRing: {

    position: 'absolute',

    borderWidth: 2,

    borderColor: 'rgba(255,224,138,0.55)',

    shadowColor: '#FFE08A',

    shadowOpacity: 0.8,

    shadowRadius: 24,

  },

  card: {

    minWidth: 300,

    maxWidth: 360,

    paddingVertical: 34,

    paddingHorizontal: 30,

    borderRadius: 28,

    alignItems: 'center',

    borderWidth: 1.5,

    borderColor: 'rgba(255,224,138,0.45)',

    overflow: 'hidden',

  },

  cardGlow: {

    ...StyleSheet.absoluteFill,

    backgroundColor: 'rgba(255,255,255,0.06)',

  },

  tier: {

    color: '#fff',

    fontSize: TipografiTokenlari.h1.fontSize,

    fontWeight: '900',

    letterSpacing: 4,

    textShadowColor: 'rgba(0,0,0,0.55)',

    textShadowRadius: 12,

  },

  formula: {

    marginTop: 12,

    color: 'rgba(255,255,255,0.88)',

    fontSize: TipografiTokenlari.h2.fontSize,

    fontWeight: '800',

  },

  amount: {

    marginTop: 8,

    color: '#FFE08A',

    fontSize: 52,

    fontWeight: '900',

    textShadowColor: 'rgba(240,180,41,0.65)',

    textShadowRadius: 14,

  },

  hint: {

    marginTop: 14,

    color: 'rgba(255,255,255,0.55)',

    fontSize: TipografiTokenlari.micro.fontSize,

    letterSpacing: 1,

  },

  actions: {

    marginTop: 20,

    width: '100%',

    gap: 10,

    alignItems: 'center',

  },

  shareBtn: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 8,

    minHeight: 46,

    width: '100%',

    borderRadius: 14,

    backgroundColor: '#FFE08A',

    paddingHorizontal: 16,

  },

  shareBtnDone: {

    backgroundColor: '#9BE7C4',

  },

  shareText: {

    color: '#0B1020',

    fontWeight: '800',

    fontSize: 15,

  },

  continueBtn: {

    paddingVertical: 8,

    paddingHorizontal: 16,

  },

  continueText: {

    color: 'rgba(255,255,255,0.75)',

    fontWeight: '700',

    fontSize: 14,

    letterSpacing: 0.4,

  },

});


