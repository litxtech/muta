import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { yonluIkon, type IoniconAdi } from '../i18n/rtl';

type Props = {
  /** Mantıksal yön — RTL’de otomatik çevrilir */
  yon: 'back' | 'forward' | 'chevron-back' | 'chevron-forward';
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
};

/**
 * Yönlü navigasyon ikonu.
 * Mikrofon / video / hediye gibi içerik ikonlarını buraya koyma.
 */
export function YonluIkon({ yon, size = 16, color, style }: Props) {
  const name: IoniconAdi = yonluIkon(yon);
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
