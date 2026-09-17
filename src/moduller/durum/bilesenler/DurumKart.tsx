import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfilAvatarKucuk } from '../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import type { DurumOggesi } from '../islemler/DurumIslemleri';
import { DurumOyunKazanciPayloadAl } from '../islemler/DurumIslemleri';
import { DurumZamanMetni } from '../islemler/DurumZaman';
import { DurumOyunKazanciKart } from './DurumOyunKazanciKart';
import { DurumVideoOnizleme } from './DurumVideoOnizleme';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  oge: DurumOggesi;
  onPress: () => void;
  onBegen: () => void;
  onYorum: () => void;
  onHediye: () => void;
  onProfil: () => void;
  onMenu?: () => void;
};

function formatSayi(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}Mn`;
  if (n >= 10_000) return `${Math.round(n / 1000)}B`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}B`;
  return String(n);
}

export function DurumKart({
  oge,
  onPress,
  onBegen,
  onYorum,
  onHediye,
  onProfil,
  onMenu,
}: Props) {
  const handle = oge.username ? `@${oge.username}` : null;
  const kazanc = DurumOyunKazanciPayloadAl(oge);

  return (
    <Pressable style={styles.kart} onPress={onPress}>
      <Pressable onPress={onProfil} hitSlop={4}>
        <ProfilAvatarKucuk
          size={42}
          displayName={oge.display_name}
          username={oge.username}
          avatarUrl={oge.avatar_url}
        />
      </Pressable>

      <View style={styles.govde}>
        <View style={styles.ustBlok}>
          <Pressable style={styles.ustSatir} onPress={onProfil}>
            <Text style={styles.isim} numberOfLines={1}>
              {oge.display_name}
            </Text>
            {handle ? (
              <Text style={styles.handle} numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
            <Text style={styles.nokta}>·</Text>
            <Text style={styles.zaman}>{DurumZamanMetni(oge.created_at)}</Text>
          </Pressable>
          {onMenu ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onMenu();
              }}
              hitSlop={10}
              style={styles.menuBtn}
              accessibilityLabel="Gönderi seçenekleri"
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={RenkTokenlari.textDim}
              />
            </Pressable>
          ) : null}
        </View>

        {oge.caption ? (
          <Text style={styles.caption}>{oge.caption}</Text>
        ) : null}

        <Pressable
          onPress={onPress}
          style={[styles.medyaHit, !!kazanc && styles.medyaHitKart]}
          accessibilityRole="imagebutton"
        >
          {kazanc ? (
            <DurumOyunKazanciKart payload={kazanc} />
          ) : oge.media_type === 'video' ? (
            <View style={styles.medya} pointerEvents="box-none">
              <DurumVideoOnizleme
                uri={oge.media_url}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.videoBadge} pointerEvents="none">
                <Ionicons name="play" size={13} color="#fff" />
              </View>
            </View>
          ) : (
            <Image source={{ uri: oge.media_url }} style={styles.medya} />
          )}
        </Pressable>

        <View style={styles.aksiyonlar}>
          <Pressable
            style={styles.aksiyon}
            onPress={(e) => {
              e.stopPropagation?.();
              onYorum();
            }}
            hitSlop={10}
          >
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={RenkTokenlari.textDim}
            />
            {oge.comment_count > 0 ? (
              <Text style={styles.aksiyonSayi}>
                {formatSayi(oge.comment_count)}
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            style={styles.aksiyon}
            onPress={(e) => {
              e.stopPropagation?.();
              onBegen();
            }}
            hitSlop={10}
          >
            <Ionicons
              name={oge.liked_by_me ? 'heart' : 'heart-outline'}
              size={18}
              color={
                oge.liked_by_me ? RenkTokenlari.danger : RenkTokenlari.textDim
              }
            />
            {oge.like_count > 0 ? (
              <Text
                style={[
                  styles.aksiyonSayi,
                  oge.liked_by_me && { color: RenkTokenlari.danger },
                ]}
              >
                {formatSayi(oge.like_count)}
              </Text>
            ) : null}
          </Pressable>

          <Pressable
            style={styles.aksiyon}
            onPress={(e) => {
              e.stopPropagation?.();
              onHediye();
            }}
            hitSlop={10}
          >
            <Ionicons
              name="gift-outline"
              size={18}
              color={
                oge.gift_count > 0
                  ? RenkTokenlari.accent
                  : RenkTokenlari.textDim
              }
            />
            {oge.gift_count > 0 ? (
              <Text style={[styles.aksiyonSayi, { color: RenkTokenlari.accent }]}>
                {formatSayi(oge.gift_count)}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  govde: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  ustBlok: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ustSatir: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  isim: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 15,
    flexShrink: 1,
  },
  handle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontSize: 14,
    flexShrink: 2,
  },
  nokta: {
    color: RenkTokenlari.textDim,
    fontSize: 13,
  },
  zaman: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontSize: 14,
    flexShrink: 0,
  },
  caption: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontSize: 15,
    lineHeight: 21,
  },
  medyaHit: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  medyaHitKart: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  medya: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  videoBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aksiyonlar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 24,
    paddingTop: 2,
    maxWidth: 280,
  },
  aksiyon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    minWidth: 44,
  },
  aksiyonSayi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
