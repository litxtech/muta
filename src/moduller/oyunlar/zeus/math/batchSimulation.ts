import { simulateZeusSpin } from './simulateZeusSpin';
import type { ZeusMathConfig } from '../tipler/ZeusTipleri';

export type SimulationReport = {
  rounds: number;
  bonusRounds: number;
  totalWager: number;
  totalPayout: number;
  observedRtp: number;
  baseGameRtp: number;
  bonusRtp: number;
  hitRate: number;
  zeroWinRate: number;
  averageWin: number;
  medianWin: number;
  maxWin: number;
  maxWinMultiple: number;
  bonusFrequency: number;
  averageBonusPayout: number;
  averageCascades: number;
  cascadeDistribution: Record<string, number>;
  multiplierFrequency: number;
  multiplierDistribution: Record<string, number>;
  maxMultiplier: number;
  variance: number;
  standardDeviation: number;
};

type SimAccumulator = {
  runRange: (start: number, end: number) => void;
  buildReport: (rounds: number, betAmount: number) => SimulationReport;
};

function createSimAccumulator(
  config: ZeusMathConfig,
  betAmount: number,
  seedPrefix: string,
): SimAccumulator {
  let totalWager = 0;
  let totalPayout = 0;
  let basePayout = 0;
  let bonusPayout = 0;
  let hits = 0;
  let zeroWins = 0;
  let bonuses = 0;
  let bonusRounds = 0;
  let cascadeSum = 0;
  let maxWin = 0;
  let multiplierHits = 0;
  let maxMultiplier = 0;
  const wins: number[] = [];
  const cascadeDist: Record<string, number> = {};
  const multDist: Record<string, number> = {};
  const bonusPayouts: number[] = [];
  const bonusGuardSpins = 1000;

  const runOne = (i: number): void => {
    const result = simulateZeusSpin({
      config,
      seed: `${seedPrefix}-${i}`,
      betAmount,
      roundId: `r${i}`,
      sessionId: 'sim',
      balanceBefore: Number.MAX_SAFE_INTEGER / 4,
    });

    totalWager += betAmount;
    let roundPayout = result.totalWin;
    basePayout += result.totalWin;

    const cKey = String(result.cascades.length);
    cascadeDist[cKey] = (cascadeDist[cKey] ?? 0) + 1;
    cascadeSum += result.cascades.length;

    if (result.appliedMultiplier > 1) {
      multiplierHits += 1;
      if (result.appliedMultiplier > maxMultiplier) {
        maxMultiplier = result.appliedMultiplier;
      }
    }
    for (const v of result.orbValues) {
      const mKey = String(v);
      multDist[mKey] = (multDist[mKey] ?? 0) + 1;
    }

    if (result.bonusTriggered && result.bonus) {
      bonuses += 1;
      let spinsLeft = result.bonus.freeSpins;
      let persistent = 0;
      let thisBonusPayout = 0;
      let spinIndex = 0;
      while (spinsLeft > 0 && spinIndex < bonusGuardSpins) {
        const bonusResult = simulateZeusSpin({
          config,
          seed: `${seedPrefix}-${i}-b${spinIndex}`,
          betAmount,
          roundId: `r${i}b${spinIndex}`,
          sessionId: 'sim',
          balanceBefore: Number.MAX_SAFE_INTEGER / 4,
          isFreeSpin: true,
          remainingFreeSpins: spinsLeft,
          persistentMultiplier: persistent,
        });
        spinsLeft = spinsLeft - 1 + bonusResult.retriggerSpins;
        persistent = config.bonus.persistentMultiplier
          ? bonusResult.persistentMultiplierAfter
          : 0;
        thisBonusPayout += bonusResult.totalWin;
        bonusRounds += 1;
        spinIndex += 1;
      }
      bonusPayout += thisBonusPayout;
      bonusPayouts.push(thisBonusPayout);
      roundPayout += thisBonusPayout;
    }

    totalPayout += roundPayout;
    wins.push(roundPayout);
    if (roundPayout > 0) hits += 1;
    else zeroWins += 1;
    if (roundPayout > maxWin) maxWin = roundPayout;
  };

  return {
    runRange: (start, end) => {
      for (let i = start; i < end; i += 1) runOne(i);
    },
    buildReport: (rounds, bet) => {
      const mean = rounds > 0 ? totalPayout / rounds : 0;
      let varianceSum = 0;
      for (const w of wins) varianceSum += (w - mean) ** 2;
      const variance = rounds > 1 ? varianceSum / (rounds - 1) : 0;
      const sorted = [...wins].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianWin =
        sorted.length === 0
          ? 0
          : sorted.length % 2 === 1
            ? sorted[mid]!
            : (sorted[mid - 1]! + sorted[mid]!) / 2;
      return {
        rounds,
        bonusRounds,
        totalWager,
        totalPayout,
        observedRtp: totalWager > 0 ? totalPayout / totalWager : 0,
        baseGameRtp: totalWager > 0 ? basePayout / totalWager : 0,
        bonusRtp: totalWager > 0 ? bonusPayout / totalWager : 0,
        hitRate: rounds > 0 ? hits / rounds : 0,
        zeroWinRate: rounds > 0 ? zeroWins / rounds : 0,
        averageWin: mean,
        medianWin,
        maxWin,
        maxWinMultiple: bet > 0 ? maxWin / bet : 0,
        bonusFrequency: rounds > 0 ? bonuses / rounds : 0,
        averageBonusPayout:
          bonusPayouts.length > 0
            ? bonusPayouts.reduce((a, b) => a + b, 0) / bonusPayouts.length
            : 0,
        averageCascades: rounds > 0 ? cascadeSum / rounds : 0,
        cascadeDistribution: cascadeDist,
        multiplierFrequency: rounds > 0 ? multiplierHits / rounds : 0,
        multiplierDistribution: multDist,
        maxMultiplier,
        variance,
        standardDeviation: Math.sqrt(variance),
      };
    },
  };
}

export function runBatchSimulation(
  config: ZeusMathConfig,
  rounds: number,
  betAmount: number,
  seedPrefix = 'sim',
): SimulationReport {
  const acc = createSimAccumulator(config, betAmount, seedPrefix);
  acc.runRange(0, rounds);
  return acc.buildReport(rounds, betAmount);
}

export async function runBatchSimulationAsync(
  config: ZeusMathConfig,
  rounds: number,
  betAmount: number,
  options?: {
    seedPrefix?: string;
    chunkSize?: number;
    onProgress?: (done: number, total: number) => void;
    shouldCancel?: () => boolean;
  },
): Promise<SimulationReport> {
  const seedPrefix = options?.seedPrefix ?? 'sim';
  const chunkSize = Math.max(100, options?.chunkSize ?? 2000);
  const acc = createSimAccumulator(config, betAmount, seedPrefix);
  let done = 0;
  while (done < rounds) {
    if (options?.shouldCancel?.()) break;
    const end = Math.min(rounds, done + chunkSize);
    acc.runRange(done, end);
    done = end;
    options?.onProgress?.(done, rounds);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return acc.buildReport(done, betAmount);
}
