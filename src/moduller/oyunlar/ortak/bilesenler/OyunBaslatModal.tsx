/**
 * Host oyun başlat sheet — Match-3 + Kozmik Kaskad.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  DEFAULT_DURATION_SECONDS,
  DURATION_OPTIONS_SECONDS,
  MAX_PLAYERS,
} from '../sabitler/OyunSabitleri';
import { GAME_DISPLAY_NAME } from '../../eslestirme/sabitler/KristalSabitleri';
import { GAME_DISPLAY_NAME as KASKAD_NAME } from '../../kaskad/sabitler/KaskadSabitleri';

type Props = {
  visible: boolean;
  onClose: () => void;
  onBaslat: (opts: { durationSeconds: number; maxPlayers: number }) => void;
  onBaslatKaskad?: () => void;
  canStart?: boolean;
};

export function OyunBaslatModal({
  visible,
  onClose,
  onBaslat,
  onBaslatKaskad,
  canStart = true,
}: Props) {
  const [duration, setDuration] = useState(DEFAULT_DURATION_SECONDS);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.heading}>Tamuso Oyunları</Text>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>KRİSTAL SAVAŞI</Text>
            <Text style={styles.cardTitle}>{GAME_DISPLAY_NAME}</Text>
            <Text style={styles.cardBody}>
              {duration} saniyede en yüksek skoru yap. Odadaki oyuncularla yarış.
            </Text>
            <Text style={styles.cardMeta}>
              1–{MAX_PLAYERS} oyuncu · solo pratik veya oda yarışı · aynı seed tahta
            </Text>

            <Text style={styles.durationLabel}>Süre</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS_SECONDS.map((sec) => (
                <Pressable
                  key={sec}
                  style={[styles.chip, duration === sec && styles.chipOn]}
                  onPress={() => setDuration(sec)}
                >
                  <Text style={[styles.chipText, duration === sec && styles.chipTextOn]}>
                    {sec}s
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.cta, !canStart && styles.ctaDisabled]}
              disabled={!canStart}
              onPress={() =>
                onBaslat({ durationSeconds: duration, maxPlayers: MAX_PLAYERS })
              }
            >
              <Text style={styles.ctaText}>OYUN BAŞLAT</Text>
            </Pressable>
          </View>

          <View style={[styles.card, styles.cardAlt]}>
            <Text style={styles.cardEyebrow}>KOZMİK KASKAD</Text>
            <Text style={styles.cardTitle}>{KASKAD_NAME}</Text>
            <Text style={styles.cardBody}>
              6×5 cascade · portal scatter · çarpan küreleri · bonus turlar. Ses odası açık kalır.
            </Text>
            <Text style={styles.cardMeta}>Solo · server sonucu · premium animasyon</Text>
            <Pressable
              style={[styles.cta, styles.ctaAlt, !onBaslatKaskad && styles.ctaDisabled]}
              disabled={!onBaslatKaskad}
              onPress={() => onBaslatKaskad?.()}
            >
              <Text style={styles.ctaText}>KASKAD AÇ</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    maxHeight: '92%',
  },
  heading: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h1.fontSize,
    fontWeight: '800',
  },
  card: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cardAlt: {
    borderColor: 'rgba(167,139,250,0.35)',
  },
  cardEyebrow: {
    color: RenkTokenlari.primarySoft,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
    marginTop: 4,
  },
  cardBody: {
    color: RenkTokenlari.textMuted,
    marginTop: 8,
    fontSize: TipografiTokenlari.body.fontSize,
  },
  cardMeta: {
    color: RenkTokenlari.textDim,
    marginTop: 6,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  durationLabel: {
    color: RenkTokenlari.textMuted,
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipOn: {
    borderColor: RenkTokenlari.primary,
    backgroundColor: 'rgba(232,64,145,0.18)',
  },
  chipText: { color: RenkTokenlari.textMuted, fontWeight: '700' },
  chipTextOn: { color: RenkTokenlari.primarySoft },
  cta: {
    marginTop: 16,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaAlt: {
    backgroundColor: RenkTokenlari.violet,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
  },
  close: { alignItems: 'center', padding: 8 },
  closeText: { color: RenkTokenlari.textMuted, fontWeight: '600' },
});
