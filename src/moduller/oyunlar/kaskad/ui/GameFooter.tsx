/**
 * Alt kontrol — bahis, spin, autoplay (tur sayısı seçimi).
 */

import React, { memo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  AUTOPLAY_OPTIONS,
  clampAutoplayTours,
  maxAffordableAutoplayTours,
} from '../sabitler/KaskadSabitleri';
import { SpinButton, type SpinButtonState } from './SpinButton';

type Props = {
  bet: number;
  balance: number;
  spinState: SpinButtonState;
  autoplayEnabled: boolean;
  autoplayLeft: number;
  /** Admin test gibi ücretsiz modda bakiyeyi yok say. */
  unlimitedAutoplay?: boolean;
  reduceMotion?: boolean;
  onBetDown: () => void;
  onBetUp: () => void;
  onOpenBetSelector: () => void;
  onSpin: () => void;
  onAutoplay: (n: number) => void;
  onStopAutoplay: () => void;
  onPaytable: () => void;
  /** Ses odası kartı — daha küçük spin. */
  compact?: boolean;
  spinArt?: ImageSourcePropType;
};

function GameFooterInner({
  bet,
  balance,
  spinState,
  autoplayEnabled,
  autoplayLeft,
  unlimitedAutoplay = false,
  reduceMotion,
  onBetDown,
  onBetUp,
  onOpenBetSelector,
  onSpin,
  onAutoplay,
  onStopAutoplay,
  onPaytable,
  compact = false,
  spinArt,
}: Props) {
  const [autoOpen, setAutoOpen] = useState(false);
  const locked = spinState === 'requesting' || spinState === 'animating';
  const maxTours = unlimitedAutoplay
    ? AUTOPLAY_OPTIONS[AUTOPLAY_OPTIONS.length - 1]!
    : maxAffordableAutoplayTours(balance, bet);

  const closeAuto = () => setAutoOpen(false);

  const pickTur = (n: number) => {
    closeAuto();
    onAutoplay(clampAutoplayTours(n, maxTours));
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.infoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.infoLabel}>BAHİS</Text>
          <View style={styles.betControls}>
            <Pressable
              style={styles.betBtn}
              onPress={onBetDown}
              disabled={locked}
              hitSlop={6}
            >
              <Text style={styles.betBtnText}>−</Text>
            </Pressable>
            <Pressable onPress={onOpenBetSelector} disabled={locked}>
              <Text style={styles.betValue}>{bet.toLocaleString('tr-TR')}</Text>
            </Pressable>
            <Pressable
              style={styles.betBtn}
              onPress={onBetUp}
              disabled={locked}
              hitSlop={6}
            >
              <Text style={styles.betBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <SpinButton
          state={spinState}
          autoplayLeft={autoplayLeft}
          size={compact ? 96 : 118}
          art={spinArt}
          onPress={spinState === 'autoplay' ? onStopAutoplay : onSpin}
          onLongPress={
            autoplayEnabled && !locked
              ? () => setAutoOpen(true)
              : undefined
          }
          reduceMotion={reduceMotion}
        />

        <View style={[styles.infoCol, styles.infoColRight]}>
          <Text style={styles.infoLabel}>BAKİYE</Text>
          <Text style={styles.balanceValue}>
            {Math.floor(balance).toLocaleString('tr-TR')}
          </Text>
        </View>
      </View>

      <View style={styles.tools}>
        {autoplayEnabled ? (
          autoplayLeft > 0 ? (
            <Pressable style={[styles.chip, styles.chipOn]} onPress={onStopAutoplay}>
              <Text style={[styles.chipText, styles.chipTextOn]}>
                DUR ({autoplayLeft})
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.chip, autoOpen && styles.chipOn]}
              onPress={() => setAutoOpen(true)}
              disabled={locked}
            >
              <Text style={[styles.chipText, autoOpen && styles.chipTextOn]}>
                OTO
              </Text>
            </Pressable>
          )
        ) : null}
        <Pressable style={styles.chip} onPress={onPaytable}>
          <Text style={styles.chipText}>BİLGİ</Text>
        </Pressable>
      </View>

      <Modal
        visible={autoOpen && autoplayLeft <= 0}
        transparent
        animationType="fade"
        onRequestClose={closeAuto}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAuto} />
          <View style={styles.sheet}>
            <LinearGradient
              colors={['rgba(26,36,68,0.98)', 'rgba(12,14,24,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Tur sayısı</Text>
            <Text style={styles.sheetHint}>
              {maxTours > 0
                ? `Bakiyenle en fazla ${maxTours.toLocaleString('tr-TR')} tur. 500 seçsen bile coin yetmezse yettiği kadar başlar.`
                : 'Bu bahisle oto tur için yeterli coin yok. Coin yükleyince tekrar dene.'}
            </Text>
            <View style={styles.autoGrid}>
              {AUTOPLAY_OPTIONS.map((n) => {
                const allowed = clampAutoplayTours(n, maxTours);
                const fully = n <= maxTours;
                const disabled = allowed <= 0;
                return (
                  <Pressable
                    key={n}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.autoOpt,
                      !fully && styles.autoOptLimited,
                      disabled && styles.autoOptDisabled,
                      pressed && !disabled && styles.autoOptPressed,
                    ]}
                    onPress={() => pickTur(n)}
                  >
                    <LinearGradient
                      colors={
                        fully
                          ? ['rgba(111,227,255,0.18)', 'rgba(42,51,72,0.55)']
                          : ['rgba(42,51,72,0.35)', 'rgba(20,24,36,0.55)']
                      }
                      style={styles.autoOptFill}
                    >
                      <Text
                        style={[
                          styles.autoOptNum,
                          !fully && styles.autoOptNumLimited,
                        ]}
                      >
                        {n}
                      </Text>
                      <Text style={styles.autoOptLabel}>TUR</Text>
                      {!fully && allowed > 0 ? (
                        <Text style={styles.autoOptCap}>
                          {allowed.toLocaleString('tr-TR')} başlar
                        </Text>
                      ) : null}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.sheetCancel} onPress={closeAuto}>
              <Text style={styles.sheetCancelText}>Vazgeç</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const GameFooter = memo(GameFooterInner);

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.lg,
    gap: 12,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.28)',
    backgroundColor: 'rgba(12,14,24,0.72)',
  },
  wrapCompact: {
    marginHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: 'rgba(22, 12, 6, 0.55)',
    borderColor: 'rgba(232, 197, 71, 0.42)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCol: { minWidth: 92, alignItems: 'flex-start', gap: 4 },
  infoColRight: { alignItems: 'flex-end' },
  infoLabel: {
    color: RenkTokenlari.textDim,
    fontSize: TipografiTokenlari.micro.fontSize,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  betControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  betBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(42,51,72,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.35)',
  },
  betBtnText: {
    color: RenkTokenlari.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  betValue: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'center',
  },
  balanceValue: {
    color: '#E8C878',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(42,51,72,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: {
    borderColor: 'rgba(111,227,255,0.55)',
    backgroundColor: 'rgba(111,227,255,0.12)',
  },
  chipText: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  chipTextOn: { color: '#6FE3FF' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(111,227,255,0.28)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 14,
  },
  sheetTitle: {
    color: '#F7F2E8',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  sheetHint: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
  },
  autoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  autoOpt: {
    width: '31%',
    minWidth: 96,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(111,227,255,0.4)',
  },
  autoOptPressed: {
    borderColor: 'rgba(255,224,138,0.75)',
    transform: [{ scale: 0.97 }],
  },
  autoOptLimited: {
    borderColor: 'rgba(111,227,255,0.22)',
  },
  autoOptDisabled: {
    opacity: 0.38,
  },
  autoOptFill: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoOptNum: {
    color: '#E8F6FF',
    fontSize: 24,
    fontWeight: '900',
  },
  autoOptNumLimited: {
    color: 'rgba(232,246,255,0.7)',
  },
  autoOptLabel: {
    color: 'rgba(111,227,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 1.4,
  },
  autoOptCap: {
    color: '#E8C878',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  sheetCancel: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetCancelText: {
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
