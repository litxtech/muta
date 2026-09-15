/**
 * Canlı yayın tiyatrosu — tam ekran video + yorum + hediye + beğeni + istatistik.
 * Oda ekranı klavye düzenini takip eder (composer alt bar, liste overlay).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useKlavyeYuksekligi } from '../../../bilesenler/klavye/useKlavyeYuksekligi';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { CanliYayinVideoSahne } from './CanliYayinVideoSahne';
import { CanliYorumAkisi } from './CanliYorumAkisi';
import { CanliYorumComposer } from './CanliYorumComposer';
import { CanliBegeniEfekti } from './CanliBegeniEfekti';
import {
  CanliYayinBegen,
} from '../islemler/CanliYayinIslemleri';
import { supabase } from '../../../lib/supabase';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { OzellikBayragiAktifMi } from '../../ozellik-bayraklari/OzellikBayragiAktifMi';

export type CanliYayinMeta = {
  id: string;
  host_id: string;
  title: string;
  viewer_count: number;
  like_count: number;
  gift_count: number;
  total_coins_earned: number;
  hostAd: string;
};

type Props = {
  rol: 'host' | 'izleyici';
  meta: CanliYayinMeta;
  medyaDurum?: string | null;
  medyaMock?: boolean;
  currentUserId?: string | null;
  canSend: boolean;
  walletCoins?: number | null;
  onNeedUpgrade?: () => void;
  onHediye?: () => void;
  onBitir?: () => void;
  onCikis?: () => void;
  onPk?: () => void;
  onMeta?: (patch: Partial<CanliYayinMeta>) => void;
};

export function CanliYayinTiyatro({
  rol,
  meta,
  medyaDurum,
  medyaMock,
  currentUserId,
  canSend,
  walletCoins,
  onNeedUpgrade,
  onHediye,
  onBitir,
  onCikis,
  onPk,
  onMeta,
}: Props) {
  const insets = useSafeAreaInsets();
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [yorumYenile, setYorumYenile] = useState(0);
  const [burst, setBurst] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const begeniKilit = useRef(false);

  // Canlı istatistik realtime
  useEffect(() => {
    const ch = supabase
      .channel(`canli-meta-${meta.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${meta.id}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const n = payload.new;
          if (!n) return;
          onMeta?.({
            viewer_count: Number(n.viewer_count ?? meta.viewer_count),
            like_count: Number(n.like_count ?? meta.like_count),
            gift_count: Number(n.gift_count ?? meta.gift_count),
            total_coins_earned: Number(
              n.total_coins_earned ?? meta.total_coins_earned,
            ),
            title: typeof n.title === 'string' ? n.title : meta.title,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [meta.id, meta.viewer_count, meta.like_count, meta.gift_count, meta.total_coins_earned, meta.title, onMeta]);

  const ekranaDokun = useCallback(
    (e: { nativeEvent: { locationX: number; locationY: number } }) => {
      if (klavyeAcik) {
        Keyboard.dismiss();
        return;
      }
      const x = e.nativeEvent.locationX;
      const y = e.nativeEvent.locationY;
      setBurst({ id: `${Date.now()}-${Math.random()}`, x, y });

      if (rol === 'host') return;
      if (!canSend) {
        onNeedUpgrade?.();
        return;
      }
      if (begeniKilit.current) return;
      begeniKilit.current = true;
      void CanliYayinBegen(meta.id).then((r) => {
        begeniKilit.current = false;
        if (r.ok) {
          onMeta?.({ like_count: r.like_count });
        } else if (r.hata.includes('Misafir')) {
          onNeedUpgrade?.();
        }
      });
    },
    [canSend, klavyeAcik, meta.id, onMeta, onNeedUpgrade, rol],
  );

  const cikisIste = () => {
    if (rol === 'host' && onBitir) {
      Alert.alert('Yayını bitir', 'Çıkınca yayın sonlanır.', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Bitir',
          style: 'destructive',
          onPress: () => onBitir(),
        },
      ]);
      return;
    }
    onCikis?.();
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.stage} onPress={ekranaDokun}>
        <View style={styles.videoFill} pointerEvents="none">
          <CanliYayinVideoSahne
            rol={rol === 'host' ? 'host' : 'izleyici'}
            mock={!!medyaMock}
            durumYazi={medyaDurum ?? undefined}
          />
        </View>

        <LinearGradient
          colors={['rgba(8,6,12,0.72)', 'transparent', 'rgba(8,6,12,0.62)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <CanliBegeniEfekti burst={burst} />

        <View style={[styles.topBar, { paddingTop: Math.max(8, insets.top + 4) }]}>
          <Pressable onPress={cikisIste} style={styles.iconBtn} accessibilityLabel="Çık">
            <Ionicons
              name={rol === 'host' ? 'close' : 'chevron-down'}
              size={22}
              color={RenkTokenlari.text}
            />
          </Pressable>

          <Pressable
            style={styles.meta}
            onPress={() => router.push(`/kullanici/${meta.host_id}` as any)}
          >
            <Text style={styles.title} numberOfLines={1}>
              {meta.title}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {meta.hostAd}
              {medyaDurum ? ` · ${medyaDurum}` : ''}
            </Text>
          </Pressable>

          <View style={styles.livePill}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        </View>

        <View style={styles.statRow} pointerEvents="none">
          <View style={styles.statChip}>
            <Ionicons name="eye" size={13} color={RenkTokenlari.mint} />
            <Text style={styles.statText}>{meta.viewer_count}</Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="heart" size={13} color={RenkTokenlari.live} />
            <Text style={styles.statText}>{meta.like_count}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statEmoji}>🎁</Text>
            <Text style={styles.statText}>{meta.gift_count}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statEmoji}>🪙</Text>
            <Text style={styles.statText}>{meta.total_coins_earned}</Text>
          </View>
        </View>

        {chatOpen ? (
          <View
            style={[styles.yorumOverlay, klavyeAcik && styles.yorumOverlayKlavye]}
            pointerEvents="box-none"
          >
            <ModulHataSiniri modulAdi="canlı sohbet" varyant="kart">
              <CanliYorumAkisi
                sessionId={meta.id}
                currentUserId={currentUserId}
                hostId={meta.host_id}
                yenileSinyali={yorumYenile}
                onClose={() => setChatOpen(false)}
              />
            </ModulHataSiniri>
          </View>
        ) : null}
      </Pressable>

      <View
        style={[
          styles.altBar,
          {
            marginBottom:
              Platform.OS === 'android' && klavyeAcik ? klavyeH : 0,
            paddingBottom: klavyeAcik
              ? Platform.OS === 'android'
                ? 8
                : Math.max(8, klavyeH)
              : Math.max(10, insets.bottom + 8),
          },
        ]}
      >
        {!chatOpen ? (
          <Pressable style={styles.chatPeek} onPress={() => setChatOpen(true)}>
            <Ionicons
              name="chatbubble-ellipses"
              size={18}
              color={RenkTokenlari.mint}
            />
            <Text style={styles.chatPeekText}>Yorumları aç</Text>
          </Pressable>
        ) : (
          <View style={styles.composerRow}>
            <CanliYorumComposer
              sessionId={meta.id}
              canSend={canSend}
              onNeedUpgrade={onNeedUpgrade}
              onSent={() => {
                setYorumYenile((n) => n + 1);
                Keyboard.dismiss();
              }}
            />
          </View>
        )}

        {!klavyeAcik ? (
          <View style={styles.controls}>
            {onHediye ? (
              <Pressable
                onPress={() => onHediye()}
                style={styles.giftBtn}
                accessibilityLabel="Hediye gönder"
              >
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.giftBtnInner}
                >
                  <Text style={styles.giftBtnText}>🎁</Text>
                </LinearGradient>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setChatOpen((v) => !v)}
              style={styles.controlBtn}
              accessibilityLabel="Yorumlar"
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={22}
                color={chatOpen ? RenkTokenlari.mint : RenkTokenlari.textMuted}
              />
            </Pressable>

            {rol === 'host' &&
            OzellikBayragiAktifMi('pk_enabled') &&
            onPk ? (
              <Pressable onPress={onPk} style={styles.controlBtn}>
                <Ionicons name="flash" size={22} color="#F0B429" />
              </Pressable>
            ) : null}

            {rol === 'host' && onBitir ? (
              <Pressable onPress={cikisIste} style={styles.endBtn}>
                <Text style={styles.endBtnText}>Bitir</Text>
              </Pressable>
            ) : null}

            {walletCoins != null ? (
              <View style={styles.coinChip}>
                <Text style={styles.coinText}>🪙 {walletCoins}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: '#0A0810' },
  stage: { flex: 1, minHeight: 0, position: 'relative' },
  videoFill: { ...StyleSheet.absoluteFill },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    zIndex: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,16,24,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 16,
  },
  sub: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232,64,145,0.22)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RenkTokenlari.live,
  },
  liveText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    zIndex: 4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(8,6,14,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  statEmoji: { fontSize: 11 },
  yorumOverlay: {
    position: 'absolute',
    left: 12,
    right: 56,
    bottom: 8,
    height: '34%',
    maxHeight: 260,
    minHeight: 120,
    zIndex: 5,
  },
  yorumOverlayKlavye: {
    height: '26%',
    maxHeight: 160,
    minHeight: 88,
  },
  altBar: {
    flexShrink: 0,
    gap: 10,
    paddingTop: 10,
    backgroundColor: 'rgba(8,6,14,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  composerRow: {
    paddingHorizontal: 16,
    width: '100%',
  },
  chatPeek: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(12,10,18,0.72)',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chatPeekText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 12,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  giftBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  giftBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftBtnText: { fontSize: 20 },
  endBtn: {
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtnText: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '800',
  },
  coinChip: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(240,180,41,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.35)',
  },
  coinText: {
    ...TipografiTokenlari.caption,
    color: '#F0B429',
    fontWeight: '800',
  },
});
