import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../i18n/diller';
import { UsdYazi, type YayinciKazancOzeti } from '../yayinci/YayinciKazancApi';

type Props = {
  ozet: YayinciKazancOzeti | null;
  elmas: number | undefined;
  onPress: () => void;
};

function tarihYazi(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Cüzdanım içindeki Yayıncı Kazancım giriş kartı.
 * Elmas = sanal gösterge; USD tutarlar = ayrı ödeme hesabı. İkisi karıştırılmaz.
 */
export function YayinciKazancKarti({ ozet, elmas, onPress }: Props) {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const hazir = ozet?.available_usd ?? 0;
  const bekleyen = ozet?.pending_usd ?? 0;
  const min = ozet?.payout_min_usd ?? 25;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kap, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={t('yayinciK.cuzdanKartBaslik')}
    >
      <LinearGradient
        colors={[
          `${RenkTokenlari.violet}33`,
          `${RenkTokenlari.primary}1A`,
          RenkTokenlari.bgCard,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.ust}>
        <View style={styles.baslikKap}>
          <View style={styles.ikonKap}>
            <Ionicons name="diamond" size={15} color={RenkTokenlari.primarySoft} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.baslik} numberOfLines={1}>
              {t('yayinciK.cuzdanKartBaslik')}
            </Text>
            <Text style={styles.alt} numberOfLines={1}>
              {t('yayinciK.cuzdanKartAlt')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
      </View>

      <View style={styles.satir}>
        <View style={styles.hucre}>
          <Text style={styles.hucreEtiket}>{t('yayinciK.elmaslar')}</Text>
          <Text style={styles.hucreDeger} numberOfLines={1} adjustsFontSizeToFit>
            {(elmas ?? 0).toLocaleString(locale)}
          </Text>
          <Text style={styles.hucreAlt} numberOfLines={1}>
            {t('yayinciK.elmasKazancGostergesi')}
          </Text>
        </View>
        <View style={styles.dikeyCizgi} />
        <View style={styles.hucre}>
          <Text style={styles.hucreEtiket}>{t('yayinciK.odemeyeHazir')}</Text>
          <Text style={[styles.hucreDeger, { color: RenkTokenlari.mint }]} numberOfLines={1} adjustsFontSizeToFit>
            {UsdYazi(hazir)}
          </Text>
          <Text style={styles.hucreAlt} numberOfLines={1}>
            {t('yayinciK.bekleyenKazanc')}: {UsdYazi(bekleyen)}
          </Text>
        </View>
      </View>

      <View style={styles.altBar}>
        <View style={styles.altBarSol}>
          <Ionicons name="calendar-outline" size={12} color={RenkTokenlari.accent} />
          <Text style={styles.altBarYazi} numberOfLines={1}>
            {t('yayinciK.sonrakiOdeme')}:{' '}
            {tarihYazi(ozet?.next_payout_date, locale)}
          </Text>
        </View>
        <View style={styles.minCip}>
          <Text style={styles.minCipYazi}>
            {t('yayinciK.minimumKisa', { tutar: UsdYazi(min) })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kap: {
    borderRadius: YaricapTokenlari.lg,
    padding: 15,
    gap: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${RenkTokenlari.primarySoft}33`,
    backgroundColor: RenkTokenlari.bgCard,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baslikKap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  ikonKap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.primarySoft}22`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${RenkTokenlari.primarySoft}44`,
  },
  baslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '900', fontSize: 14 },
  alt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10, marginTop: 1 },
  satir: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  hucre: { flex: 1, minWidth: 0, gap: 3 },
  dikeyCizgi: { width: StyleSheet.hairlineWidth, backgroundColor: RenkTokenlari.border },
  hucreEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  hucreDeger: {
    color: RenkTokenlari.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  hucreAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 9.5 },
  altBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  altBarSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  altBarYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5, flexShrink: 1 },
  minCip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.accent}1F`,
  },
  minCipYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontSize: 9.5, fontWeight: '800' },
});
