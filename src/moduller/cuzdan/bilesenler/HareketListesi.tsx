import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import {
  LedgerAnlasilirOzet,
  LedgerBirimEtiketi,
  type LedgerSatiri,
} from '../okuma/CuzdanLedgeriniGetir';
import type { HediyeGecmisiKaydi } from '../../hediyeler/okuma/HediyeGecmisiniGetir';
import { CanliHediyeSimgesi } from './CanliCoinSimgesi';

/** 12 Eki · 14:05 — hareket listelerinde ortak kısa tarih. */
export function HareketTarihYazi(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function buyukBasHarf(metin: string): string {
  if (!metin) return metin;
  return metin.charAt(0).toLocaleUpperCase() + metin.slice(1);
}

/** "Ekim 2026" — ay grubu başlığı. */
export function AyEtiketi(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    return buyukBasHarf(
      d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    );
  } catch {
    return iso;
  }
}

/** Ay grubu anahtarı: 2026-10 */
export function AyAnahtari(iso: string): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type AyBirimToplami = { birim: string; giris: number; cikis: number };

export type AyGrubu<T> = {
  anahtar: string;
  etiket: string;
  birimler: AyBirimToplami[];
  satirlar: T[];
};

/**
 * Hareketleri ay ay gruplar. Girdi zaten tarihe göre tersten sıralı gelir;
 * grup sırası korunur (en yeni ay önce).
 */
export function AyaGoreGrupla<T>(
  satirlar: T[],
  tarihAl: (s: T) => string,
  locale: string,
  birimAl?: (s: T) => { birim: string; deger: number } | null,
): AyGrubu<T>[] {
  const gruplar = new Map<string, AyGrubu<T>>();
  const toplamlar = new Map<string, Map<string, { giris: number; cikis: number }>>();

  for (const s of satirlar) {
    const iso = tarihAl(s);
    const anahtar = AyAnahtari(iso);
    if (!anahtar) continue;
    let grup = gruplar.get(anahtar);
    if (!grup) {
      grup = { anahtar, etiket: AyEtiketi(iso, locale), birimler: [], satirlar: [] };
      gruplar.set(anahtar, grup);
      toplamlar.set(anahtar, new Map());
    }
    grup.satirlar.push(s);
    const b = birimAl?.(s);
    if (!b) continue;
    const ayMap = toplamlar.get(anahtar);
    if (!ayMap) continue;
    const t = ayMap.get(b.birim) ?? { giris: 0, cikis: 0 };
    if (b.deger >= 0) t.giris += b.deger;
    else t.cikis += Math.abs(b.deger);
    ayMap.set(b.birim, t);
  }

  for (const grup of gruplar.values()) {
    const ayMap = toplamlar.get(grup.anahtar);
    if (!ayMap) continue;
    grup.birimler = [...ayMap.entries()].map(([birim, t]) => ({
      birim,
      giris: t.giris,
      cikis: t.cikis,
    }));
  }

  return [...gruplar.values()];
}

