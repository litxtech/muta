import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  fetchRoom,
  fetchRoomSeats,
  joinRoom,
} from '../../src/services/api';
import { HediyeKatalogunuGetir } from '../../src/moduller/hediyeler/okuma/HediyeKatalogunuGetir';
import { HediyeGonder } from '../../src/moduller/hediyeler/islemler/HediyeGonder';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import type { Gift, Room, RoomSeat } from '../../src/types/models';
import { colors, radii, typography } from '../../src/theme/colors';
import { HediyeAnimasyonuKuyrugu } from '../../src/moduller/hediyeler/animasyon/HediyeAnimasyonuKuyrugu';
import { HediyeAnimasyonKatmani } from '../../src/moduller/hediyeler/bilesenler/HediyeAnimasyonKatmani';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { SesOdasiMikrofonDuzeni } from '../../src/moduller/ses-odalari/bilesenler/SesOdasiMikrofonDuzeni';
import { LiveKitTokenAl } from '../../src/moduller/livekit/token/LiveKitTokenAl';
import { LiveKitBaglantiYoneticisi } from '../../src/moduller/livekit/baglanti/LiveKitBaglantiYoneticisi';
import { KonusmaciSesSeviyesi } from '../../src/moduller/livekit/ses/KonusmaciSesSeviyesi';
import { MikrofonIstegiGonder } from '../../src/moduller/ses-odalari/mikrofon/MikrofonIstegiGonder';
import { OdaDuzeniniCoz } from '../../src/moduller/ses-odalari/duzen/OdaDuzeniniCoz';

