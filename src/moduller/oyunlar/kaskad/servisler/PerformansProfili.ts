/**
 * Cihaz performans profili — LOW cihazlarda partikül/katman/glow azaltılır.
 * Matematik ve sonuç HER profilde aynıdır.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type { PerformanceProfile } from '../tipler/KaskadTipleri';

const GB = 1024 * 1024 * 1024;
const HIGH_MEMORY_MIN = 5.5 * GB;
const MEDIUM_MEMORY_MIN = 3 * GB;

export function detectPerformanceProfile(): PerformanceProfile {
  try {
    const mem = Device.totalMemory ?? 0;
    if (Platform.OS === 'ios') {
      // Modern iPhone'lar animasyon yükünü rahat taşır
      return mem > 0 && mem < MEDIUM_MEMORY_MIN ? 'MEDIUM' : 'HIGH';
    }
    if (mem >= HIGH_MEMORY_MIN) return 'HIGH';
    if (mem >= MEDIUM_MEMORY_MIN) return 'MEDIUM';
    return 'LOW';
  } catch {
    return 'MEDIUM';
  }
}
