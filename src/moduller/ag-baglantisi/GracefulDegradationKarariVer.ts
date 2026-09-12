import { OzellikBayragiAktifMi, KillSwitchAktifMi } from '../ozellik-bayraklari/OzellikBayragiAktifMi';
import type { AgBaglantiDurumu } from './okuma/AgBaglantiDurumunuGetir';
import { DusukCihazModuAktifMi } from '../performans/DusukCihazModuAktifMi';

export type GracefulDegradationKarari = {
  aktif: boolean;
  sebep: string[];
  agirAnimasyonIzinli: boolean;
  livekitYenidenBaglanIzinli: boolean;
  yalnizcaOnbellek: boolean;
};

/**
 * Ag / cihaz / kill switch'e gore yumusak dusus.
 * Authoritative degil — UI kapisi; finans backend'de.
 */
export function GracefulDegradationKarariVer(
  ag: AgBaglantiDurumu | null,
): GracefulDegradationKarari {
  const sebep: string[] = [];
  const bayrakAcik = OzellikBayragiAktifMi('graceful_degradation_enabled');
  const dusuk = DusukCihazModuAktifMi();
  const killAnim = KillSwitchAktifMi('kill_heavy_animations');
  const killReconnect = KillSwitchAktifMi('kill_livekit_reconnect');

  const offline =
    !!ag &&
    (!ag.bagli || ag.internetErisilebilir === false || ag.ucakModu === true);

  if (!bayrakAcik) {
    return {
      aktif: false,
      sebep: [],
      agirAnimasyonIzinli: !killAnim && !dusuk,
      livekitYenidenBaglanIzinli: !killReconnect,
      yalnizcaOnbellek: false,
    };
  }

  if (offline) sebep.push('offline');
  if (dusuk) sebep.push('low_end');
  if (killAnim) sebep.push('kill_heavy_animations');
  if (killReconnect) sebep.push('kill_livekit_reconnect');

  return {
    aktif: sebep.length > 0,
    sebep,
    agirAnimasyonIzinli: !killAnim && !dusuk && !offline,
    livekitYenidenBaglanIzinli: !killReconnect && !offline,
    yalnizcaOnbellek: offline,
  };
}
