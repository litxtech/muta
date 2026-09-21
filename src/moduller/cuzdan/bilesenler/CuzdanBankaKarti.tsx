import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CanliCoinSimgesi } from './CanliCoinSimgesi';
import { CoinDegerOzetiPaneli } from './CoinDegerOzetiPaneli';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  GolgeTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';


type Props = {
  coins: number;
  diamonds: number;
  hesapKodu?: string | null;
  /** 18 haneli MUTA PAY cüzdan no */
  cuzdanNo?: string | null;
  cuzdanMarka?: string | null;
  /** Marka altı — Dijital cüzdan */
  kartTipi?: string | null;
  /** Marka / tip altına kısa açıklama */
  markaTagline?: string | null;
  markaTaglineGorunur?: boolean;
  sahipAdi?: string | null;
  yuklenen?: number;
  harcanan?: number;
  /** Katalog özeti görünürlük / metinler */
  degerOzeti?: Partial<import('../ui-config/CuzdanUiTipleri').CuzdanUiValueSummary> | null;
  /** QR okutma (kamera) — opsiyonel */
  onQrOku?: () => void;
  /** Uygulama içi cüzdan kartı paylaş */
  onPaylas?: () => void;
  /** WhatsApp ile QR’lı paylaş */
  onWhatsAppPaylas?: () => void;
};

function formatBakiye(n: number): string {
  return n.toLocaleString('tr-TR');
}

function maskeHesap(kod?: string | null): string {
  const temiz = (kod ?? '').replace(/\D/g, '');
  if (temiz.length >= 18) {
    return temiz.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }
  const pad = temiz.padStart(8, '0').slice(-8);
  return `${pad.slice(0, 4)}  ${pad.slice(4)}`;
}

async function panoyaKopyala(metin: string, baslik: string) {
  try {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(metin);
    Alert.alert('Kopyalandı', `${baslik}\n${metin}`);
  } catch {
    Alert.alert('Kopyala', 'Panoya yazılamadı.');
  }
}

