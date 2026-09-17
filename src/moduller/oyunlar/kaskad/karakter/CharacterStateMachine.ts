/**
 * Fırtına Muhafızı — karakter state machine.
 * Aynı anda iki animasyon çakışmaz: yeni state yalnızca öncelik kuralına
 * göre mevcut state'i kesebilir; düşük öncelikli istekler yok sayılır.
 */

import type { CharacterState } from '../tipler/KaskadTipleri';

const PRIORITY: Record<CharacterState, number> = {
  IDLE: 0,
  RETURN_IDLE: 0,
  WATCHING: 1,
  CAST_SMALL: 2,
  CAST_MEDIUM: 3,
  CAST_LARGE: 4,
  BONUS_TRIGGER: 5,
  BIG_WIN: 6,
  SUPER_WIN: 7,
};

/** State'in doğal süresi — bitince RETURN_IDLE'a döner (0 = kalıcı) */
const DURATION_MS: Record<CharacterState, number> = {
  IDLE: 0,
  WATCHING: 0,
  CAST_SMALL: 700,
  CAST_MEDIUM: 950,
  CAST_LARGE: 1300,
  BONUS_TRIGGER: 1800,
  BIG_WIN: 2200,
  SUPER_WIN: 3000,
  RETURN_IDLE: 400,
};

export type CharacterMachine = {
  getState(): CharacterState;
  /** İzin veriliyorsa geçiş yapar; yapıldıysa true döner */
  request(next: CharacterState): boolean;
  subscribe(listener: (state: CharacterState) => void): () => void;
  reset(): void;
  dispose(): void;
};

export function createCharacterMachine(): CharacterMachine {
  let state: CharacterState = 'IDLE';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(s: CharacterState) => void>();

  const emit = () => {
    for (const l of listeners) l(state);
  };

  const set = (next: CharacterState) => {
    state = next;
    emit();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const dur = DURATION_MS[next];
    if (dur > 0) {
      timer = setTimeout(() => {
        state = next === 'RETURN_IDLE' ? 'IDLE' : 'RETURN_IDLE';
        emit();
        if (state === 'RETURN_IDLE') {
          timer = setTimeout(() => {
            state = 'IDLE';
            emit();
          }, DURATION_MS.RETURN_IDLE);
        }
      }, dur);
    }
  };

  return {
    getState: () => state,
    request(next: CharacterState) {
      // Interrupt kuralı: eşit/yüksek öncelik keser; düşük öncelik beklemez, düşer.
      if (PRIORITY[next] < PRIORITY[state] && DURATION_MS[state] > 0) {
        return false;
      }
      set(next);
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      state = 'IDLE';
      emit();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
}

/** Multiplier değerine göre cast state'i */
export function castStateFor(maxMultiplier: number): CharacterState {
  if (maxMultiplier >= 25) return 'CAST_LARGE';
  if (maxMultiplier >= 8) return 'CAST_MEDIUM';
  return 'CAST_SMALL';
}
