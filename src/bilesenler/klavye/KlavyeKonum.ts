import { Dimensions } from 'react-native';

/** Son klavye üst kenarı (ekran Y) — focus kaydırma için */
let sonKlavyeScreenY = Dimensions.get('window').height;
let sonKlavyeH = 0;

export function KlavyeKonumunuKaydet(screenY: number, height: number) {
  if (screenY > 0) sonKlavyeScreenY = screenY;
  sonKlavyeH = Math.max(0, height);
}

export function KlavyeUstY(): number {
  if (sonKlavyeH > 0) return sonKlavyeScreenY;
  return Dimensions.get('window').height;
}
