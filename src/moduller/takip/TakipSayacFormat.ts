import i18n from '../../i18n';

/** Database integer tutar; UI locale kisa formata cevirir. */
export function TakipSayaciniFormatla(
  n: number | null | undefined,
  locale = 'tr-TR',
): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  const tr = locale.toLowerCase().startsWith('tr');
  if (v < 1000) return String(v);
  const kisalt = (orani: number, trEk: string, enEk: string) => {
    let s = (v / orani).toFixed(1).replace('.', ',');
    if (s.endsWith(',0')) s = s.slice(0, -2);
    return tr ? `${s} ${trEk}` : `${s.replace(',', '.')}${enEk}`;
  };
  if (v < 1_000_000) return kisalt(1000, 'B', 'K');
  return kisalt(1_000_000, 'Mn', 'M');
}

export function TakipIliskiEtiketi(input: {
  state: string;
  followsYou?: boolean;
  isMutual?: boolean;
}): string | null {
  if (input.state === 'MUTUAL' || input.isMutual) return i18n.t('takip.karsilikli');
  if (input.state === 'FOLLOWS_YOU' || input.followsYou)
    return i18n.t('takip.seniTakipEdiyor');
  if (input.state === 'INCOMING_REQUEST') return i18n.t('takip.istekGonderdi');
  return null;
}
