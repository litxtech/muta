/**
 * Maç sonucu kürsü — skor + XP / kupa / coin kazançları.
 */

import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { LeaderboardEntry } from '../tipler/OyunTipleri';
import { playMatch3Sfx } from '../../eslestirme/ses/Match3Sesleri';

type Props = {
  visible: boolean;
  title?: string;
  rankings: LeaderboardEntry[];
  selfUserId?: string;
  onClose: () => void;
  onRematch?: () => void;
};

function PodiumRow({
  entry,
  index,
  isSelf,
}: {
  entry: LeaderboardEntry;
  index: number;
  isSelf: boolean;
}) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(index * 120, withSpring(1, { damping: 12 }));
    opacity.value = withDelay(index * 120, withSpring(1));
  }, [index, opacity, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const medal =
    entry.rank === 1 ? '1.' : entry.rank === 2 ? '2.' : entry.rank === 3 ? '3.' : `#${entry.rank}`;

  return (
    <Animated.View
      style={[styles.row, entry.rank <= 3 && styles.podium, isSelf && styles.selfRow, anim]}
    >
      <Text style={styles.rank}>{medal}</Text>
      <View style={styles.mid}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.displayName}
          {isSelf ? ' (Sen)' : ''}
        </Text>
        <Text style={styles.rewards} numberOfLines={1}>
          +{entry.xpEarned ?? 0} XP
          {(entry.trophyChange ?? 0) > 0 ? ` · +${entry.trophyChange} 🏆` : ''}
          {(entry.coinReward ?? 0) > 0 ? ` · +${entry.coinReward} coin` : ''}
        </Text>
      </View>
      <Text style={styles.score}>{entry.score.toLocaleString('tr-TR')}</Text>
    </Animated.View>
  );
}

export function OyunSonucuModal({
  visible,
  title = 'KRİSTAL SAVAŞI',
  rankings,
  selfUserId,
  onClose,
  onRematch,
}: Props) {
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank);
  const self = sorted.find((e) => e.userId === selfUserId);

  useEffect(() => {
    if (visible) {
      void playMatch3Sfx(self?.rank === 1 ? 'win' : 'game_end');
    }
  }, [visible, self?.rank]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>MAÇ SONUCU</Text>
          <Text style={styles.title}>{title}</Text>

          {self ? (
            <View style={styles.selfBanner}>
              <Text style={styles.selfBannerTitle}>
                {self.rank === 1
                  ? 'Birincisin!'
                  : self.rank === 2
                    ? 'İkincisin!'
                    : self.rank === 3
                      ? 'Üçüncüsün!'
                      : `${self.rank}. sıradasın`}
              </Text>
              <Text style={styles.selfBannerRewards}>
                +{self.xpEarned ?? 0} XP
                {(self.trophyChange ?? 0) > 0 ? `  ·  +${self.trophyChange} Kupa` : ''}
                {(self.coinReward ?? 0) > 0 ? `  ·  +${self.coinReward} Coin` : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {sorted.map((e, i) => (
              <PodiumRow
                key={e.userId}
                entry={e}
                index={i}
                isSelf={e.userId === selfUserId}
              />
            ))}
          </View>

          {onRematch ? (
            <Pressable style={styles.primary} onPress={onRematch}>
              <Text style={styles.primaryText}>TEKRAR OYNA</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.ghost} onPress={onClose}>
            <Text style={styles.ghostText}>ODAYA DÖN</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: BoslukTokenlari.xl,
  },
  card: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    padding: BoslukTokenlari.xl,
  },
  eyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
  },
  title: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    marginBottom: BoslukTokenlari.md,
  },
  selfBanner: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.accent,
    padding: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.md,
  },
  selfBannerTitle: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.accent,
  },
  selfBannerRewards: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    marginTop: 4,
  },
  list: {
    gap: BoslukTokenlari.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
  },
  podium: {
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  selfRow: {
    borderColor: RenkTokenlari.mint,
    borderWidth: 1,
  },
  rank: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.accent,
    width: 40,
  },
  mid: { flex: 1, paddingRight: 8 },
  name: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
  rewards: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    marginTop: 2,
  },
  score: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textMuted,
  },
  primary: {
    marginTop: BoslukTokenlari.xl,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
  },
  primaryText: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  ghost: {
    marginTop: BoslukTokenlari.sm,
    alignItems: 'center',
    padding: BoslukTokenlari.sm,
  },
  ghostText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
