import { PAY_BAND_KEYS } from '../config/ZeusSabitleri';
import type {
  SymbolPayBand,
  ZeusMathConfig,
  ZeusSymbolType,
  ZeusWinTier,
} from '../tipler/ZeusTipleri';

export function resolvePayBand(count: number): keyof SymbolPayBand | null {
  if (count >= 12) return 12;
  if (count >= 10) return 10;
  if (count >= 8) return 8;
  return null;
}

export function symbolPayoutMult(
  config: ZeusMathConfig,
  symbolType: ZeusSymbolType,
  count: number,
): number {
  const table = config.paytable[symbolType];
  if (!table) return 0;
  const band = resolvePayBand(count);
  if (!band) return 0;
  return table[band] ?? 0;
}

export function calcClusterWin(
  config: ZeusMathConfig,
  symbolType: ZeusSymbolType,
  count: number,
  betAmount: number,
): number {
  const mult = symbolPayoutMult(config, symbolType, count);
  if (mult <= 0) return 0;
  return Math.floor(betAmount * mult * 100) / 100;
}

export function resolveWinTier(
  config: ZeusMathConfig,
  totalWin: number,
  betAmount: number,
): ZeusWinTier {
  if (betAmount <= 0 || totalWin <= 0) return 'NONE';
  const ratio = totalWin / betAmount;
  const t = config.winTiers;
  if (ratio >= t.sensational) return 'SENSATIONAL';
  if (ratio >= t.mega) return 'MEGA';
  if (ratio >= t.big) return 'BIG';
  if (ratio >= t.nice) return 'NICE';
  return 'NORMAL';
}

export function clampBet(config: ZeusMathConfig, bet: number): number {
  const rounded = Math.floor(bet);
  return Math.min(config.maxBet, Math.max(config.minBet, rounded));
}

export function validatePaytable(config: ZeusMathConfig): string[] {
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
