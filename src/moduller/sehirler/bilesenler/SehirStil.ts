import { StyleSheet } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Şehir modülü — tek modern görsel dil */
export const SehirStil = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 8,
    overflow: 'hidden',
  },
  heroEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 26,
  },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: BoslukTokenlari.sm },
  kpi: {
    flexGrow: 1,
    minWidth: '30%',
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 4,
  },
  kpiN: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  kpiL: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  section: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  kartBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, lineHeight: 18 },
  link: { ...TipografiTokenlari.caption, color: RenkTokenlari.mint, fontWeight: '700' },
  btnPrimary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.primary,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
  btnSecondary: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.violet,
  },
  btnSecondaryText: { color: '#fff', fontWeight: '800' },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  btnGhostText: { color: RenkTokenlari.text, fontWeight: '700' },
  barBg: {
    height: 6,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: RenkTokenlari.mint,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(61,207,176,0.16)',
  },
  pillText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 9,
  },
});
