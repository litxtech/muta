/**
 * Asset path merkezi — component içine path yayılmaz.
 * Ses dosyaları Match-3 kütüphanesiyle paylaşılır (mevcut wav).
 */

export const GameAssets = {
  symbols: {
    crystalBlue: 'crystalBlue',
    crystalViolet: 'crystalViolet',
    crystalMint: 'crystalMint',
    crystalAmber: 'crystalAmber',
    starCore: 'starCore',
    cosmicEye: 'cosmicEye',
    galaxyOrb: 'galaxyOrb',
    energyCrown: 'energyCrown',
    portalScatter: 'portalScatter',
    multiplierOrb: 'multiplierOrb',
  },
  audio: {
    game_open: require('../../../../../assets/sounds/oyun/game_start.wav'),
    spin_start: require('../../../../../assets/sounds/oyun/tile_move.wav'),
    symbol_drop: require('../../../../../assets/sounds/oyun/tile_move.wav'),
    symbol_land: require('../../../../../assets/sounds/oyun/match_3.wav'),
    symbol_match: require('../../../../../assets/sounds/oyun/match_4.wav'),
    symbol_destroy: require('../../../../../assets/sounds/oyun/bomb.wav'),
    cascade: require('../../../../../assets/sounds/oyun/combo.wav'),
    multiplier_spawn: require('../../../../../assets/sounds/oyun/rocket.wav'),
    multiplier_collect: require('../../../../../assets/sounds/oyun/combo_big.wav'),
    scatter_land: require('../../../../../assets/sounds/oyun/color_bomb.wav'),
    scatter_near_miss: require('../../../../../assets/sounds/oyun/move_invalid.wav'),
    bonus_trigger: require('../../../../../assets/sounds/oyun/win.wav'),
    bonus_intro: require('../../../../../assets/sounds/oyun/game_start.wav'),
    bonus_spin: require('../../../../../assets/sounds/oyun/tile_move.wav'),
    big_win: require('../../../../../assets/sounds/oyun/win.wav'),
    mega_win: require('../../../../../assets/sounds/oyun/combo_big.wav'),
    epic_win: require('../../../../../assets/sounds/oyun/win.wav'),
    button_click: require('../../../../../assets/sounds/oyun/tile_move.wav'),
    bet_change: require('../../../../../assets/sounds/oyun/tile_move.wav'),
    balance_change: require('../../../../../assets/sounds/oyun/match_3.wav'),
    normal_game_music: require('../../../../../assets/sounds/oyun/game_start.wav'),
    bonus_game_music: require('../../../../../assets/sounds/oyun/combo.wav'),
  },
  backgrounds: {
    normal: 'normal',
    bonus: 'bonus',
  },
} as const;

export type KaskadSfxName = keyof typeof GameAssets.audio;
