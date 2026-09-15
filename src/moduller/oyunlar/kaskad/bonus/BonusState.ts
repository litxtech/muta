/**
 * Bonus state helpers.
 */

export type BonusUiState = {
  active: boolean;
  remainingSpins: number;
  totalWon: number;
};

export function createIdleBonusState(): BonusUiState {
  return { active: false, remainingSpins: 0, totalWon: 0 };
}

export function enterBonus(spins: number): BonusUiState {
  return { active: true, remainingSpins: spins, totalWon: 0 };
}

export function consumeBonusSpin(state: BonusUiState, win: number): BonusUiState {
  const remaining = Math.max(0, state.remainingSpins - 1);
  return {
    active: remaining > 0,
    remainingSpins: remaining,
    totalWon: state.totalWon + win,
  };
}
