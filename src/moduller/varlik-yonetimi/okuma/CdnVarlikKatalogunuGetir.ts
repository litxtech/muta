/**
 * CDN asset metadata — binary uygulama icine gomulmez.
 * Upload / malware scan backend (admin) isidir.
 */
export type CdnVarlik = {
  code: string;
  kind: 'gift_animation' | 'room_theme' | 'badge' | 'cover' | 'other';
  url: string;
  mime?: string;
  bytes?: number;
};

const YEREL_KATALOG: CdnVarlik[] = [
  {
    code: 'placeholder_cover',
    kind: 'cover',
    url: 'https://litxtech.com/cdn/placeholders/cover.webp',
  },
  {
    code: 'placeholder_badge',
    kind: 'badge',
    url: 'https://litxtech.com/cdn/placeholders/badge.webp',
  },
];

export function CdnVarlikKatalogunuGetir(): CdnVarlik[] {
  return YEREL_KATALOG;
}

export function CdnVarlikUrlCoz(code: string): string | null {
  return YEREL_KATALOG.find((v) => v.code === code)?.url ?? null;
}
