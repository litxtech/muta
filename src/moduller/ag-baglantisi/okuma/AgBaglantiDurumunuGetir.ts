import * as Network from 'expo-network';

export type AgBaglantiDurumu = {
  bagli: boolean;
  internetErisilebilir: boolean | null;
  tip: string;
  ucakModu: boolean | null;
};

/**
 * Cihaz ag durumu — Screen network cagirmaz; bu modul okur.
 */
export async function AgBaglantiDurumunuGetir(): Promise<AgBaglantiDurumu> {
  try {
    const state = await Network.getNetworkStateAsync();
    let ucak: boolean | null = null;
    try {
      ucak = await Network.isAirplaneModeEnabledAsync();
    } catch {
      ucak = null;
    }
    return {
      bagli: !!state.isConnected,
      internetErisilebilir:
        typeof state.isInternetReachable === 'boolean'
          ? state.isInternetReachable
          : null,
      tip: String(state.type ?? 'UNKNOWN'),
      ucakModu: ucak,
    };
  } catch {
    return {
      bagli: true,
      internetErisilebilir: null,
      tip: 'UNKNOWN',
      ucakModu: null,
    };
  }
}
