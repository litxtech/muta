/**
 * NOX REELS — ses kataloğu (realm-of-storms gerçek wav).
 */

import type { AudioChannel } from '../../kaskad/assets/GameAssets';

export type SlotSfxName =
  | 'button_press'
  | 'spin_start'
  | 'reel_loop'
  | 'reel_stop'
  | 'small_win'
  | 'medium_win'
  | 'big_win_intro'
  | 'coin_count'
  | 'wild_hit'
  | 'scatter_hit'
  | 'bonus_trigger'
  | 'ambient'
  | 'music';

type SfxEntry = { source: number; channel: AudioChannel };

const storm = {
  spinPress: require('../../../../../assets/realm-of-storms/audio/spin_press.wav'),
  falling: require('../../../../../assets/realm-of-storms/audio/symbols_falling.wav'),
  land: require('../../../../../assets/realm-of-storms/audio/crystal_land.wav'),
  match: require('../../../../../assets/realm-of-storms/audio/symbol_match.wav'),
  normalWin: require('../../../../../assets/realm-of-storms/audio/normal_win.wav'),
  bigWin: require('../../../../../assets/realm-of-storms/audio/big_win.wav'),
  megaWin: require('../../../../../assets/realm-of-storms/audio/mega_win.wav'),
  countUp: require('../../../../../assets/realm-of-storms/audio/count_up.wav'),
  scatter: require('../../../../../assets/realm-of-storms/audio/scatter_land.wav'),
  bonus: require('../../../../../assets/realm-of-storms/audio/bonus_trigger.wav'),
  mult: require('../../../../../assets/realm-of-storms/audio/multiplier_spawn.wav'),
  ui: require('../../../../../assets/realm-of-storms/audio/ui_click.wav'),
  music: require('../../../../../assets/realm-of-storms/audio/background_music.wav'),
  ambient: require('../../../../../assets/realm-of-storms/audio/ambient_wind.wav'),
  open: require('../../../../../assets/realm-of-storms/audio/game_open.wav'),
};

export const SlotAudioCatalog: Record<SlotSfxName, SfxEntry> = {
  button_press: { source: storm.spinPress, channel: 'UI' },
  spin_start: { source: storm.falling, channel: 'SFX' },
  reel_loop: { source: storm.falling, channel: 'SFX' },
  reel_stop: { source: storm.land, channel: 'SFX' },
  small_win: { source: storm.normalWin, channel: 'WIN' },
  medium_win: { source: storm.match, channel: 'WIN' },
  big_win_intro: { source: storm.bigWin, channel: 'WIN' },
  coin_count: { source: storm.countUp, channel: 'WIN' },
  wild_hit: { source: storm.mult, channel: 'SFX' },
  scatter_hit: { source: storm.scatter, channel: 'SFX' },
  bonus_trigger: { source: storm.bonus, channel: 'WIN' },
  ambient: { source: storm.ambient, channel: 'AMBIENCE' },
  music: { source: storm.music, channel: 'MUSIC' },
};

export const SLOT_PRELOAD_SFX: SlotSfxName[] = [
  'button_press',
  'spin_start',
  'reel_stop',
  'small_win',
  'medium_win',
  'big_win_intro',
  'scatter_hit',
  'wild_hit',
  'bonus_trigger',
];
