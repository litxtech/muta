import type { ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { TamusoBanner } from './TamusoBanner';
import { FEED_BANNER_AFTER_INDEXES } from '../core/BannerConstants';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type FeedBannerRow<T> =
  | { kind: 'pair'; key: string; items: T[] }
  | { kind: 'banner'; key: string; placement: string };

/**
 * Kolonlu feed + after-post banner satırları (yatay şerit).
 * `columns` ana sayfada 3 (tasarım), eski çağrılarda 2.
 */
export function buildFeedBannerRows<T extends { id: string }>(
  items: T[],
  afterPostIndexes: readonly number[] = FEED_BANNER_AFTER_INDEXES,
  columns = 2,
): FeedBannerRow<T>[] {
  const kolon = Math.max(1, Math.floor(columns));
  const after = new Set(afterPostIndexes.filter((n) => n > 0));
  const rows: FeedBannerRow<T>[] = [];
  let pair: T[] = [];

  const flushPair = () => {
    if (pair.length === 0) return;
    rows.push({
      kind: 'pair',
      key: `pair-${rows.length}-${pair.map((p) => p.id).join('-')}`,
      items: pair.slice(),
    });
    pair = [];
  };

  items.forEach((item, index) => {
    pair.push(item);
    if (pair.length === kolon) flushPair();

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
      <TamusoBanner
        placement={placement}
        screen="FEED"
        compact
        style={styles.bannerIc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    marginBottom: BoslukTokenlari.sm,
  },
  /** FlatList zaten yatay pad — çift boşluk / sağa kaymayı önle */
  bannerIc: {
    paddingHorizontal: 0,
  },
});
