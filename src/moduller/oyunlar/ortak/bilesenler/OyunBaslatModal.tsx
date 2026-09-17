/**
 * Ses odası oyun seçim kartı — poster kart + OYNA.
 * Kabuk (aşağıdan kayma) OyunOdaAltKart'tadır; burada Modal yok.
 */

import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { GAME_DISPLAY_NAME as KASKAD_NAME } from '../../kaskad/sabitler/KaskadSabitleri';
import {
  BackgroundImages as KaskadBg,
  CharacterImages as KaskadCharacter,
} from '../../kaskad/assets/VisualAssets';
import { GAME_DISPLAY_NAME as ZEUS_NAME } from '../../zeus/config/ZeusSabitleri';
import {
  CharacterImages as ZeusCharacterImages,
  UiImages as ZeusUi,
} from '../../zeus/assets/VisualAssets';
import { GAME_DISPLAY_NAME as NOX_NAME } from '../../slot/sabitler/SlotAyarlari';
import {
  SymbolImages as NoxSymbols,
  UiImages as NoxUi,
} from '../../slot/assets/VisualAssets';
import type { GameCode } from '../tipler/OyunTipleri';
import { OyunAuraCerceve } from './OyunAuraCerceve';

type Props = {
  visible: boolean;
  onClose: () => void;
  onBaslatKaskad?: () => void;
  onBaslatZeus?: () => void;
  onBaslatNox?: () => void;
  /** Admin'de açık oyun kodları — kapalı olanlar hiç render edilmez. */
  visibleGameCodes?: readonly GameCode[];
};