/** Premium banka kartı — MUTA PAY cüzdan yüzü */
export function CuzdanBankaKarti({
  coins,
  diamonds,
  hesapKodu,
  cuzdanNo,
  cuzdanMarka,
  kartTipi,
  markaTagline,
  markaTaglineGorunur = true,
  sahipAdi,
  yuklenen = 0,
  harcanan = 0,
  degerOzeti,
  onQrOku,
  onPaylas,
  onWhatsAppPaylas,
}: Props) {
  const hamNo = (cuzdanNo ?? '').replace(/\D/g, '');
  const gosterilen = maskeHesap(cuzdanNo || hesapKodu);
  const kopyalanabilir = hamNo.length >= 18;
  const paylasilabilir = kopyalanabilir && (!!onPaylas || !!onWhatsAppPaylas);
  const tip = (kartTipi ?? '').trim() || 'Dijital cüzdan';
  const tagline = (markaTagline ?? '').trim();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[...RenkTokenlari.gradientCard]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.kart}
      >
        <View style={styles.parlamaUst} pointerEvents="none" />
        <View style={styles.parlamaAlt} pointerEvents="none" />

        <View style={styles.ust}>
          <View style={styles.markaBlok}>
            <Text style={styles.marka}>{cuzdanMarka || 'MUTA PAY'}</Text>
            <Text style={styles.kartTip}>{tip}</Text>
            {markaTaglineGorunur && tagline ? (
              <Text style={styles.tagline} numberOfLines={3}>
                {tagline}
              </Text>
            ) : null}
          </View>
          <View style={styles.chipWrap}>
            <LinearGradient
              colors={[...RenkTokenlari.gradientGold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.chip}
            >
              <View style={styles.chipCizgi} />
              <View style={[styles.chipCizgi, { top: 14 }]} />
            </LinearGradient>
            <Ionicons
              name="wifi"
              size={16}
              color={RenkTokenlari.textDim}
              style={styles.nfc}
            />
          </View>
        </View>

        <View style={styles.hesapSatir}>
          <Text style={styles.hesapNo} numberOfLines={1}>
            {gosterilen}
          </Text>
          {kopyalanabilir ? (
            <Pressable
              style={styles.ikonBtn}
              onPress={() => void panoyaKopyala(hamNo, 'Cüzdan no')}
              hitSlop={8}
              accessibilityLabel="Cüzdan numarasını kopyala"
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color={RenkTokenlari.accent}
              />
            </Pressable>
          ) : null}
          {onQrOku ? (
            <Pressable
              style={styles.ikonBtn}
              onPress={onQrOku}
              hitSlop={8}
              accessibilityLabel="QR oku"
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={RenkTokenlari.accent}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.bakiyeSatir}>
          <View style={styles.bakiyeKart}>
            <View style={styles.etiketSatir}>
              <CanliCoinSimgesi size={22} seviye={0.4} />
              <Text style={styles.etiket}>Coin</Text>
            </View>
            <Text style={styles.tutar} numberOfLines={1}>
              {formatBakiye(coins)}
            </Text>
          </View>
          <View style={styles.bakiyeKart}>
            <View style={styles.etiketSatir}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientDiamond]}
                style={styles.elmasIkon}
              >
                <Ionicons name="diamond" size={11} color={RenkTokenlari.textOnPrimary} />
              </LinearGradient>
              <Text style={styles.etiket}>Elmas</Text>
            </View>
            <Text style={styles.tutar} numberOfLines={1}>
              {formatBakiye(diamonds)}
            </Text>
          </View>
        </View>

        {coins > 0 ? (
          <CoinDegerOzetiPaneli coins={coins} kompakt ozet={degerOzeti} />
        ) : null}

        <View style={styles.alt}>
          <View style={styles.altSol}>
            <Text style={styles.altEtiket}>Hesap sahibi</Text>
            <Text style={styles.altDeger} numberOfLines={1}>
              {(sahipAdi ?? 'Üye').toUpperCase()}
            </Text>
          </View>
          <View style={styles.altSag}>
            <Text style={styles.altEtiket}>Yükleme / harcama</Text>
            <Text style={styles.altDegerMini}>
              +{formatBakiye(yuklenen)}  ·  −{formatBakiye(harcanan)}
            </Text>
          </View>
        </View>

        {paylasilabilir ? (
          <View style={styles.paylasSatir}>
            {onPaylas ? (
              <Pressable
                style={styles.paylasBtn}
                onPress={onPaylas}
                accessibilityLabel="Cüzdan kartını uygulama içi paylaş"
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={RenkTokenlari.accent}
                />
                <Text style={styles.paylasYazi}>Kartı paylaş</Text>
              </Pressable>
            ) : null}
            {onWhatsAppPaylas ? (
              <Pressable
                style={[styles.paylasBtn, styles.paylasWa]}
                onPress={onWhatsAppPaylas}
                accessibilityLabel="WhatsApp ile QR paylaş"
              >
                <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                <Text style={[styles.paylasYazi, styles.paylasWaYazi]}>
                  WhatsApp
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.xl,
    ...GolgeTokenlari.soft,
  },
  kart: {
    borderRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.lg + 4,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.22)',
    minHeight: 228,
    overflow: 'hidden',
    gap: BoslukTokenlari.lg,
  },
  parlamaUst: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(232, 64, 145, 0.18)',
  },
  parlamaAlt: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  markaBlok: { gap: 3 },
  marka: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    letterSpacing: 2.8,
    fontWeight: '800',
    fontSize: 11,
  },
  kartTip: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11,
  },
  tagline: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
    maxWidth: 220,
  },
  chipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    width: 44,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chipCizgi: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.18)',
    top: 8,
  },
  nfc: {
    transform: [{ rotate: '90deg' }],
  },
  hesapSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hesapNo: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    letterSpacing: 3.2,
    fontWeight: '600',
    fontSize: 15,
    opacity: 0.92,
    flex: 1,
    minWidth: 0,
  },
  ikonBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.35)',
  },
  bakiyeSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  bakiyeKart: {
    flex: 1,
    gap: 8,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  etiketSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  elmasIkon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tutar: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 24,
    letterSpacing: -0.6,
    fontWeight: '800',
  },
  alt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: BoslukTokenlari.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.divider,
    paddingTop: BoslukTokenlari.md,
  },
  altSol: { flex: 1, minWidth: 0 },
  altSag: { alignItems: 'flex-end', flexShrink: 0 },
  altEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    letterSpacing: 0.9,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  altDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  altDegerMini: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
    fontSize: 11,
  },
  paylasSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    marginTop: -4,
  },
  paylasBtn: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.35)',
    backgroundColor: RenkTokenlari.pressFill,
    paddingHorizontal: BoslukTokenlari.sm,
  },
  paylasWa: {
    borderColor: 'rgba(37, 211, 102, 0.45)',
  },
  paylasYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  paylasWaYazi: {
    color: '#25D366',
  },
});
