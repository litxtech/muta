import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { premiumCtaGradient } from '../../../tasarim-sistemi/premium/PremiumAmbient';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

export type AnaSayfaMenuOgesi = {
  key: string;
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  href: string;
};

export type MenuGrubu = {
  baslik: string;
  ogeler: AnaSayfaMenuOgesi[];
};

type GrupProps = {
  grup: MenuGrubu;
  onOgeSec: (href: string) => void;
};

/**
 * X tarzı menü — kart yok; ikon + yazı satırları.
 */
export function HamburgerMenuGrubu({ grup, onOgeSec }: GrupProps) {
  useTemayaAboneOl();

  if (grup.ogeler.length === 0) return null;

  return (
    <View style={styles.grup}>
      <Text style={styles.grupBaslik}>{grup.baslik}</Text>
      <View style={styles.liste}>
        {grup.ogeler.map((oge) => (
          <Pressable
            key={oge.key}
            onPress={() => onOgeSec(oge.href)}
            style={({ pressed }) => [
              styles.satir,
              pressed && styles.satirPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${oge.baslik}. ${oge.alt}`}
          >
            <View style={styles.ikonWrap}>
              <Ionicons name={oge.icon} size={18} color={RenkTokenlari.text} />
            </View>
            <Text style={styles.baslik} numberOfLines={1} ellipsizeMode="tail">
              {oge.baslik}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type CtaProps = {
  onPress: () => void;
};

/** Gerçek hedef: /platform (görev · etkinlik · rozet hub) */
export function HamburgerPremiumCta({ onPress }: CtaProps) {
  useTemayaAboneOl();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ctaDis, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel="Daha fazla özellik keşfet"
    >
      <LinearGradient
        colors={[...premiumCtaGradient()]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cta}
      >
        <Text style={styles.ctaEmoji}>👑</Text>
        <View style={styles.ctaCopy}>
          <Text style={styles.ctaBaslik} numberOfLines={1} ellipsizeMode="tail">
            Daha fazla keşfet
          </Text>
          <Text style={styles.ctaAlt} numberOfLines={1} ellipsizeMode="tail">
            Görev · etkinlik · rozet
          </Text>
        </View>
        <Ionicons
          name="arrow-forward"
          size={12}
          color="#fff"
          style={styles.ctaOk}
        />
      </LinearGradient>
    </Pressable>
  );
}

/** Menü öğelerini yardım / yayın / hesap / keşif gruplarına ayır.
 * Destek·Bildir·Fikir üstte — uzun keşif listesinin altında kaybolmasın. */
export function menuGruplarinaBol(ogeler: AnaSayfaMenuOgesi[]): MenuGrubu[] {
  const yardimKeys = new Set(['destek', 'bildir', 'fikir']);
  const odaKeys = new Set(['live', 'pk']);
  const hesapKeys = new Set(['agency_manage', 'host']);
  const kesfetKeys = new Set([
    'official_city_rooms',
    'city_league',
    'events',
    'creators_for_you',
    'kesfet',
    'ranks',
  ]);
  const adminKeys = new Set(['admin_oyun_test', 'admin_panel']);

  const al = (keys: Set<string>) =>
    [...keys]
      .map((k) => ogeler.find((o) => o.key === k))
      .filter((o): o is AnaSayfaMenuOgesi => !!o);

  const kullanilan = new Set([
    ...yardimKeys,
    ...odaKeys,
    ...hesapKeys,
    ...kesfetKeys,
    ...adminKeys,
  ]);
  const diger = ogeler.filter((o) => !kullanilan.has(o.key));

  return [
    { baslik: 'YARDIM', ogeler: al(yardimKeys) },
    { baslik: 'YAYIN', ogeler: al(odaKeys) },
    { baslik: 'HESAP', ogeler: al(hesapKeys) },
    { baslik: 'KEŞFET', ogeler: [...al(kesfetKeys), ...diger] },
    { baslik: 'YÖNETİM', ogeler: al(adminKeys) },
  ].filter((g) => g.ogeler.length > 0);
}

const styles = StyleSheet.create({
  grup: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 6,
    gap: 2,
  },
  grupBaslik: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: RenkTokenlari.textDim,
    marginLeft: 4,
    marginBottom: 2,
    marginTop: 6,
  },
  liste: {
    alignSelf: 'stretch',
    width: '100%',
    gap: 0,
  },
  satir: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  satirPressed: {
    backgroundColor: RenkTokenlari.pressFill,
  },
  ikonWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  baslik: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: RenkTokenlari.text,
    letterSpacing: -0.2,
  },
  ctaDis: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 4,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: '100%',
  },
  ctaEmoji: { fontSize: 14, flexShrink: 0 },
  ctaCopy: { flex: 1, minWidth: 0, gap: 1, overflow: 'hidden' },
  ctaBaslik: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 15,
  },
  ctaAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    lineHeight: 13,
  },
  ctaOk: { flexShrink: 0 },
});
