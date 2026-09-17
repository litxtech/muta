import type { ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { TamusoBanner } from './TamusoBanner';
import { FEED_BANNER_AFTER_INDEXES } from '../core/BannerConstants';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type FeedBannerRow<T> =
  | { kind: 'pair'; key: string; items: [T] | [T, T] }
  | { kind: 'banner'; key: string; placement: string };

/**
 * 2 kolon feed + after-post banner satırları (yatay şerit).
 */
export function buildFeedBannerRows<T extends { id: string }>(
  items: T[],
  afterPostIndexes: readonly number[] = FEED_BANNER_AFTER_INDEXES,
): FeedBannerRow<T>[] {
  const after = new Set(afterPostIndexes.filter((n) => n > 0));
  const rows: FeedBannerRow<T>[] = [];
  let pair: T[] = [];

  const flushPair = () => {
    if (pair.length === 0) return;
    rows.push({
      kind: 'pair',
      key: `pair-${pair.map((p) => p.id).join('-')}`,
      items: pair.length === 1 ? [pair[0]] : [pair[0], pair[1]],
    });
    pair = [];
  };

  items.forEach((item, index) => {
    pair.push(item);
    if (pair.length === 2) flushPair();

    const n = index + 1;
    if (after.has(n)) {
      flushPair();
      rows.push({
        kind: 'banner',
        key: `banner-after-${n}`,
        placement: `FEED_AFTER_POST_${n}`,
      });
    }
  });
  flushPair();
  return rows;
}

export function FeedBannerRowView({
  placement,
}: {
  placement: string;
}): ReactElement {
  return (
    <View style={styles.row}>
      <TamusoBanner placement={placement} screen="FEED" compact />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: BoslukTokenlari.sm,
  },
});