export function OyunBaslatModal({
  visible,
  onClose,
  onBaslatKaskad,
  onBaslatZeus,
  onBaslatNox,
  visibleGameCodes,
}: Props) {
  const showKaskad =
    visibleGameCodes == null ? true : visibleGameCodes.includes('kozmik_kaskad');
  const showZeus =
    visibleGameCodes == null ? true : visibleGameCodes.includes('zeus');
  const showNox =
    visibleGameCodes == null ? true : visibleGameCodes.includes('nox_reels');
  const hicYok = !showKaskad && !showZeus && !showNox;

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikMetin}>
          <Text style={styles.eyebrow}>TAMUSO</Text>
          <Text style={styles.heading}>Oyunlar</Text>
        </View>
        <Pressable
          onPress={onClose}
          style={styles.kapatBtn}
          accessibilityLabel="Kapat"
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color="#F7F2E8" />
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Üstteki oda açık kalır. Kart dock’un üstüne biner; koltuklar yerinde durur.
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.liste}
      >
        {hicYok ? (
          <View style={styles.bosKart}>
            <Text style={styles.bosBaslik}>Şu an açık oyun yok</Text>
            <Text style={styles.bosGovde}>
              Oyunlar admin panelinden kapatılmış. Daha sonra tekrar dene.
            </Text>
          </View>
        ) : null}

        {showNox ? (
          <OyunPosterKart
            cover={NoxUi.cover}
            avatar={NoxSymbols.SCATTER}
            tint={['#12081F', '#7C3AED'] as const}
            eyebrow="NIGHT SLOT"
            title={NOX_NAME}
            body="5×3 payline · wild · scatter bonus · sunucu sonucu"
            meta="Solo · sunucu sonucu"
            ctaDisabled={!onBaslatNox}
            onPress={() => onBaslatNox?.()}
          />
        ) : null}

        {showZeus ? (
          <OyunPosterKart
            cover={ZeusUi.cover}
            avatar={ZeusCharacterImages.zeusIdle}
            tint={['#3A2208', '#C9A24A'] as const}
            eyebrow="OLYMPUS"
            title={ZEUS_NAME}
            body="6×5 cascade · 4 Zeus = 15 ücretsiz tur · çarpan küreleri"
            meta="Solo · sunucu sonucu"
            ctaDisabled={!onBaslatZeus}
            onPress={() => onBaslatZeus?.()}
          />
        ) : null}

        {showKaskad ? (
          <OyunPosterKart
            cover={KaskadBg.stormSky}
            avatar={KaskadCharacter.stormKeeper}
            tint={['#1A0A3E', '#7C5CFF'] as const}
            eyebrow="KOZMİK KASKAD"
            title={KASKAD_NAME}
            body="6×5 cascade · portal scatter · çarpan küreleri · bonus turlar"
            meta="Solo · sunucu sonucu"
            ctaDisabled={!onBaslatKaskad}
            onPress={() => onBaslatKaskad?.()}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

type PosterProps = {
  cover: ImageSourcePropType;
  avatar: ImageSourcePropType;
  tint: readonly [string, string];
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  ctaDisabled: boolean;
  onPress: () => void;
};

function OyunPosterKart({
  cover,
  avatar,
  tint,
  eyebrow,
  title,
  body,
  meta,
  ctaDisabled,
  onPress,
}: PosterProps) {
  return (
    <OyunAuraCerceve
      renkler={[tint[1], '#FFFFFF', tint[1]]}
      yaricap={24}
      kalinlik={1.5}
      hizMs={5600}
      aktif={!ctaDisabled}
      parlamaRengi={tint[1]}
    >
    <Pressable
      onPress={ctaDisabled ? undefined : onPress}
      disabled={ctaDisabled}
      style={({ pressed }) => [
        styles.poster,
        pressed && !ctaDisabled && styles.posterPressed,
        ctaDisabled && styles.posterDisabled,
      ]}
    >
      <Image source={cover} style={styles.posterCover} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(6,8,16,0.55)', 'rgba(6,8,16,0.96)']}
        locations={[0.15, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.posterBody}>
        <View style={[styles.avatarRing, { borderColor: tint[1] }]}>
          <Image
            source={avatar}
            style={styles.avatarImg}
            resizeMode="contain"
          />
        </View>
        <View style={styles.posterCopy}>
          <Text style={[styles.cardEyebrow, { color: tint[1] }]}>{eyebrow}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>
            {body}
          </Text>
          <Text style={styles.cardMeta}>{meta}</Text>
        </View>
        <View
          style={[styles.cta, ctaDisabled && styles.ctaDisabled, { shadowColor: tint[1] }]}
        >
          <LinearGradient
            colors={[tint[1], tint[0]]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.ctaFill}
          >
            <Ionicons name="play" size={14} color="#fff" />
            <Text style={styles.ctaText}>OYNA</Text>
          </LinearGradient>
        </View>
      </View>
    </Pressable>
    </OyunAuraCerceve>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.md,
    minHeight: 0,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  baslikMetin: { flex: 1, paddingRight: 12 },
  eyebrow: {
    color: 'rgba(232,197,71,0.85)',
    fontSize: TipografiTokenlari.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  heading: {
    color: '#F7F2E8',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  kapatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sub: {
    color: 'rgba(247,242,232,0.58)',
    fontSize: TipografiTokenlari.caption.fontSize,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 18,
  },
  liste: {
    gap: 14,
    paddingBottom: 20,
  },
  bosKart: {
    backgroundColor: 'rgba(18,20,32,0.9)',
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bosBaslik: {
    color: '#F7F2E8',
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '800',
  },
  bosGovde: {
    color: 'rgba(247,242,232,0.55)',
    marginTop: 8,
    fontSize: TipografiTokenlari.body.fontSize,
  },
  poster: {
    height: 212,
    borderRadius: 22.5,
    overflow: 'hidden',
    backgroundColor: '#121018',
  },
  posterPressed: {
    transform: [{ scale: 0.985 }],
  },
  posterDisabled: { opacity: 0.45 },
  posterCover: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  posterBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 14,
    gap: 12,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#0B0D16',
  },
  avatarImg: {
    width: 72,
    height: 72,
    backgroundColor: 'transparent',
  },
  posterCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 2,
  },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: '#F7F2E8',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  cardBody: {
    color: 'rgba(247,242,232,0.72)',
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  cardMeta: {
    color: 'rgba(247,242,232,0.42)',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  cta: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaFill: {
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1.1,
    fontSize: 13,
  },
});
