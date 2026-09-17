/**
 * Asset registry — component içine string path dağıtılmaz.
 * Özgün Realm of Storms SFX/müzik: assets/realm-of-storms/audio/
 */

export type AudioChannel =
  | 'MUSIC'
  | 'AMBIENCE'
  | 'SFX'
  | 'UI'
  | 'WIN'
  | 'CHARACTER';

export type SfxEntry = {
  source: number | null;
  channel: AudioChannel;
};

const storm = {
  gameOpen: require('../../../../../assets/realm-of-storms/audio/game_open.wav') as number,
  gameExit: require('../../../../../assets/realm-of-storms/audio/game_exit.wav') as number,
  ambientWind: require('../../../../../assets/realm-of-storms/audio/ambient_wind.wav') as number,
  backgroundMusic: require('../../../../../assets/realm-of-storms/audio/background_music.wav') as number,
  bonusMusic: require('../../../../../assets/realm-of-storms/audio/bonus_music.wav') as number,
  spinPress: require('../../../../../assets/realm-of-storms/audio/spin_press.wav') as number,
  symbolsFalling: require('../../../../../assets/realm-of-storms/audio/symbols_falling.wav') as number,
  crystalLand: require('../../../../../assets/realm-of-storms/audio/crystal_land.wav') as number,
  symbolMatch: require('../../../../../assets/realm-of-storms/audio/symbol_match.wav') as number,
  symbolDestroy: require('../../../../../assets/realm-of-storms/audio/symbol_destroy.wav') as number,
  cascadeStart: require('../../../../../assets/realm-of-storms/audio/cascade_start.wav') as number,
  multiplierSpawn: require('../../../../../assets/realm-of-storms/audio/multiplier_spawn.wav') as number,
  multiplierSmall: require('../../../../../assets/realm-of-storms/audio/multiplier_small.wav') as number,
  multiplierMedium: require('../../../../../assets/realm-of-storms/audio/multiplier_medium.wav') as number,
  multiplierLarge: require('../../../../../assets/realm-of-storms/audio/multiplier_large.wav') as number,
  multiplierCollect: require('../../../../../assets/realm-of-storms/audio/multiplier_collect.wav') as number,
  lightning: require('../../../../../assets/realm-of-storms/audio/lightning.wav') as number,
  characterCast: require('../../../../../assets/realm-of-storms/audio/character_cast.wav') as number,
  scatterLand: require('../../../../../assets/realm-of-storms/audio/scatter_land.wav') as number,
  anticipation: require('../../../../../assets/realm-of-storms/audio/scatter_anticipation.wav') as number,
  bonusTrigger: require('../../../../../assets/realm-of-storms/audio/bonus_trigger.wav') as number,
  bonusIntro: require('../../../../../assets/realm-of-storms/audio/bonus_intro.wav') as number,
  freeSpinStart: require('../../../../../assets/realm-of-storms/audio/free_spin_start.wav') as number,
  retrigger: require('../../../../../assets/realm-of-storms/audio/retrigger.wav') as number,
  normalWin: require('../../../../../assets/realm-of-storms/audio/normal_win.wav') as number,
  bigWin: require('../../../../../assets/realm-of-storms/audio/big_win.wav') as number,
  megaWin: require('../../../../../assets/realm-of-storms/audio/mega_win.wav') as number,
  legendaryWin: require('../../../../../assets/realm-of-storms/audio/legendary_win.wav') as number,
  countUp: require('../../../../../assets/realm-of-storms/audio/count_up.wav') as number,
  countUpEnd: require('../../../../../assets/realm-of-storms/audio/count_up_end.wav') as number,
  uiClick: require('../../../../../assets/realm-of-storms/audio/ui_click.wav') as number,
  error: require('../../../../../assets/realm-of-storms/audio/error.wav') as number,
};

export const GameAudio: Record<string, SfxEntry> = {
  game_open: { source: storm.gameOpen, channel: 'UI' },
  ambient_wind: { source: storm.ambientWind, channel: 'AMBIENCE' },
  background_music: { source: storm.backgroundMusic, channel: 'MUSIC' },
  bonus_music: { source: storm.bonusMusic, channel: 'MUSIC' },
  spin_press: { source: storm.spinPress, channel: 'UI' },
  symbols_falling: { source: storm.symbolsFalling, channel: 'SFX' },
  symbol_land: { source: storm.crystalLand, channel: 'SFX' },
  symbol_match: { source: storm.symbolMatch, channel: 'SFX' },
  symbol_destroy: { source: storm.symbolDestroy, channel: 'SFX' },
  cascade_start: { source: storm.cascadeStart, channel: 'SFX' },
  cascade_land: { source: storm.crystalLand, channel: 'SFX' },
  multiplier_spawn: { source: storm.multiplierSpawn, channel: 'SFX' },
  multiplier_small: { source: storm.multiplierSmall, channel: 'SFX' },
  multiplier_medium: { source: storm.multiplierMedium, channel: 'SFX' },
  multiplier_large: { source: storm.multiplierLarge, channel: 'SFX' },
  multiplier_collect: { source: storm.multiplierCollect, channel: 'SFX' },
  lightning: { source: storm.lightning, channel: 'CHARACTER' },
  character_cast: { source: storm.characterCast, channel: 'CHARACTER' },
  scatter_land: { source: storm.scatterLand, channel: 'SFX' },
  scatter_anticipation: { source: storm.anticipation, channel: 'SFX' },
  bonus_trigger: { source: storm.bonusTrigger, channel: 'WIN' },
  bonus_intro: { source: storm.bonusIntro, channel: 'WIN' },
  free_spin_start: { source: storm.freeSpinStart, channel: 'SFX' },
  retrigger: { source: storm.retrigger, channel: 'WIN' },
  normal_win: { source: storm.normalWin, channel: 'WIN' },
  big_win: { source: storm.bigWin, channel: 'WIN' },
  mega_win: { source: storm.megaWin, channel: 'WIN' },
  legendary_win: { source: storm.legendaryWin, channel: 'WIN' },
  count_up: { source: storm.countUp, channel: 'WIN' },
  count_up_end: { source: storm.countUpEnd, channel: 'WIN' },
  button_press: { source: storm.uiClick, channel: 'UI' },
  bet_change: { source: storm.uiClick, channel: 'UI' },
  error: { source: storm.error, channel: 'UI' },
  insufficient_balance: { source: storm.error, channel: 'UI' },
  game_exit: { source: storm.gameExit, channel: 'UI' },
} as const;

export type KaskadSfxName = keyof typeof GameAudio;

export function missingAudioAssets(): string[] {
  return Object.entries(GameAudio)
    .filter(([, v]) => v.source == null)
    .map(([k]) => k);
}

export const GameAssets = {
  audio: GameAudio,
  visual: () => require('./VisualAssets').VisualAssets,
} as const;

export {
  missingStormVisualAssets,
  STORM_ART_BIBLE,
  STORM_ASSET_REQUIREMENTS,
} from './ArtBible';

export {
  VisualAssets,
  SymbolImages,
  CharacterImages,
  BackgroundImages,
  UiImages,
} from './VisualAssets';
