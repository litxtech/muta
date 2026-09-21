import React from 'react';
import {
  Image,
  type ImageProps,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { MedyaUriGuvenli } from './MedyaUriGecerliMi';

type Props = Omit<ImageProps, 'source'> & {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  /** Geçersiz URI'de gösterilecek yedek (yoksa null) */
  yedek?: React.ReactNode;
};

/** Image crash önler — yalnızca http(s) URI ile mount eder. */
export function GuvenliImage({ uri, yedek = null, ...rest }: Props) {
  const safe = MedyaUriGuvenli(uri);
  if (!safe) return <>{yedek}</>;
  return <Image source={{ uri: safe }} {...rest} />;
}
