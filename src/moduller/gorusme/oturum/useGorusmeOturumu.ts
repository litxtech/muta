import { useEffect, useState } from 'react';
import {
  GorusmeOturumDinle,
  type GorusmeOturumDurum,
} from './GorusmeOturumYoneticisi';

export function useGorusmeOturumu(): GorusmeOturumDurum | null {
  const [durum, setDurum] = useState<GorusmeOturumDurum | null>(null);
  useEffect(() => GorusmeOturumDinle(setDurum), []);
  return durum;
}
