import React, { memo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProfilAvatarKucuk } from '../../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import {
  DurumMedyaHttpsMi,
  DurumOyunKazanciPayloadAl,
  type DurumOggesi,
} from '../../islemler/DurumIslemleri';
import { DurumOyunKazanciKart } from '../../bilesenler/DurumOyunKazanciKart';
import { DurumVideoOnizleme } from '../../bilesenler/DurumVideoOnizleme';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { SilinmisGonderiKarti } from './SilinmisGonderiKarti';
import {
  type PaylasilanDurumOnizleme,
} from '../tipler';

type Props = {
  onizleme: PaylasilanDurumOnizleme | null | undefined;
  note?: string | null;
  mine?: boolean;
  onLongPress?: () => void;
  yukleniyor?: boolean;
};

const CAPTION_LIMIT = 110;

function metinKisa(caption: string | null | undefined): {
  text: string;
  truncated: boolean;
} {
  const t = (caption ?? '').trim();
  if (!t) return { text: '', truncated: false };
  if (t.length <= CAPTION_LIMIT) return { text: t, truncated: false };
  return { text: `${t.slice(0, CAPTION_LIMIT).trimEnd()}…`, truncated: true };
}

function PaylasilanGonderiKartiIc({
  onizleme,
  note,
  mine,
  onLongPress,
  yukleniyor,
}: Props) {
  const [genis, setGenis] = useState(false);

  if (yukleniyor && !onizleme) {
    return (
      <View style={[styles.kart, mine ? styles.mine : styles.theirs]}>
        <Text style={styles.yukleniyor}>Gönderi yükleniyor…</Text>
      </View>
    );
  }

  if (!onizleme || onizleme.availability !== 'AVAILABLE') {
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={300}>
        <View style={styles.wrap}>
          {note ? (
            <Text style={mine ? styles.noteMine : styles.note}>{note}</Text>
          ) : null}
          <SilinmisGonderiKarti
            availability={onizleme?.availability ?? 'NOT_AVAILABLE'}
            message={onizleme?.message}
            mine={mine}
          />
        </View>
      </Pressable>
    );
  }

  const handle = onizleme.username ? `@${onizleme.username}` : null;
  const mediaUrl = onizleme.media_url ?? '';
  const https = DurumMedyaHttpsMi(mediaUrl);
  const isVideo = onizleme.media_type === 'video' && https;
  const isImage =
    https &&
    onizleme.media_type !== 'video' &&
    onizleme.media_type !== 'text' &&
    onizleme.post_kind !== 'game_win';
  const isText =
    onizleme.media_type === 'text' || (!https && onizleme.post_kind !== 'game_win');

  const fakeOge = {
    post_kind: onizleme.post_kind ?? 'media',
    payload: onizleme.payload ?? {},
  } as DurumOggesi;
  const kazanc = DurumOyunKazanciPayloadAl(fakeOge);

  const cap = metinKisa(onizleme.caption);
  const captionGoster =
    genis && onizleme.caption
      ? onizleme.caption.trim()
      : cap.text;

  const profilGit = () => {
    if (!onizleme.user_id) return;
    try {
      router.push(`/kullanici/${onizleme.user_id}` as any);
    } catch {
      /* */
    }
  };

  const detayGit = () => {
    if (!onizleme.status_id) return;
    try {
      router.push(`/durum/${onizleme.status_id}` as any);
    } catch {
      /* */
    }
  };

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.wrap, mine ? styles.mine : styles.theirs]}
    >
      {note ? (
        <Text style={mine ? styles.noteMine : styles.note}>{note}</Text>
      ) : null}

      <Pressable
        onPress={detayGit}
        style={styles.kart}
        accessibilityRole="button"
        accessibilityLabel="Paylaşılan gönderiyi aç"
      >
        <Pressable style={styles.owner} onPress={profilGit}>
          <ProfilAvatarKucuk
            size={32}
            displayName={onizleme.display_name ?? 'Kullanıcı'}
            username={onizleme.username}
            avatarUrl={onizleme.avatar_url}
          />
          <View style={styles.ownerMetin}>
            <Text style={styles.isim} numberOfLines={1}>
              {onizleme.display_name ?? 'Kullanıcı'}
            </Text>
            {handle ? (
              <Text style={styles.handle} numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {kazanc ? (
          <View style={styles.medyaWrap}>
            <DurumOyunKazanciKart payload={kazanc} />
          </View>
        ) : isVideo ? (
          <View style={styles.video}>
            <DurumVideoOnizleme
              uri={mediaUrl}
              style={StyleSheet.absoluteFill}
              aktif
              mod="kare"
            />
            <View style={styles.videoOverlay} pointerEvents="none">
              <Ionicons name="play-circle" size={40} color="#fff" />
            </View>
          </View>
        ) : isImage ? (
          <Image
            source={{ uri: mediaUrl.trim() }}
            style={styles.foto}
            resizeMode="cover"
          />
        ) : isText ? (
          <View style={styles.metinKutu}>
            <Text style={styles.metinPreview} numberOfLines={genis ? 12 : 4}>
              {(onizleme.caption ?? '').trim() || 'Metin gönderisi'}
            </Text>
          </View>
        ) : null}

        {!isText && captionGoster ? (
          <View style={styles.captionWrap}>
            <Text style={styles.caption} numberOfLines={genis ? 8 : 3}>
              {captionGoster}
            </Text>
            {cap.truncated && !genis ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setGenis(true);
                }}
                hitSlop={6}
              >
                <Text style={styles.devam}>…devamını gör</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isText && (onizleme.caption ?? '').trim().length > 160 && !genis ? (
          <Pressable onPress={() => setGenis(true)} hitSlop={6}>
            <Text style={styles.devam}>…devamını gör</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

export const PaylasilanGonderiKarti = memo(PaylasilanGonderiKartiIc);

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 268,
    gap: 6,
  },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  note: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  noteMine: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  kart: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: RenkTokenlari.bgElevated,
    gap: 0,
  },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  ownerMetin: { flex: 1, minWidth: 0, gap: 1 },
  isim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  handle: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  medyaWrap: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  foto: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  metinKutu: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metinPreview: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 20,
  },
  captionWrap: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
  },
  caption: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  devam: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  yukleniyor: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    padding: 14,
  },
});