const FALLBACK_GIFTS: Gift[] = [
  { id: 'g1', code: 'rose', name: 'Gül', emoji: '🌹', coin_cost: 1, diamond_value: 1, rarity: 'common', animation: 'burst' },
  { id: 'g2', code: 'kiss', name: 'Öpücük', emoji: '💋', coin_cost: 5, diamond_value: 4, rarity: 'common', animation: 'burst' },
  { id: 'g3', code: 'heart', name: 'Kalp', emoji: '💖', coin_cost: 10, diamond_value: 8, rarity: 'common', animation: 'burst' },
  { id: 'g4', code: 'crown', name: 'Taç', emoji: '👑', coin_cost: 1999, diamond_value: 1600, rarity: 'legendary', animation: 'burst' },
];

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refreshWallet, isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [room, setRoom] = useState<Room | null>(null);
  const [seats, setSeats] = useState<RoomSeat[]>([]);
  const [gifts, setGifts] = useState<Gift[]>(FALLBACK_GIFTS);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [giftOpen, setGiftOpen] = useState(false);
  const [lastGift, setLastGift] = useState<string | null>(null);

  const [lkDurum, setLkDurum] = useState('idle');

  const isDemo = useMemo(() => id?.startsWith('demo'), [id]);

  const load = useCallback(async () => {
    if (!id || isDemo) {
      setRoom({
        id: id ?? 'demo',
        host_id: 'demo',
        title: 'Demo Live Room',
        topic: 'Ses + hediye önizleme',
        cover_url: null,
        mode: 'dating',
        max_seats: 8,
        is_live: true,
        is_locked: false,
        listener_count: 42,
        total_coins_earned: 900,
        created_at: new Date().toISOString(),
        layout_code: 'floating_glass',
      });
      setSeats(
        Array.from({ length: 8 }, (_, seat_index) => ({
          id: `s${seat_index}`,
          room_id: id ?? 'demo',
          seat_index,
          user_id: seat_index === 0 ? 'demo' : null,
          is_muted: false,
          is_locked: false,
          profile:
            seat_index === 0
              ? {
                  id: 'demo',
                  username: 'host',
                  display_name: 'Host',
                  bio: '',
                  avatar_url: null,
                  gender: 'female',
                  birth_date: null,
                  country: null,
                  language: 'tr',
                  is_host: true,
                  is_verified: true,
                  level: 10,
                  xp: 0,
                  created_at: new Date().toISOString(),
                }
              : null,
        })),
      );
      KonusmaciSesSeviyesi.mockBaslat('demo');
      setLkDurum('mock');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [r, s, g] = await Promise.all([
        fetchRoom(id),
        fetchRoomSeats(id),
        HediyeKatalogunuGetir().catch(() => FALLBACK_GIFTS),
      ]);
      setRoom(r);
      setSeats(s);
      if (g.length) setGifts(g);
      if (user?.id) await joinRoom(id, user.id);

      const roomName = r?.livekit_room_name ?? `voice_${id}`;
      const isHost = user?.id === r?.host_id;
      const token = await LiveKitTokenAl({
        roomName,
        role: isHost ? 'host' : 'listener',
      });
      if (token.ok) {
        await LiveKitBaglantiYoneticisi.baglan({
          url: token.url,
          token: token.token,
          roomName: token.roomName,
          mock: token.mock,
        });
        setLkDurum(token.mock ? 'mock' : 'connected');
        if (r?.host_id) KonusmaciSesSeviyesi.mockBaslat(r.host_id);
      } else {
        setLkDurum('error');
      }
    } catch (e) {
      Alert.alert('Oda yüklenemedi', e instanceof Error ? e.message : 'Hata');
    } finally {
      setLoading(false);
    }
  }, [id, isDemo, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        KonusmaciSesSeviyesi.mockDurdur();
        void LiveKitBaglantiYoneticisi.baglantiyiKes();
      };
    }, [load]),
  );

  const onSendGift = (gift: Gift) => {
    if (!user || !room) return;
    islemiDene('hediye_gonder', async () => {
      if (isDemo) {
        setLastGift(`${gift.emoji} ${gift.name}`);
        setTimeout(() => setLastGift(null), 1800);
        return;
      }
      const sonuc = await HediyeGonder({
        roomId: room.id,
        receiverId: room.host_id,
        giftId: gift.id,
        quantity: 1,
      });
      if (!sonuc.ok) {
        Alert.alert('Hediye gönderilemedi', sonuc.hata);
        return;
      }
      HediyeAnimasyonuKuyrugu.ekle({
        giftId: gift.id,
        emoji: gift.emoji,
        name: gift.name,
        animationUrl: gift.animation_url,
        animationType: gift.animation_type,
        durationMs: gift.duration_ms ?? 2000,
        fullScreen: !!gift.full_screen || gift.coin_cost >= 999,
      });
      setLastGift(`${gift.emoji} ${gift.name}`);
      setTimeout(() => setLastGift(null), 1800);
      await refreshWallet();
    });
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </Screen>
    );
  }

  if (!room) {
    return (
      <Screen>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: 80 }}>
          Oda bulunamadı
        </Text>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <LinearGradient colors={[...colors.gradientRoom]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.topMeta}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {room.title}
          </Text>
          <Text style={styles.roomTopic}>
            {OdaDuzeniniCoz(room.layout_code).ad} · LK:{lkDurum} · {room.topic ?? room.mode}
          </Text>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{room.listener_count}</Text>
        </View>
      </View>

      <SesOdasiMikrofonDuzeni seats={seats} layoutCode={room.layout_code} />

      {lastGift ? (
        <View style={styles.giftToast}>
          <Text style={styles.giftToastText}>{lastGift} gönderildi!</Text>
        </View>
      ) : null}

      {giftOpen ? (
        <ModulHataSiniri modulAdi="hediyeler">
          <View style={styles.giftPanel}>
            <Text style={styles.giftTitle}>Hediye gönder</Text>
            <FlatList
              horizontal
              data={gifts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => onSendGift(item)} style={styles.giftItem}>
                  <Text style={styles.giftEmoji}>{item.emoji}</Text>
                  <Text style={styles.giftName}>{item.name}</Text>
                  <Text style={styles.giftCost}>{item.coin_cost}🪙</Text>
                </Pressable>
              )}
            />
          </View>
        </ModulHataSiniri>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          onPress={() =>
            islemiDene('mikrofon', async () => {
              setMuted((m) => !m);
              if (!isDemo && room && muted) {
                const r = await MikrofonIstegiGonder(room.id);
                if (!r.ok) Alert.alert('Mikrofon', r.hata ?? 'İstek gönderilemedi');
              }
            })
          }
          style={styles.controlBtn}
        >
          <Ionicons
            name={muted ? 'mic-off' : 'mic'}
            size={22}
            color={muted ? colors.textMuted : colors.micOn}
          />
        </Pressable>
        <Pressable
          onPress={() =>
            islemiDene('hediye_gonder', () => setGiftOpen((v) => !v))
          }
          style={styles.giftBtn}
        >
          <LinearGradient colors={[...colors.gradientPrimary]} style={styles.giftBtnInner}>
            <Text style={styles.giftBtnText}>🎁 Hediye</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => Alert.alert('Sohbet', 'Oda chat paneli bir sonraki sprintte.')}
          style={styles.controlBtn}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={upgradeKapat}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
      <HediyeAnimasyonKatmani />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 18,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMeta: { flex: 1 },
  roomTitle: { ...typography.h1, color: colors.text },
  roomTopic: { ...typography.caption, color: colors.textMuted },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,61,129,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.live },
  liveText: { ...typography.caption, color: colors.primarySoft, fontWeight: '700' },
  seats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  seat: { width: '21%', alignItems: 'center', gap: 8 },
  seatAvatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: colors.seatEmpty,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatFilled: {
    borderColor: colors.primarySoft,
    backgroundColor: 'rgba(255,61,129,0.18)',
  },
  micWave: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.micOn,
  },
  seatName: { ...typography.micro, color: colors.textMuted, textAlign: 'center' },
  giftToast: {
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: 'rgba(255,61,129,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  giftToastText: { ...typography.body, color: colors.text, fontWeight: '700' },
  giftPanel: {
    marginTop: 'auto',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: colors.bgGlass,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderHot,
    padding: 14,
    gap: 12,
  },
  giftTitle: { ...typography.h2, color: colors.text },
  giftItem: {
    width: 84,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  giftEmoji: { fontSize: 28 },
  giftName: { ...typography.micro, color: colors.text },
  giftCost: { ...typography.micro, color: colors.accent },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 10,
    marginTop: 'auto',
    gap: 16,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  giftBtn: { flex: 1, borderRadius: radii.pill, overflow: 'hidden' },
  giftBtnInner: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBtnText: { ...typography.h2, color: '#12040C' },
});
