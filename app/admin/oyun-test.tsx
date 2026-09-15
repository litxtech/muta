/**
 * Admin oyun denetim — odaya girmeden Match-3 / Kozmik Kaskad oynama.
 * Coin şartı yok (istemci + sunucu admin muafiyeti).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { KristalSavasiEkrani } from '../../src/moduller/oyunlar/eslestirme/ekranlar/KristalSavasiEkrani';
import { GAME_DISPLAY_NAME as MATCH3_NAME } from '../../src/moduller/oyunlar/eslestirme/sabitler/KristalSabitleri';
import { KozmikKaskadEkrani } from '../../src/moduller/oyunlar/kaskad/ekranlar/KozmikKaskadEkrani';
import { GAME_DISPLAY_NAME as KASKAD_NAME } from '../../src/moduller/oyunlar/kaskad/sabitler/KaskadSabitleri';
import {
  DEFAULT_DURATION_SECONDS,
  DURATION_OPTIONS_SECONDS,
} from '../../src/moduller/oyunlar/ortak/sabitler/OyunSabitleri';
import type { RoomGameMeta } from '../../src/moduller/oyunlar/ortak/tipler/OyunTipleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type AktifOyun = 'idle' | 'match3' | 'kaskad';

export default function AdminOyunTestEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [aktif, setAktif] = useState<AktifOyun>('idle');
  const [duration, setDuration] = useState(DEFAULT_DURATION_SECONDS);
  const [matchSeed, setMatchSeed] = useState(() =>
    Math.floor(Math.random() * 2_147_483_647),
  );
  const [endsAt, setEndsAt] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)');
      }
    }, [admin]),
  );

  const roomMeta = useMemo<RoomGameMeta>(
    () => ({
      roomId: 'admin-test',
      roomName: 'Admin denetim',
      participantCount: 1,
      micEnabled: false,
    }),
    [],
  );

  const baslatMatch3 = () => {
    const seed = Math.floor(Math.random() * 2_147_483_647);
    setMatchSeed(seed);
    setEndsAt(new Date(Date.now() + duration * 1000).toISOString());
    setAktif('match3');
  };

  if (!admin) return null;

  return (
    <Screen>
      <EkranBasligi
        title="Oyun testi"
        subtitle="Odasız · coin şartı yok · denetim"
        fallbackHref={'/admin' as any}
      />

      <View style={styles.content}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Admin ücretsiz test</Text>
          <Text style={styles.bannerBody}>
            Odaya girmeden oynarsın. Kozmik Kaskad bahisleri coin düşürmez;
            Match-3 skor sunucuya yazılmaz.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>KRİSTAL SAVAŞI</Text>
          <Text style={styles.cardTitle}>{MATCH3_NAME}</Text>
          <Text style={styles.cardBody}>
            Yerel solo pratik — aynı tahta motoru, oda / oturum yok.
          </Text>

          <Text style={styles.durationLabel}>Süre</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS_SECONDS.map((sec) => (
              <Pressable
                key={sec}
                style={[styles.chip, duration === sec && styles.chipOn]}
                onPress={() => setDuration(sec)}
              >
                <Text
                  style={[styles.chipText, duration === sec && styles.chipTextOn]}
                >
                  {sec}s
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.cta} onPress={baslatMatch3}>
            <Text style={styles.ctaText}>Match-3 başlat</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.cardAlt]}>
          <Text style={styles.eyebrow}>KOZMİK KASKAD</Text>
          <Text style={styles.cardTitle}>{KASKAD_NAME}</Text>
          <Text style={styles.cardBody}>
            Canlı spin API · admin hesabında bakiye kontrolü yok.
          </Text>
          <Pressable
            style={[styles.cta, styles.ctaAlt]}
            onPress={() => setAktif('kaskad')}
          >
            <Text style={styles.ctaText}>Kaskad aç</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/admin/oyunlar' as any)}
          style={styles.link}
        >
          <Text style={styles.linkText}>Oyun kontrol paneline git →</Text>
        </Pressable>
      </View>

      <Modal
        visible={aktif === 'match3'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAktif('idle')}
      >
        {aktif === 'match3' && endsAt ? (
          <KristalSavasiEkrani
            sessionId=""
            seed={matchSeed}
            endsAt={endsAt}
            roomMeta={roomMeta}
            players={[]}
            durationSeconds={duration}
            inputLocked={false}
            timerArmed
            practiceMode
            onExit={() => setAktif('idle')}
            onFinished={(payload) => {
              Alert.alert(
                'Test bitti',
                `Skor ${payload.score} · hamle ${payload.moveCount} · combo ${payload.highestCombo}`,
                [{ text: 'Tamam', onPress: () => setAktif('idle') }],
              );
            }}
          />
        ) : null}
      </Modal>

      <Modal
        visible={aktif === 'kaskad'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAktif('idle')}
      >
        {aktif === 'kaskad' ? (
          <KozmikKaskadEkrani
            roomId={null}
            voiceActive={false}
            onClose={() => setAktif('idle')}
          />
        ) : null}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
    paddingBottom: 48,
  },
  banner: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    padding: BoslukTokenlari.md,
    gap: 6,
  },
  bannerTitle: {
    color: RenkTokenlari.violet,
    fontWeight: '800',
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  bannerBody: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
    lineHeight: 18,
  },
  card: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 4,
  },
  cardAlt: {
    borderColor: 'rgba(167,139,250,0.35)',
  },
  eyebrow: {
    color: RenkTokenlari.primarySoft,
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
  },
  cardBody: {
    color: RenkTokenlari.textMuted,
    marginTop: 4,
    fontSize: TipografiTokenlari.body.fontSize,
  },
  durationLabel: {
    color: RenkTokenlari.textMuted,
    marginTop: 12,
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
  ctaAlt: { backgroundColor: RenkTokenlari.violet },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  link: { paddingVertical: 8, alignItems: 'center' },
  linkText: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
