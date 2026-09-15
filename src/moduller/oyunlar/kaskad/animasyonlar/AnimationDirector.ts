/**
 * AnimationDirector — tüm animasyon/ses/haptik koordinasyonunun tek noktası.
 * Componentler kendi kafasına göre animasyon başlatmaz; playback fazları
 * burada oyun eventlerine çevrilir, AudioManager / HapticManager / karakter /
 * kamera bu eventlere subscribe olur. Böylece ses + görüntü + haptic kaymaz.
 */

import type { KaskadPhase, WinTier } from '../tipler/KaskadTipleri';

export type GameEventName =
  | 'SPIN_START'
  | 'SYMBOLS_DROP'
  | 'SYMBOL_LAND'
  | 'MATCH_START'
  | 'DESTROY'
  | 'CASCADE'
  | 'MULTIPLIER_REVEAL'
  | 'MULTIPLIER_COLLECT'
  | 'CHARACTER_CAST'
  | 'LIGHTNING_IMPACT'
  | 'SCATTER_LAND'
  | 'ANTICIPATION_START'
  | 'BONUS_TRIGGER'
  | 'RETRIGGER'
  | 'BONUS_MODE_ENTER'
  | 'BIG_WIN'
  | 'WIN_COUNT_START'
  | 'ROUND_FINALIZE'
  | 'ROUND_IDLE';

export type GameEventPayload = {
  multipliers?: number[];
  maxMultiplier?: number;
  tier?: WinTier;
  totalWin?: number;
  scatterCount?: number;
  extraSpins?: number;
  cascadeIndex?: number;
};

export type GameEventListener = (
  event: GameEventName,
  payload: GameEventPayload,
) => void;

export type AnimationDirector = {
  subscribe(listener: GameEventListener): () => void;
  emit(event: GameEventName, payload?: GameEventPayload): void;
  /** Playback fazını oyun eventlerine çevirir */
  handlePhase(phase: KaskadPhase, meta?: Record<string, unknown>): void;
  clear(): void;
};

/** Multiplier büyüklüğüne göre karakter cast seviyesi */
export function castLevelFor(maxMultiplier: number): 'small' | 'medium' | 'large' {
  if (maxMultiplier >= 25) return 'large';
  if (maxMultiplier >= 8) return 'medium';
  return 'small';
}

export function createAnimationDirector(): AnimationDirector {
  const listeners = new Set<GameEventListener>();

  const emit = (event: GameEventName, payload: GameEventPayload = {}) => {
    for (const l of listeners) {
      try {
        l(event, payload);
      } catch {
        // Listener hatası diğerlerini ve oyunu durdurmaz
      }
    }
  };

  return {
    subscribe(listener: GameEventListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit,
    handlePhase(phase: KaskadPhase, meta?: Record<string, unknown>) {
      switch (phase) {
        case 'SPIN_START':
          emit('SPIN_START');
          break;
        case 'SYMBOLS_DROP':
          emit('SYMBOLS_DROP');
          break;
        case 'MATCH_CHECK':
          break;
        case 'WIN_HIGHLIGHT':
          emit('MATCH_START');
          break;
        case 'DESTROY':
          emit('DESTROY');
          break;
        case 'CASCADE':
          emit('CASCADE', {
            cascadeIndex: Number(meta?.cascadeIndex ?? 0),
          });
          emit('SYMBOL_LAND');
          break;
        case 'MULTIPLIER_REVEAL': {
          const mults = (meta?.multipliers as number[] | undefined) ?? [];
          const maxMult = mults.length ? Math.max(...mults) : 0;
          emit('MULTIPLIER_REVEAL', { multipliers: mults, maxMultiplier: maxMult });
          emit('CHARACTER_CAST', { maxMultiplier: maxMult });
          emit('LIGHTNING_IMPACT', { maxMultiplier: maxMult });
          break;
        }
        case 'MULTIPLIER_COLLECT': {
          const mults = (meta?.multipliers as number[] | undefined) ?? [];
          emit('MULTIPLIER_COLLECT', { multipliers: mults });
          break;
        }
        case 'ANTICIPATION':
          emit('ANTICIPATION_START', {
            scatterCount: Number(meta?.scatterCount ?? 0),
          });
          break;
        case 'SCATTER_CHECK':
          if (Number(meta?.scatterCount ?? 0) > 0) {
            emit('SCATTER_LAND', {
              scatterCount: Number(meta?.scatterCount ?? 0),
            });
          }
          break;
        case 'RETRIGGER':
          emit('RETRIGGER', { extraSpins: Number(meta?.extraSpins ?? 0) });
          break;
        case 'BONUS_INTRO':
          emit('BONUS_TRIGGER');
          break;
        case 'BONUS_MODE':
          emit('BONUS_MODE_ENTER');
          break;
        case 'BIG_WIN':
          emit('BIG_WIN', {
            tier: meta?.tier as WinTier | undefined,
            totalWin: Number(meta?.totalWin ?? 0),
          });
          emit('WIN_COUNT_START', { totalWin: Number(meta?.totalWin ?? 0) });
          break;
        case 'FINALIZE':
          emit('ROUND_FINALIZE', { totalWin: Number(meta?.totalWin ?? 0) });
          break;
        case 'IDLE':
          emit('ROUND_IDLE');
          break;
        default:
          break;
      }
    },
    clear() {
      listeners.clear();
    },
  };
}
