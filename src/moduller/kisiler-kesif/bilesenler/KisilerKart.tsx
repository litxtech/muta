/**
 * Kişiler kartı — tam boy fotoğraf üzerine bilgi katmanı + aksiyon şeridi.
 * Tasarım: isim/doğrulanmış, @kullanıcı, ülke, ölçüt satırı, Tanış + arama.
 */

import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { KisilerKesifKarti } from '../tipler';
import { ulkeBayragi, ulkeGorunenAd } from '../utils/KisilerYardimcilar';
import { useCeviri } from '../../../i18n/useCeviri';
import { basHarfler, harfRenkleri } from './KisilerKartYuz';

type Props = {
  kart: KisilerKesifKarti;
  genislik: number;
  showPrices: boolean;
  showOnline: boolean;
  canli?: boolean;
  /** Kapalı aramada da basılabilir — sheet mesaj + bildirim gösterir */
  sesEnabled: boolean;
  videoEnabled: boolean;
  onProfil: (userId: string) => void;
  onMesaj: (userId: string) => void;
  onSesli: (userId: string) => void;
  onGoruntulu: (userId: string) => void;
};

function KisilerKartIc({
  kart,
  genislik,
  showPrices,
  showOnline,
  canli = false,
  sesEnabled,
  videoEnabled,
  onProfil,
  onMesaj,
  onSesli,
  onGoruntulu,
}: Props) {
  const { t } = useCeviri();
  const bayrak = ulkeBayragi(kart.public_country_code);
  const ulkeAdi = kart.public_country_code
    ? ulkeGorunenAd(kart.public_country_code)
    : null;
  const isim = kart.display_name?.trim() || kart.username || t('ortak.kullanici');
  const kullanici = kart.username ?? '—';
  const sesCoin = coinTamSayi(kart.voice_price);
  const gorCoin = coinTamSayi(kart.video_price);
  const seviye = coinTamSayi(kart.level);
  const fiyatVar = showPrices && (sesCoin != null || gorCoin != null);

  return (
    <View style={[styles.kart, { width: genislik }]}>
      <Pressable
        onPress={() => onProfil(kart.user_id)}
        accessibilityRole="button"
        accessibilityLabel={t('kisilerX.profilA11y', { isim })}
        style={styles.kok}
      >
        {kart.avatar_url ? (
          <Image
            source={{ uri: kart.avatar_url }}
            style={styles.foto}
            resizeMode="cover"
            accessibilityLabel={isim}
          />
        ) : (
          <LinearGradient
            colors={harfRenkleri(kart.user_id)}
            style={styles.fotoBos}
            accessibilityLabel={t('kisilerX.profilA11y', { isim })}
          >
            <Text style={styles.harf}>{basHarfler(isim)}</Text>
          </LinearGradient>
        )}

        <LinearGradient
          colors={[...RenkTokenlari.overlayGradient]}
          locations={[0, 0.52, 1]}
          style={styles.grad}
          pointerEvents="none"
        />

        {canli ? (
          <View style={styles.canliRozet} accessibilityLabel={t('kisiler.canliRozet')}>
            <View style={styles.canliNokta} />
            <Text style={styles.canliYazi}>{t('kisiler.canliRozet')}</Text>
          </View>
        ) : showOnline && kart.online_display ? (
          <View style={styles.online} accessibilityLabel={t('kisilerX.cevrimici')} />
        ) : null}

        <View style={styles.icerik}>
          <View style={styles.bilgi}>
            <View style={styles.isimSatir}>
              <Text style={styles.isim} numberOfLines={1}>
                {isim}
              </Text>
              {kart.is_verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={RenkTokenlari.primarySoft}
                />
              ) : null}
            </View>

            <Text style={styles.kullanici} numberOfLines={1}>
              @{kullanici}
            </Text>

            {ulkeAdi ? (
              <View style={styles.ulkeSatir}>
                {bayrak ? <Text style={styles.bayrak}>{bayrak}</Text> : null}
                <Text style={styles.ulke} numberOfLines={1}>
                  {ulkeAdi}
                </Text>
              </View>
            ) : null}

            {seviye != null || fiyatVar ? (
              <View
                style={styles.olcutSatir}
                accessibilityLabel={[
                  seviye != null ? t('kisilerX.seviye', { n: seviye }) : null,
                  sesCoin != null ? t('kisilerX.coinDk', { n: sesCoin }) : null,
                  gorCoin != null ? t('kisilerX.coinDk', { n: gorCoin }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                {seviye != null ? (
                  <Olcut icon="person" metin={String(seviye)} />
                ) : null}
                {seviye != null && fiyatVar ? <View style={styles.ayrac} /> : null}
                {fiyatVar && sesCoin != null ? (
                  <Olcut icon="call" metin={String(sesCoin)} />
                ) : null}
                {fiyatVar && sesCoin != null && gorCoin != null ? (
                  <View style={styles.ayrac} />
                ) : null}
                {fiyatVar && gorCoin != null ? (
                  <Olcut icon="videocam" metin={String(gorCoin)} />
                ) : null}
              </View>
            ) : null}
          </View>

        </View>
      </Pressable>

      {/* Aksiyonlar profil Pressable'ının dışında: web'de tıklama sızmasın. */}
      <View style={styles.aksiyonKatman}>
        <Pressable
          onPress={kart.message_enabled ? () => onMesaj(kart.user_id) : undefined}
          disabled={!kart.message_enabled}
          accessibilityRole="button"
          accessibilityLabel={t('kisiler.tanis')}
          accessibilityState={{ disabled: !kart.message_enabled }}
          hitSlop={BoslukTokenlari.xs}
          style={({ pressed }) => [
            styles.tanisKabuk,
            { opacity: kart.message_enabled ? (pressed ? 0.72 : 1) : 0.4 },
          ]}
        >
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tanis}
          >
            <Text style={styles.tanisYazi} numberOfLines={1}>
              {t('kisiler.tanis')}
            </Text>
          </LinearGradient>
        </Pressable>

        <YuvarlakAksiyon
          icon="call"
          label={t('kisilerX.sesliAra')}
          enabled={sesEnabled}
          onPress={() => onSesli(kart.user_id)}
        />
        <YuvarlakAksiyon
          icon="videocam"
          label={t('kisilerX.goruntuluAra')}
          enabled={videoEnabled}
          onPress={() => onGoruntulu(kart.user_id)}
        />
      </View>
    </View>
  );
}

function coinTamSayi(deger: number | null): number | null {
  if (deger == null) return null;
  const n = Number(deger);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function Olcut({
  icon,
  metin,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  metin: string;
}) {
  return (
    <View style={styles.olcut}>
      <Ionicons name={icon} size={11} color={RenkTokenlari.primarySoft} />
      <Text style={styles.olcutYazi} numberOfLines={1}>
        {metin}
      </Text>
    </View>
  );
}

function YuvarlakAksiyon({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={BoslukTokenlari.xs}
      style={({ pressed }) => [
        styles.yuvarlakKabuk,
        { opacity: enabled ? (pressed ? 0.72 : 1) : 0.4 },
      ]}
    >
      <LinearGradient
        colors={[...RenkTokenlari.gradientPrimary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.yuvarlakHalka}
      >
        <View style={styles.yuvarlakIc}>
          <Ionicons name={icon} size={15} color={RenkTokenlari.textOnOverlay} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export const KisilerKart = memo(KisilerKartIc);

const YUVARLAK = 34;

const styles = StyleSheet.create({
  kart: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  kok: {
    aspectRatio: 0.68,
    justifyContent: 'flex-end',
  },
  foto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  fotoBos: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: RenkTokenlari.textOnOverlay,
  },
  grad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  canliRozet: {
    position: 'absolute',
    top: BoslukTokenlari.sm,
    left: BoslukTokenlari.sm,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.scrim,
  },
  canliNokta: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RenkTokenlari.magenta,
  },
  canliYazi: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: RenkTokenlari.textOnOverlay,
  },
  online: {
    position: 'absolute',
    top: BoslukTokenlari.sm,
    right: BoslukTokenlari.sm,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RenkTokenlari.mint,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.textOnOverlay,
    zIndex: 2,
  },
  icerik: {
    padding: BoslukTokenlari.md - 2,
    // Alt aksiyon katmanı için ayrılan alan (34 buton + 10 boşluk + 8 nefes)
    paddingBottom: 52,
  },
  bilgi: {
    gap: 1,
  },
  isimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.xs,
  },
  isim: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: RenkTokenlari.textOnOverlay,
    flexShrink: 1,
  },
  kullanici: {
    ...TipografiTokenlari.micro,
    fontWeight: '500',
    letterSpacing: 0,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.82,
  },
  ulkeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bayrak: {
    fontSize: 12,
    lineHeight: 15,
  },
  ulke: {
    ...TipografiTokenlari.micro,
    fontWeight: '600',
    letterSpacing: 0,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.88,
    flexShrink: 1,
  },
  olcutSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  olcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  olcutYazi: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: RenkTokenlari.textOnOverlay,
  },
  ayrac: {
    width: StyleSheet.hairlineWidth,
    height: 11,
    backgroundColor: RenkTokenlari.textOnOverlay,
    opacity: 0.35,
  },
  aksiyonKatman: {
    position: 'absolute',
    left: BoslukTokenlari.md - 2,
    right: BoslukTokenlari.md - 2,
    bottom: BoslukTokenlari.md - 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tanisKabuk: {
    flex: 1,
    minWidth: 0,
  },
  tanis: {
    minHeight: 34,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BoslukTokenlari.sm,
  },
  tanisYazi: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: RenkTokenlari.textOnPrimary,
  },
  yuvarlakKabuk: {
    width: YUVARLAK,
    height: YUVARLAK,
  },
  yuvarlakHalka: {
    width: YUVARLAK,
    height: YUVARLAK,
    borderRadius: YUVARLAK / 2,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yuvarlakIc: {
    width: '100%',
    height: '100%',
    borderRadius: (YUVARLAK - 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.scrim,
  },
});
