/**
 * Tamuso Verify — akış içinde paylaşılan küçük arayüz parçaları.
 * Tasarım dili mevcut Tamuso tokenlarını kullanır; rastgele HEX yok.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { durumBaslikAnahtari } from '../HataCeviri';
import type { VerifyDurumKodu } from '../tipler';

/* ------------------------------------------------------------------ */
/* Aşama göstergesi                                                    */
/* ------------------------------------------------------------------ */

export function AdimGostergesi({ aktif }: { aktif: number }) {
  const { t } = useCeviri();
  const etiketler = [
    t('verify.adim1'),
    t('verify.adim2'),
    t('verify.adim3'),
    t('verify.adim4'),
    t('verify.adim5'),
  ];
  return (
    <View style={styles.adimKap}>
      <View style={styles.adimCizgiKap}>
        {etiketler.map((_, i) => {
          const sira = i + 1;
          const gecti = sira < aktif;
          const suan = sira === aktif;
          return (
            <View key={`c-${sira}`} style={styles.adimCizgiHucre}>
              <View
                style={[
                  styles.adimNokta,
                  gecti && styles.adimNoktaGecti,
                  suan && styles.adimNoktaSuan,
                ]}
              >
                {gecti ? (
                  <Ionicons name="checkmark" size={11} color={RenkTokenlari.bg} />
                ) : (
                  <Text
                    style={[
                      styles.adimNoktaYazi,
                      suan && styles.adimNoktaYaziSuan,
                    ]}
                  >
                    {sira}
                  </Text>
                )}
              </View>
              {sira < etiketler.length ? (
                <View style={[styles.adimCubuk, gecti && styles.adimCubukGecti]} />
              ) : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.adimEtiket} numberOfLines={1}>
        {etiketler[Math.min(Math.max(aktif, 1), etiketler.length) - 1]}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Durum rozeti                                                        */
/* ------------------------------------------------------------------ */

function durumRengi(durum: VerifyDurumKodu): string {
  switch (durum) {
    case 'approved':
      return RenkTokenlari.mint;
    case 'rejected':
      return RenkTokenlari.danger;
    case 'under_review':
    case 'appeal_review':
      return RenkTokenlari.violet;
    case 'additional_verification':
      return RenkTokenlari.warning;
    case 'awaiting_document':
    case 'awaiting_selfie':
      return RenkTokenlari.accent;
    default:
      return RenkTokenlari.textMuted;
  }
}

function durumIkonu(durum: VerifyDurumKodu): React.ComponentProps<typeof Ionicons>['name'] {
  switch (durum) {
    case 'approved':
      return 'shield-checkmark';
    case 'rejected':
      return 'close-circle';
    case 'under_review':
    case 'appeal_review':
      return 'time-outline';
    case 'additional_verification':
      return 'alert-circle-outline';
    case 'awaiting_document':
      return 'document-text-outline';
    case 'awaiting_selfie':
      return 'camera-outline';
    case 'in_progress':
      return 'ellipsis-horizontal-circle-outline';
    default:
      return 'shield-outline';
  }
}

export function DurumRozeti({
  durum,
  buyuk = false,
}: {
  durum: VerifyDurumKodu;
  buyuk?: boolean;
}) {
  const { t } = useCeviri();
  const renk = durumRengi(durum);
  return (
    <View
      style={[
        styles.rozet,
        { backgroundColor: `${renk}1F`, borderColor: `${renk}55` },
        buyuk && styles.rozetBuyuk,
      ]}
    >
      <Ionicons name={durumIkonu(durum)} size={buyuk ? 14 : 11} color={renk} />
      <Text style={[styles.rozetYazi, { color: renk }, buyuk && styles.rozetYaziBuyuk]}>
        {t(durumBaslikAnahtari(durum))}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bilgi kutusu                                                        */
/* ------------------------------------------------------------------ */

export function BilgiKutusu({
  ikon,
  baslik,
  metin,
  ton = 'notr',
}: {
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  baslik?: string;
  metin?: string;
  ton?: 'notr' | 'uyari' | 'hata' | 'basari';
}) {
  const renk =
    ton === 'uyari'
      ? RenkTokenlari.warning
      : ton === 'hata'
        ? RenkTokenlari.danger
        : ton === 'basari'
          ? RenkTokenlari.mint
          : RenkTokenlari.accent;
  return (
    <View style={[styles.bilgi, { borderColor: `${renk}3D`, backgroundColor: `${renk}12` }]}>
      <Ionicons name={ikon} size={16} color={renk} style={styles.bilgiIkon} />
      <View style={{ flex: 1, gap: 2 }}>
        {baslik ? <Text style={[styles.bilgiBaslik, { color: renk }]}>{baslik}</Text> : null}
        {metin ? <Text style={styles.bilgiMetin}>{metin}</Text> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Butonlar                                                            */
/* ------------------------------------------------------------------ */

export function BirincilDugme({
  etiket,
  onPress,
  yukleniyor = false,
  devreDisi = false,
  ikon,
  stil,
}: {
  etiket: string;
  onPress: () => void;
  yukleniyor?: boolean;
  devreDisi?: boolean;
  ikon?: React.ComponentProps<typeof Ionicons>['name'];
  stil?: StyleProp<ViewStyle>;
}) {
  const kilit = devreDisi || yukleniyor;
  return (
    <Pressable
      onPress={onPress}
      disabled={kilit}
      accessibilityRole="button"
      accessibilityState={{ disabled: kilit, busy: yukleniyor }}
      style={({ pressed }) => [styles.btnKap, stil, (kilit || pressed) && styles.btnBasik]}
    >
      <LinearGradient
        colors={[RenkTokenlari.primarySoft, RenkTokenlari.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btnZemin}
      >
        {yukleniyor ? (
          <ActivityIndicator color={RenkTokenlari.textOnPrimary} />
        ) : (
          <>
            {ikon ? (
              <Ionicons name={ikon} size={17} color={RenkTokenlari.textOnPrimary} />
            ) : null}
            <Text style={styles.btnYazi}>{etiket}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function IkincilDugme({
  etiket,
  onPress,
  ikon,
  devreDisi = false,
}: {
  etiket: string;
  onPress: () => void;
  ikon?: React.ComponentProps<typeof Ionicons>['name'];
  devreDisi?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={devreDisi}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.ikincil,
        devreDisi && { opacity: 0.45 },
        pressed && styles.btnBasik,
      ]}
    >
      {ikon ? <Ionicons name={ikon} size={16} color={RenkTokenlari.text} /> : null}
      <Text style={styles.ikincilYazi}>{etiket}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Onay kutusu                                                         */
/* ------------------------------------------------------------------ */

export function OnayKutusu({
  secili,
  onDegistir,
  metin,
}: {
  secili: boolean;
  onDegistir: (yeni: boolean) => void;
  metin: string;
}) {
  return (
    <Pressable
      onPress={() => onDegistir(!secili)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: secili }}
      style={styles.onaySatir}
    >
      <View style={[styles.onayKutu, secili && styles.onayKutuSecili]}>
        {secili ? (
          <Ionicons name="checkmark" size={13} color={RenkTokenlari.bg} />
        ) : null}
      </View>
      <Text style={styles.onayMetin}>{metin}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Belge çerçevesi                                                     */
/* ------------------------------------------------------------------ */

/** Kart oranına yakın (1.586) köşe çerçevesi — belgeyi hizalamak için. */
export function BelgeCercevesi({ etkin = true }: { etkin?: boolean }) {
  const renk = etkin ? RenkTokenlari.accent : RenkTokenlari.textDim;
  const kose = (stil: StyleProp<ViewStyle>, key: string) => (
    <View key={key} style={[styles.kose, { borderColor: renk }, stil]} />
  );
  return (
    <View pointerEvents="none" style={styles.cerceveKap}>
      <View style={[styles.cerceveIc, { borderColor: `${renk}55` }]}>
        {kose(styles.koseSolUst, 'su')}
        {kose(styles.koseSagUst, 'sa')}
        {kose(styles.koseSolAlt, 'au')}
        {kose(styles.koseSagAlt, 'aa')}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Yüz (oval) çerçevesi                                                */
/* ------------------------------------------------------------------ */

export function YuzCercevesi({ durum }: { durum: 'bekliyor' | 'hazir' | 'tarama' }) {
  const renk =
    durum === 'hazir'
      ? RenkTokenlari.mint
      : durum === 'tarama'
        ? RenkTokenlari.accent
        : `${RenkTokenlari.textOnOverlay}AA`;
  return (
    <View pointerEvents="none" style={styles.yuzKap}>
      <View style={[styles.yuzOval, { borderColor: renk }]} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bölüm başlığı                                                       */
/* ------------------------------------------------------------------ */

export function Bolum({
  baslik,
  yan,
}: {
  baslik: string;
  yan?: React.ReactNode;
}) {
  return (
    <View style={styles.bolumSatir}>
      <Text style={styles.bolumYazi}>{baslik}</Text>
      {yan}
    </View>
  );
}

const styles = StyleSheet.create({
  adimKap: { gap: 6, marginBottom: BoslukTokenlari.md },
  adimCizgiKap: { flexDirection: 'row', alignItems: 'center' },
  adimCizgiHucre: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  adimNokta: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  adimNoktaGecti: {
    backgroundColor: RenkTokenlari.accent,
    borderColor: RenkTokenlari.accent,
  },
  adimNoktaSuan: {
    borderColor: RenkTokenlari.accent,
    backgroundColor: `${RenkTokenlari.accent}26`,
  },
  adimNoktaYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 10,
    color: RenkTokenlari.textDim,
  },
  adimNoktaYaziSuan: { color: RenkTokenlari.accent, fontWeight: '800' },
  adimCubuk: {
    flex: 1,
    height: 2,
    marginHorizontal: 3,
    backgroundColor: RenkTokenlari.divider,
    borderRadius: 1,
  },
  adimCubukGecti: { backgroundColor: RenkTokenlari.accent },
  adimEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.2,
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  rozetBuyuk: { paddingHorizontal: 11, paddingVertical: 5, gap: 6 },
  rozetYazi: { ...TipografiTokenlari.micro, fontSize: 9.5, fontWeight: '800' },
  rozetYaziBuyuk: { fontSize: 11.5 },
  bilgi: {
    flexDirection: 'row',
    gap: 9,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
  },
  bilgiIkon: { marginTop: 1 },
  bilgiBaslik: { ...TipografiTokenlari.caption, fontWeight: '800', fontSize: 12.5 },
  bilgiMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  btnKap: { borderRadius: YaricapTokenlari.pill, overflow: 'hidden' },
  btnZemin: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: BoslukTokenlari.lg,
    minHeight: 48,
  },
  btnBasik: { opacity: 0.75 },
  btnYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  ikincil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  ikincilYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  onaySatir: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  onayKutu: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  onayKutuSecili: {
    backgroundColor: RenkTokenlari.accent,
    borderColor: RenkTokenlari.accent,
  },
  onayMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  cerceveKap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cerceveIc: {
    width: '86%',
    aspectRatio: 1.586,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
  },
  kose: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderWidth: 3,
  },
  koseSolUst: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  koseSagUst: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  koseSolAlt: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  koseSagAlt: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  yuzKap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  yuzOval: {
    width: '62%',
    aspectRatio: 0.74,
    borderRadius: 999,
    borderWidth: 2.5,
    marginTop: -18,
  },
  bolumSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: BoslukTokenlari.sm,
  },
  bolumYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    fontSize: 12.5,
  },
});
