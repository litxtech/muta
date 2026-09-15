/**
 * Kristal Savaşı (Match-3) tahta tipleri.
 */

export type TileType =
  | 'diamond'
  | 'star'
  | 'fire'
  | 'moon'
  | 'crown'
  | 'bolt'
  | 'crystal';

export type SpecialType =
  | 'none'
  | 'rocket_h'
  | 'rocket_v'
  | 'bomb'
  | 'color_bomb';

export type BoardCell = {
  id: string;
  type: TileType;
  special: SpecialType;
  /** Boş hücre (düşme / temizlik sonrası) */
  empty?: boolean;
};

export type BoardState = {
  size: number;
  cells: BoardCell[][];
  seed: number;
  moveCount: number;
  score: number;
  combo: number;
  highestCombo: number;
};

export type GridPos = {
  row: number;
  col: number;
};

export type Move = {
  from: GridPos;
  to: GridPos;
};

export type MatchShape = 'line' | 'L' | 'T' | 'square';

export type MatchGroup = {
  cells: GridPos[];
  type: TileType;
  shape: MatchShape;
  length: number;
  /** Özel taş üretilecek hücre (genelde swap hedefi / merkez) */
  origin: GridPos;
};

export type CascadeEvent =
  | { kind: 'swap'; from: GridPos; to: GridPos }
  | {
      kind: 'match';
      groups: MatchGroup[];
      cleared: GridPos[];
      scoreGain?: number;
    }
  | { kind: 'special_created'; at: GridPos; special: SpecialType; type: TileType }
  | {
      kind: 'special_activated';
      at: GridPos;
      special: SpecialType;
      cleared: GridPos[];
      scoreGain?: number;
    }
  | { kind: 'drop' }
  | { kind: 'fill' }
  | { kind: 'shuffle' }
  | { kind: 'invalid_swap'; from: GridPos; to: GridPos };

/** Animasyon oynatma — olay sonrası tahta anlığı */
export type CascadeStep = {
  event: CascadeEvent;
  board: BoardState;
};

export type CascadeResult = {
  board: BoardState;
  scoreDelta: number;
  comboReached: number;
  events: CascadeEvent[];
  steps: CascadeStep[];
  valid: boolean;
};

export type SeededRandom = () => number;
