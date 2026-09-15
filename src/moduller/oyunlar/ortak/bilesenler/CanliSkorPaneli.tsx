/**
 * Canlı skor paneli — ilk 3.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { GameSessionPlayer, LeaderboardEntry } from '../tipler/OyunTipleri';

type Props = {
  players?: GameSessionPlayer[];
  entries?: LeaderboardEntry[];
};

const MEDALS = ['1', '2', '3'] as const;

export function CanliSkorPaneli({ players, entries }: Props) {
  const top = useMemo(() => {
    if (entries && entries.length > 0) {
      return [...entries].sort((a, b) => a.rank - b.rank).slice(0, 3);
    }
    const list = [...(players ?? [])]
      .filter((p) => p.status !== 'left')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return list.map((p, i) => ({
      userId: p.user_id,
      displayName: p.display_name ?? 'Oyuncu',
      avatarUrl: p.avatar_url,
      score: p.score,
      comboMax: p.combo_max,
      rank: i + 1,
    }));
  }, [entries, players]);

  if (top.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {top.map((e, i) => (
        <View key={e.userId} style={styles.row}>
          <Text style={styles.medal}>{MEDALS[i]}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {e.displayName}
          </Text>
          <Text style={styles.score}>{e.score.toLocaleString('tr-TR')}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: RenkTokenlari.bgGlass,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.sm,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  medal: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    width: 14,
  },
  name: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    flex: 1,
  },
  score: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
