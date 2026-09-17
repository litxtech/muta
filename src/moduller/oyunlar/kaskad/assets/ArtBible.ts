/**
 * Realm of Storms — Art Bible (tek kaynak görsel dil).
 * Asset prompt'ları ve prosedürel renderer bu sözleşmeye bağlıdır.
 * Gates of Olympus / Zeus / Pragmatic asset kopyası YASAK.
 */

export const STORM_ART_BIBLE = {
  brand: 'TAMUSO — Realm of Storms',
  characterName: 'The Storm Keeper',
  world: 'Fırtına Krallığı — gökyüzündeki antik tapınak',
  style: [
    'premium cinematic mythological fantasy',
    'dark royal',
    'realistic materials',
    'storm energy',
    'antique metal + crystal',
  ] as const,
  forbid: [
    'emoji',
    'clipart',
    'flat icon',
    'cartoon baby',
    'generic RN button cells',
    'Zeus lookalike',
    'white-bearded greek god clone',
    'Gates of Olympus assets',
    'Pragmatic Play logos/symbols/audio',
  ] as const,
  palette: {
    midnight: '#0B1020',
    stormViolet: '#1B1638',
    deepPlum: '#2A1838',
    antiqueGold: '#C9A24A',
    antiqueGoldBright: '#E8C878',
    electricCyan: '#6FE3FF',
    stormCyan: '#3DB8E8',
    controlledMagenta: '#B84A8C',
    obsidian: '#121018',
    fog: 'rgba(180,200,255,0.08)',
    rim: 'rgba(111,227,255,0.35)',
  },
  materials: {
    gem: 'faceted crystal, internal refraction, rim light, subtle bloom',
    metal: 'antique gold / dark silver, brushed, micro scratches',
    energy: 'electric cyan core, soft outer glow, no cheap neon flat fill',
  },
  camera: 'front three-quarter, consistent orthographic-ish game asset angle',
  lighting: 'key from upper-left warm gold, fill cool cyan, rim separation from bg',
  transparency: 'symbol assets: transparent background; bg layers: opaque or soft alpha',
} as const;

/** Eksik production asset checklist — Image/Rive gelene kadar prosedürel fallback */
export const STORM_ASSET_REQUIREMENTS = [
  {
    id: 'storm_keeper_idle',
    filename: 'storm_keeper_idle.webp',
    resolution: '1024x1536',
    format: 'webp',
    transparent: true,
    kind: 'character' as const,
    prompt:
      'Adult mythological storm guardian, hooded dark silver and antique gold armor, storm crystal chest core, glowing cyan eyes, serious expression, no white beard, no Zeus likeness, cinematic fantasy concept art, transparent background',
  },
  {
    id: 'bg_sky',
    filename: 'storm_sky.webp',
    resolution: '1080x1920',
    format: 'webp',
    transparent: false,
    kind: 'background' as const,
    prompt:
      'Deep midnight blue storm sky with violet clouds, cinematic fantasy mobile game background, no characters, no UI',
  },
  {
    id: 'bg_temple',
    filename: 'storm_temple_columns.webp',
    resolution: '1080x1200',
    format: 'webp',
    transparent: true,
    kind: 'background' as const,
    prompt:
      'Distant floating ancient temple columns in storm mist, dark royal fantasy, transparent edges',
  },
  {
    id: 'gem_blue',
    filename: 'blue_storm_gem.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Faceted blue storm gemstone with metallic frame, internal reflection, rim light, mobile slot symbol, transparent background',
  },
  {
    id: 'gem_green',
    filename: 'green_storm_gem.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Faceted green storm gemstone with metallic frame, internal reflection, rim light, mobile slot symbol, transparent background',
  },
  {
    id: 'gem_purple',
    filename: 'purple_storm_gem.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Faceted purple storm gemstone with metallic frame, internal reflection, rim light, mobile slot symbol, transparent background',
  },
  {
    id: 'gem_red',
    filename: 'red_storm_gem.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Faceted red storm gemstone with metallic frame, internal reflection, rim light, mobile slot symbol, transparent background',
  },
  {
    id: 'gem_amber',
    filename: 'amber_storm_gem.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Faceted amber storm gemstone with metallic frame, internal reflection, rim light, mobile slot symbol, transparent background',
  },
  {
    id: 'storm_crown',
    filename: 'storm_crown.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Antique gold crown containing blue storm crystal, premium fantasy game asset, front three-quarter, transparent background, no text',
  },
  {
    id: 'tempest_ring',
    filename: 'tempest_ring.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Ornate tempest ring with storm gem, antique gold, premium fantasy game asset, transparent background, no text',
  },
  {
    id: 'celestial_chalice',
    filename: 'celestial_chalice.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Celestial chalice with cyan storm energy liquid, antique metal, premium fantasy game asset, transparent background, no text',
  },
  {
    id: 'time_relic',
    filename: 'time_relic.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'symbol' as const,
    prompt:
      'Time relic hourglass with storm crystal sand, antique gold frame, premium fantasy game asset, transparent background, no text',
  },
  {
    id: 'multiplier_orb',
    filename: 'storm_multiplier_orb.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'special' as const,
    prompt:
      'Floating storm energy orb with metallic rune wing frame, electric cyan core, premium slot multiplier symbol, transparent background, no baked-in numbers',
  },
  {
    id: 'scatter_portal',
    filename: 'storm_portal_scatter.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'special' as const,
    prompt:
      'Ancient storm portal vortex with gold runes and deep dimensional center, scatter symbol, transparent background, no text',
  },
  {
    id: 'grid_frame',
    filename: 'storm_grid_frame.webp',
    resolution: '1200x1000',
    format: 'webp',
    transparent: true,
    kind: 'ui' as const,
    prompt:
      'Ornate antique metal and obsidian rectangular game grid frame with storm crystal inlays, empty center, transparent middle',
  },
  {
    id: 'spin_button',
    filename: 'storm_spin_button.webp',
    resolution: '512x512',
    format: 'webp',
    transparent: true,
    kind: 'ui' as const,
    prompt:
      'Circular dark metallic spin button with storm crystal core and gold rune ring, premium fantasy UI, transparent background',
  },
] as const;

export function missingStormVisualAssets(): string[] {
  // Production PNG'ler VisualAssets üzerinden bağlı; checklist boş.
  return [];
}
