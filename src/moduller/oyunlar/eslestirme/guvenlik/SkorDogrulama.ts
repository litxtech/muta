/**
 * İstemci skor akıl sağlığı kontrolleri — bayrak üretir, cezalandırmaz.
 */

export type ScoreSanityInput = {
  score: number;
  elapsedSeconds: number;
  moveCount: number;
  highestCombo: number;
  durationSeconds: number;
};

export type ScoreSanityFlags = {
  ok: boolean;
  flags: string[];
};

/** Makul üst sınırlar (client-side triage) */
const MAX_SCORE_PER_SECOND = 2500;
const MAX_MOVES_PER_SECOND = 8;
const MAX_SCORE_HARD = 5_000_000;
const MAX_COMBO_HARD = 200;

export function validateScoreSanity(input: ScoreSanityInput): ScoreSanityFlags {
  const flags: string[] = [];
  const elapsed = Math.max(0.001, input.elapsedSeconds);
  const duration = Math.max(1, input.durationSeconds);

  if (input.score < 0) flags.push('negative_score');
  if (input.moveCount < 0) flags.push('negative_moves');
  if (input.highestCombo < 0) flags.push('negative_combo');
  if (input.score > MAX_SCORE_HARD) flags.push('impossible_score_hard');
  if (input.highestCombo > MAX_COMBO_HARD) flags.push('impossible_combo');
  if (elapsed > duration + 5) flags.push('session_time_violation');

  const scorePerSec = input.score / elapsed;
  if (scorePerSec > MAX_SCORE_PER_SECOND) flags.push('impossible_score_rate');

  const movesPerSec = input.moveCount / elapsed;
  if (movesPerSec > MAX_MOVES_PER_SECOND) flags.push('impossible_move_speed');

  if (input.moveCount === 0 && input.score > 0) flags.push('score_without_moves');

  return { ok: flags.length === 0, flags };
}
