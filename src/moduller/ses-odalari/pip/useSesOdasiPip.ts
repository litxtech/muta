/**
 * Android ses odası Picture-in-Picture.
 * Oda ekranı odaklıyken + tercih açıksa autoEnter (+ eski Android'de manuel enter).
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import ExpoPip from 'expo-pip';
import i18n from '../../../i18n';
import {
  SesOdasiPipAcikMi,
  SesOdasiPipBellekten,
} from '../depolama/SesOdasiPipTercihi';
import { SesOdasiArkaPlanTamamenCik } from '../arka-plan/SesOdasiArkaPlanServisi';

export const SES_ODASI_PIP_CIK_ACTION = 'ses_odasi_pip_cik';

function pipParams(autoEnterEnabled: boolean, title?: string | null) {
  const sesOdasi = i18n.t('sesOda.sesOdasi');
  return {
    width: 240,
    height: 320,
    title: (title || sesOdasi).trim() || sesOdasi,
    subtitle: i18n.t('sesOda.sesDevamEdiyor'),
    seamlessResizeEnabled: false as const,
    autoEnterEnabled,
    actions: [
      {
        iconName: 'pip_close',
        action: SES_ODASI_PIP_CIK_ACTION,
        title: i18n.t('sesOda.cik'),
        description: i18n.t('sesOda.sesOdasindanCik'),
      },
    ],
  };
}

function paramsUygula(autoEnterEnabled: boolean, title?: string | null) {
  if (!ExpoPip.isAvailable()) return;
  try {
    ExpoPip.setPictureInPictureParams(pipParams(autoEnterEnabled, title));
  } catch (e) {
    console.warn('[SesOdasiPip] setPictureInPictureParams', e);
  }
}

/** Root: PiP sistem aksiyonu "Çık" — bir kez kur */
export function SesOdasiPipKurulum(): void {
  if (Platform.OS !== 'android') return;
  if ((globalThis as { __sesOdasiPipKuruluMu?: boolean }).__sesOdasiPipKuruluMu) {
    return;
  }
  (globalThis as { __sesOdasiPipKuruluMu?: boolean }).__sesOdasiPipKuruluMu = true;
  try {
    ExpoPip.addEventListener('onPipActionPressed', (event) => {
      if (event?.action === SES_ODASI_PIP_CIK_ACTION) {
        void SesOdasiArkaPlanTamamenCik();
      }
    });
  } catch {
    /* native yok */
  }
}

/**
 * Oda ekranından çağır — focus + canlı oturumdayken PiP auto-enter açar.
 */
export function useSesOdasiPip(opts: {
  etkin: boolean;
  roomTitle?: string | null;
}): { isInPipMode: boolean; pipKapatVeCik: () => void } {
  const { isInPipMode: hookPip } = ExpoPip.useIsInPip();
  const [tercihAcik, setTercihAcik] = useState(SesOdasiPipBellekten);

  useEffect(() => {
    void SesOdasiPipAcikMi().then(setTercihAcik);
  }, [opts.etkin]);

  const isInPipMode =
    Platform.OS === 'android' && (hookPip || !!ExpoPip.isInPipMode());

  useEffect(() => {
    const ac = opts.etkin && tercihAcik && Platform.OS === 'android';
    paramsUygula(ac, opts.roomTitle);
    return () => {
      paramsUygula(false, opts.roomTitle);
    };
  }, [opts.etkin, opts.roomTitle, tercihAcik]);

  // Android 11 ve altı: autoEnter yok → Home'da manuel PiP
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!opts.etkin || !tercihAcik) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'background') return;
      if (!ExpoPip.isAvailable()) return;
      if (ExpoPip.isInPipMode()) return;
      try {
        ExpoPip.enterPipMode(pipParams(true, opts.roomTitle));
      } catch (e) {
        console.warn('[SesOdasiPip] enterPipMode', e);
      }
    });
    return () => sub.remove();
  }, [opts.etkin, opts.roomTitle, tercihAcik]);

  const pipKapatVeCik = useCallback(() => {
    void SesOdasiArkaPlanTamamenCik();
  }, []);

  return { isInPipMode, pipKapatVeCik };
}

/** Root kompakt kart — PiP modunda mı */
export function useSesOdasiPipModu(): boolean {
  const { isInPipMode } = ExpoPip.useIsInPip();
  if (Platform.OS !== 'android') return false;
  return isInPipMode || !!ExpoPip.isInPipMode();
}

export function SesOdasiPipParamsKapat(): void {
  paramsUygula(false);
}
