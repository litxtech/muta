/**
 * Kişiler kartı — fotoğraf NET, alt aksiyonlar frosted glass.
 */

import React, { memo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { KisilerKesifKarti } from '../tipler';
import { ulkeBayragi } from '../utils/KisilerYardimcilar';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  kart: KisilerKesifKarti;
  showPrices: boolean;
  showOnline: boolean;
  /** Kapalı aramada da basılabilir — sheet mesaj + bildirim gösterir */
  sesEnabled: boolean;
  videoEnabled: boolean;
  onProfil: () => void;
  onMesaj: () => void;
  onSesli: () => void;
  onGoruntulu: () => void;
};

function KisilerKartIc({
  kart,
  showPrices,
  showOnline,
  sesEnabled,
  videoEnabled,
  onProfil,
  onMesaj,
  onSesli,
  onGoruntulu,
}: Props) {
  const { t } = useCeviri();
  const { width } = useWindowDimensions();
  const gap = BoslukTokenlari.md;
  const pad = BoslukTokenlari.lg;
  const cardW = Math.floor((width - pad * 2 - gap) / 2);
  const bayrak = ulkeBayragi(kart.public_country_code);
  const isim = kart.display_name?.trim() || kart.username || t('ortak.kullanici');

  return (
    <View style={[styles.kart, { width: cardW }]}>
      <Pressable
        onPress={onProfil}
        accessibilityRole="button"
        accessibilityLabel={t('kisilerX.profilA11y', { isim })}
        style={styles.fotoWrap}
      >
        {kart.avatar_url ? (
          <Image
            source={{ uri: kart.avatar_url }}
            style={styles.foto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.foto, styles.fotoBos]}>
            <Ionicons name="person" size={40} color={RenkTokenlari.textMuted} />
          </View>
        )}

        {showOnline && kart.online_display ? (
          <View style={styles.online} accessibilityLabel={t('kisilerX.cevrimici')} />
        ) : null}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.grad}
        />

        <View style={styles.meta}>
          <View style={styles.isimSatir}>
            <Text style={styles.isim} numberOfLines={1}>
              {isim}
            </Text>
            {kart.is_verified ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={RenkTokenlari.mint}
              />
            ) : null}
            {bayrak ? <Text style={styles.bayrak}>{bayrak}</Text> : null}
          </View>
          <Text style={styles.alt} numberOfLines={1}>
            @{kart.username ?? '—'}
            {kart.level != null ? ` · Lv.${kart.level}` : ''}
          </Text>
          {showPrices && (kart.voice_price != null || kart.video_price != null) ? (
            <View style={styles.fiyatSatir}>
              {kart.voice_price != null ? (
                <Text style={styles.fiyat}>
                  <Ionicons name="call" size={10} color={RenkTokenlari.mint} />{' '}
                  {kart.voice_price} /dk
                </Text>
              ) : null}
              {kart.video_price != null ? (
                <Text style={styles.fiyat}>
                  <Ionicons name="videocam" size={10} color={RenkTokenlari.primarySoft} />{' '}
                  {kart.video_price} /dk
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.aksiyonWrap}>
        <CamArkaplan intensity={36} hafif style={StyleSheet.absoluteFill} />
        <View style={styles.aksiyonlar}>
          <Aksiyon
            icon="chatbubble"
            label={t('kisilerX.mesaj')}
            enabled={kart.message_enabled}
            onPress={onMesaj}
            tint={RenkTokenlari.primarySoft}
          />
          <Aksiyon
            icon="call"
            label={t('kisilerX.sesliAra')}
            enabled={sesEnabled}
            onPress={onSesli}
            tint={RenkTokenlari.mint}
          />
          <Aksiyon
            icon="videocam"
            label={t('kisilerX.goruntuluAra')}
            enabled={videoEnabled}
            onPress={onGoruntulu}
            tint={RenkTokenlari.magenta}
          />
        </View>
      </View>
    </View>
  );
}

function Aksiyon({
  icon,
  label,
  enabled,
  onPress,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  enabled: boolean;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: `${tint}55`, opacity: enabled ? (pressed ? 0.7 : 1) : 0.35 },
      ]}
    >
      <Ionicons name={icon} size={16} color={tint} />
    </Pressable>
  );
}

export const KisilerKart = memo(KisilerKartIc);

const styles = StyleSheet.create({
  kart: {
    borderRadius: YaricapTokenlari.xl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  fotoWrap: {
    aspectRatio: 0.72,
  },
  foto: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  fotoBos: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.bgCard,
  },
  online: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RenkTokenlari.mint,
    borderWidth: 1.5,
    borderColor: '#000',
    zIndex: 2,
  },
  grad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
  },
  meta: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 2,
  },
  isimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  isim: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '700',
    flexShrink: 1,
    fontSize: 14,
  },
  bayrak: {
    fontSize: 12,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
  },
  fiyatSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  fiyat: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
  },
  aksiyonWrap: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  aksiyonlar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
