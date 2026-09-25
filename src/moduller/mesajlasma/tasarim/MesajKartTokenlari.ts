/**
 * Voice / music / link / reply cam kart ortak tokenları.
 */
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export const MesajKartTokenlari = {
  opacity: 0.92,
  bgMine: 'rgba(255,255,255,0.22)',
  bgTheirs: 'rgba(255,255,255,0.08)',
  borderMine: 'rgba(255,255,255,0.35)',
  borderTheirs: RenkTokenlari.border,
  borderWidth: 1,
  radius: YaricapTokenlari.lg ?? 16,
  radiusInner: 12,
  padding: 10,
  gap: 8,
  accent: RenkTokenlari.mint,
  accentSoft: RenkTokenlari.primarySoft,
  textMine: RenkTokenlari.textOnPrimary,
  textTheirs: RenkTokenlari.text,
  mutedMine: 'rgba(18,4,12,0.55)',
  mutedTheirs: RenkTokenlari.textMuted,
  waveformBar: RenkTokenlari.mint,
  waveformTrack: 'rgba(255,255,255,0.25)',
  minWidth: 220,
  maxWidth: '86%' as const,
} as const;

export function mesajKartCamStil(mine: boolean) {
  return {
    backgroundColor: mine
      ? MesajKartTokenlari.bgMine
      : MesajKartTokenlari.bgTheirs,
    borderColor: mine
      ? MesajKartTokenlari.borderMine
      : MesajKartTokenlari.borderTheirs,
    borderWidth: MesajKartTokenlari.borderWidth,
    borderRadius: MesajKartTokenlari.radius,
    opacity: MesajKartTokenlari.opacity,
    padding: MesajKartTokenlari.padding,
    gap: MesajKartTokenlari.gap,
    minWidth: MesajKartTokenlari.minWidth,
    maxWidth: MesajKartTokenlari.maxWidth,
  } as const;
}