/** Ay başlığı + o ayın giriş/çıkış özeti. */
export function AyBaslikSatiri({
  etiket,
  birimler,
  locale,
}: {
  etiket: string;
  birimler: AyBirimToplami[];
  locale: string;
}) {
  return (
    <View style={styles.ayBaslik}>
      <View style={styles.ayCizgi} />
      <Text style={styles.ayEtiket} numberOfLines={1}>
        {etiket}
      </Text>
      <View style={styles.ayCizgi} />
      {birimler.length ? (
        <View style={styles.ayToplamlar}>
          {birimler.slice(0, 3).map((b) => (
            <Text key={b.birim} style={styles.ayToplam} numberOfLines={1}>
              {b.giris > 0 ? (
                <Text style={{ color: RenkTokenlari.mint }}>
                  +{b.giris.toLocaleString(locale)}
                </Text>
              ) : null}
              {b.giris > 0 && b.cikis > 0 ? ' / ' : null}
              {b.cikis > 0 ? (
                <Text style={{ color: RenkTokenlari.danger }}>
                  −{b.cikis.toLocaleString(locale)}
                </Text>
              ) : null}
              <Text> {LedgerBirimEtiketi(b.birim)}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Cüzdan hareketi satırı. */
export function HareketSatiri({
  row,
  locale,
  onPress,
}: {
  row: LedgerSatiri;
  locale: string;
  onPress?: () => void;
}) {
  const { t } = useCeviri();
  const pozitif = row.delta >= 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.line, pressed && onPress && styles.linePressed]}
    >
      <View
        style={[
          styles.lineIcon,
          {
            backgroundColor: pozitif
              ? 'rgba(61,207,176,0.14)'
              : 'rgba(232,75,106,0.14)',
          },
        ]}
      >
        <Ionicons
          name={pozitif ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={pozitif ? RenkTokenlari.mint : RenkTokenlari.danger}
        />
      </View>
      <View style={styles.lineCopy}>
        <Text style={styles.lineTitle} numberOfLines={2}>
          {LedgerAnlasilirOzet(row)}
        </Text>
        <Text style={styles.lineMeta}>
          {HareketTarihYazi(row.created_at, locale)}
          {' · '}
          {pozitif ? t('cuzdanX.giris') : t('cuzdanX.cikis')}
        </Text>
      </View>
      <Text
        style={[
          styles.lineDelta,
          { color: pozitif ? RenkTokenlari.mint : RenkTokenlari.danger },
        ]}
        numberOfLines={1}
      >
        {pozitif ? '+' : ''}
        {row.delta.toLocaleString(locale)} {LedgerBirimEtiketi(row.currency)}
      </Text>
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.textDim} />
      ) : null}
    </Pressable>
  );
}

/** Hediye geçmişi satırı. */
export function HediyeSatiri({
  kayit,
  locale,
  index = 0,
  onPress,
}: {
  kayit: HediyeGecmisiKaydi;
  locale: string;
  index?: number;
  onPress?: () => void;
}) {
  const { t } = useCeviri();
  const kim =
    kayit.karsi_profil?.display_name ??
    kayit.karsi_profil?.username ??
    t('ortak.kullanici');
  const gonderildi = kayit.yon === 'gonderilen';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.line, pressed && onPress && styles.linePressed]}
    >
      <View style={styles.hediyeIkon}>
        <CanliHediyeSimgesi
          emoji={kayit.gift?.emoji ?? '🎁'}
          size={18}
          delayMs={(index % 6) * 80}
        />
      </View>
      <View style={styles.lineCopy}>
        <Text style={styles.lineTitle} numberOfLines={1}>
          {kayit.gift?.name ?? t('cuzdanX.hediye')}
          {kayit.quantity > 1 ? ` ×${kayit.quantity}` : ''}
        </Text>
        <Text style={styles.lineMeta} numberOfLines={2}>
          {gonderildi ? `→ ${kim}` : `← ${kim}`}
          {kayit.oda?.title ? ` · ${kayit.oda.title}` : ''}
          {` · ${HareketTarihYazi(kayit.created_at, locale)}`}
        </Text>
      </View>
      <View style={styles.lineRight}>
        <Text
          style={[
            styles.lineDelta,
            {
              color: gonderildi ? RenkTokenlari.danger : RenkTokenlari.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {gonderildi
            ? `-${kayit.coins_spent.toLocaleString(locale)}`
            : kayit.coins_spent.toLocaleString(locale)}
        </Text>
        <Text style={styles.lineBirim}>{t('cuzdanY.coin')}</Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={14} color={RenkTokenlari.textDim} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ayBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  ayCizgi: {
    flex: 1,
    minWidth: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  ayEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ayToplamlar: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ayToplam: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    marginBottom: 2,
  },
  linePressed: { opacity: 0.88 },
  lineIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hediyeIkon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
    flexShrink: 0,
  },
  lineCopy: { flex: 1, gap: 1, minWidth: 0 },
  lineTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 17,
  },
  lineMeta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    lineHeight: 13,
  },
  lineRight: { alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  lineDelta: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
    flexShrink: 0,
    fontSize: 13,
  },
  lineBirim: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
  },
});
