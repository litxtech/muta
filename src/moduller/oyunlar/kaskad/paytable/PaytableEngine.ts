/**
 * Paytable — eşik bandı seçimi ve kazanç hesabı.
 */

import { PAY_BAND_KEYS } from '../sabitler/KaskadSabitleri';
import type {
  KaskadMathConfig,
  KaskadSymbolType,
  SymbolPayBand,
  WinTier,
} from '../tipler/KaskadTipleri';

export function resolvePayBand(count: number): keyof SymbolPayBand | null {
  if (count >= 12) return 12;
  if (count >= 10) return 10;
  if (count >= 8) return 8;
  return null;
}

export function symbolPayoutMult(
  config: KaskadMathConfig,
  symbolType: KaskadSymbolType,
  count: number,
): number {
  const table = config.paytable[symbolType];
  if (!table) return 0;
  const band = resolvePayBand(count);
  if (!band) return 0;
  return table[band] ?? 0;
}

export function calcClusterWin(
  config: KaskadMathConfig,
  symbolType: KaskadSymbolType,
  count: number,
  betAmount: number,
): number {
  const mult = symbolPayoutMult(config, symbolType, count);
  if (mult <= 0) return 0;
  return Math.floor(betAmount * mult * 100) / 100;
}

export function resolveWinTier(
  config: KaskadMathConfig,
  totalWin: number,
  betAmount: number,
): WinTier {
  if (betAmount <= 0 || totalWin <= 0) return 'NONE';
  const ratio = totalWin / betAmount;
  const t = config.winTiers;
  if (ratio >= t.divine) return 'DIVINE';
  if (ratio >= t.cosmic) return 'COSMIC';
  if (ratio >= t.thunder) return 'THUNDER';
  if (ratio >= t.storm) return 'STORM';
  return 'NONE';
}

export function clampBet(config: KaskadMathConfig, bet: number): number {
  const rounded = Math.floor(bet);
  return Math.min(config.maxBet, Math.max(config.minBet, rounded));
}

export function validatePaytable(config: KaskadMathConfig): string[] {
  const errors: string[] = [];
  for (const [sym, band] of Object.entries(config.paytable)) {
    if (!band) continue;
    for (const key of PAY_BAND_KEYS) {
      const v = band[key];
      if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
        errors.push(`${sym}.${key} geçersiz`);
      }
    }
  }
  return errors;
}
