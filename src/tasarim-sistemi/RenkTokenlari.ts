/**
 * Design System — renk tokenlari.
 * Ekranlarda rastgele HEX yazilmaz; sadece bu tokenlar kullanilir.
 * Degerler aktif gorunume gore cozulur.
 */
import { paletiAl } from './tema/TemaDurumu';
import {
  RenkTokenlariAcik,
  RenkTokenlariKadife,
  RenkTokenlariKoyu,
  RenkTokenlariKozmik,
  RenkTokenlariSampanya,
  RenkTokenlariZumrut,
} from './tema/RenkPaletleri';
import type { RenkPaleti } from './tema/TemaTipleri';

export type { RenkPaleti };
export {
  RenkTokenlariAcik,
  RenkTokenlariKadife,
  RenkTokenlariKoyu,
  RenkTokenlariKozmik,
  RenkTokenlariSampanya,
  RenkTokenlariZumrut,
};

/**
 * Aktif palet. StyleSheet factory ve JSX inline renkleri bunu okur.
 */
export const RenkTokenlari: RenkPaleti = new Proxy(RenkTokenlariKoyu, {
  get(_hedef, prop: string | symbol) {
    const palet = paletiAl();
    return palet[prop as keyof RenkPaleti];
  },
}) as RenkPaleti;

/** @deprecated RenkTokenlariAcik kullan */
export const RenkTokenlariAcikEski = RenkTokenlariAcik;
