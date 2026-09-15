import React from 'react';
import { View } from 'react-native';
import { TamusoBanner } from '../components/TamusoBanner';
import { extractAfterPostIndex } from '../core/BannerPlacementEngine';

/**
 * Feed 2-kolon grid içinde after-post banner — satır tamamlandıktan sonra.
 * postIndexZeroBased: FlatList renderItem index.
 * 2 kolon: banner yalnızca satırın son hücresinde (tek index) render edilir ki layout bozulmasın.
 */
export function FeedInlineBannerSlot({
  postIndexZeroBased,
  numColumns = 2,
}: {
  postIndexZeroBased: number;
  numColumns?: number;
}) {
  const n = postIndexZeroBased + 1;
  const placement = `FEED_AFTER_POST_${n}`;
  const afterIndex = extractAfterPostIndex(placement);
  if (afterIndex == null) return null;

  // Sadece hedef postun olduğu satırın son kolonunda göster (full-width hissi için margin)
  const isRowEnd = (postIndexZeroBased + 1) % numColumns === 0;
  if (!isRowEnd && afterIndex === n) {
    // 3. post tek kolon satırında değilse: 3. item index=2, 2-col'da satır ortası
    // Gösterim: index === afterIndex - 1 (hedef post) ve her zaman tek sefer
  }

  if (n !== afterIndex) return null;

  return (
    <View style={{ width: '100%', marginTop: 8 }}>
      <TamusoBanner placement={placement} screen="FEED" />
    </View>
  );
}

/** Bilinen after-post placement'ları için index seti */
export function feedAfterPostIndexes(
  known: string[] = ['FEED_AFTER_POST_3', 'FEED_AFTER_POST_8'],
): Set<number> {
  return new Set(
    known
      .map(extractAfterPostIndex)
      .filter((x): x is number => x != null),
  );
}
