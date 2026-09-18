import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GorusmeVideoSahne } from './GorusmeVideoSahne';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { GorusmeTuru, ThreadKarsiProfil } from '../tipler';

export function sureMetni(saniye: number): string {
  const h = Math.floor(saniye / 3600);
  const m = Math.floor((saniye % 3600) / 60);
  const s = saniye % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** answered_at veya baglandi anindan sure sayaci */
export function useGorusmeSuresi(
  baglandi: boolean,
  answeredAt?: string | null,
): number {
  const [saniye, setSaniye] = useState(0);

  useEffect(() => {
    if (!baglandi) {
      setSaniye(0);
      return;
    }
    const bas =
      answeredAt && !Number.isNaN(Date.parse(answeredAt))
        ? Date.parse(answeredAt)
        : Date.now();
    const tick = () =>
      setSaniye(Math.max(0, Math.floor((Date.now() - bas) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [baglandi, answeredAt]);

  return saniye;
}

type AktifProps = {
  peer: ThreadKarsiProfil | null;
  callType: GorusmeTuru;
  durumYazi: string;
  baglandi: boolean;
  answeredAt?: string | null;
  isCaller?: boolean;
  muted: boolean;
  speaker: boolean;
  cameraOn: boolean;
  mock?: boolean;
  onMute: () => void;
  onSpeaker: () => void;
  onCamera?: () => void;
  onHangup: () => void;
  onFlip?: () => void;
};

/**
 * Profesyonel 1:1 gorusme — uzak tam ekran, yerel PiP, sure, kontroller.
 */
export function GorusmeAktifEkrani({
  peer,
  callType,
  durumYazi,
  baglandi,
  answeredAt,
  isCaller,
  muted,
  speaker,
  cameraOn,
  mock,
  onMute,
  onSpeaker,
  onCamera,
  onHangup,
  onFlip,
}: AktifProps) {
  const saniye = useGorusmeSuresi(baglandi, answeredAt);
  const ad =
    peer?.display_name?.trim() ||
    peer?.username?.trim() ||
    'Kullanıcı';
  const video = callType === 'video';

  return (
    <View style={styles.root}>
      <GorusmeVideoSahne
        video={video}
        cameraOn={cameraOn}
        mock={mock}
        peerAvatar={peer?.avatar_url}
        peerName={ad}
      />

      {/* Ust cam panel */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'transparent']}
        style={styles.ustGradient}
      >
        <View style={styles.ust}>
          <View style={styles.turPill}>
            <View style={[styles.liveDot, baglandi && styles.liveDotOn]} />
            <Text style={styles.tur}>
              {video ? 'Görüntülü' : 'Sesli'}
              {isCaller && !baglandi ? ' · Aranıyor' : ''}
            </Text>
          </View>
          <Text style={styles.ad} numberOfLines={1}>
            {ad}
          </Text>
          <Text style={styles.durum}>
            {baglandi ? sureMetni(saniye) : durumYazi}
          </Text>
          {baglandi ? (
            <Text style={styles.sureEtiket}>Konuşma süresi</Text>
          ) : null}
        </View>
      </LinearGradient>

      {/* Alt kontroller */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.altGradient}
      >
        <View style={styles.kontroller}>
          <Kontrol
            icon={muted ? 'mic-off' : 'mic'}
            label={muted ? 'Sessiz' : 'Mikrofon'}
            aktif={muted}
            onPress={onMute}
          />
          <Kontrol
            icon={speaker ? 'volume-high' : 'volume-mute'}
            label={speaker ? 'Hoparlör' : 'Kulaklık'}
            aktif={speaker}
            onPress={onSpeaker}
          />
          {video && onCamera ? (
            <Kontrol
              icon={cameraOn ? 'videocam' : 'videocam-off'}
              label="Kamera"
              aktif={!cameraOn}
              onPress={onCamera}
            />
          ) : null}
          {video && onFlip && cameraOn ? (
            <Kontrol
              icon="camera-reverse"
              label="Çevir"
              onPress={onFlip}
            />
          ) : !video ? (
            <Kontrol
              icon="ellipsis-horizontal"
              label="Diğer"
              onPress={() => undefined}
            />
          ) : null}
        </View>

        <Pressable
          style={styles.bitir}
          onPress={onHangup}
          accessibilityLabel="Görüşmeyi bitir"
        >
          <Ionicons
            name="call"
            size={30}
            color="#fff"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
        </Pressable>
        <Text style={styles.bitirYazi}>Bitir</Text>
      </LinearGradient>
    </View>
  );
}

type GelenProps = {
  peerName: string;
  peerAvatar?: string | null;
  callType: GorusmeTuru;
  onAccept: () => void;
  onReject: () => void;
};

/** Gelen arama — arayan hemen gorunur */
export function GorusmeGelenEkrani({
  peerName,
  peerAvatar,
  callType,
  onAccept,
  onReject,
}: GelenProps) {
  const harf = peerName.charAt(0).toLocaleUpperCase('tr-TR');
  return (
    <View style={styles.gelenRoot}>
      <LinearGradient
        colors={['#1A1228', '#121018', '#0A0810']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.gelenUst}>
        <Text style={styles.gelenTur}>
          {callType === 'video' ? 'Görüntülü arama' : 'Sesli arama'}
        </Text>
        <Text style={styles.gelenAlt}>Arıyor…</Text>
        <Text style={styles.gelenAd}>{peerName}</Text>
      </View>

      <View style={styles.gelenAvatarWrap}>
        {peerAvatar ? (
          <Image source={{ uri: peerAvatar }} style={styles.gelenAvatar} />
        ) : (
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            style={styles.gelenAvatar}
          >
            <Text style={styles.harfBuyuk}>{harf}</Text>
          </LinearGradient>
        )}
        <View style={styles.gelenPulse} />
        <View style={[styles.gelenPulse, styles.gelenPulse2]} />
      </View>

      <View style={styles.gelenAksiyonlar}>
        <View style={styles.gelenAksiyon}>
          <Pressable style={styles.red} onPress={onReject}>
            <Ionicons
              name="call"
              size={30}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </Pressable>
          <Text style={styles.gelenLabel}>Reddet</Text>
        </View>
        <View style={styles.gelenAksiyon}>
          <Pressable style={styles.kabul} onPress={onAccept}>
            <Ionicons
              name={callType === 'video' ? 'videocam' : 'call'}
              size={30}
              color="#fff"
            />
          </Pressable>
          <Text style={styles.gelenLabel}>Kabul et</Text>
        </View>
      </View>
    </View>
  );
}

function Kontrol({
  icon,
  label,
  aktif,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  aktif?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.kontrol} onPress={onPress}>
      <View style={[styles.kontrolDaire, aktif && styles.kontrolAktif]}>
        <Ionicons
          name={icon}
          size={22}
          color={aktif ? RenkTokenlari.textOnPrimary : RenkTokenlari.text}
        />
      </View>
      <Text style={styles.kontrolYazi}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  ustGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 48,
    paddingHorizontal: BoslukTokenlari.lg,
    zIndex: 2,
  },
  ust: { alignItems: 'center', gap: 4 },
  turPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginBottom: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.textDim,
  },
  liveDotOn: { backgroundColor: RenkTokenlari.mint },
  tur: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  ad: {
    ...TipografiTokenlari.title,
    color: '#fff',
    fontSize: 26,
    textAlign: 'center',
  },
  durum: {
    ...TipografiTokenlari.h2,
    color: '#fff',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sureEtiket: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
  },
  altGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    paddingTop: 40,
    alignItems: 'center',
    zIndex: 2,
  },
  kontroller: {
    flexDirection: 'row',
    gap: 28,
    alignItems: 'center',
    marginBottom: 20,
  },
  kontrol: { alignItems: 'center', gap: 8, width: 72 },
  kontrolDaire: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kontrolAktif: { backgroundColor: RenkTokenlari.text },
  kontrolYazi: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  bitir: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bitirYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 8,
    fontWeight: '600',
  },
  gelenRoot: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  gelenUst: { alignItems: 'center', gap: 6 },
  gelenTur: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  gelenAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  gelenAd: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 32,
    marginTop: 4,
  },
  gelenAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  gelenAvatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  harfBuyuk: { fontSize: 56, fontWeight: '800', color: RenkTokenlari.textOnPrimary },
  gelenPulse: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(232,64,145,0.35)',
  },
  gelenPulse2: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderColor: 'rgba(196,59,255,0.2)',
  },
  gelenAksiyonlar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: BoslukTokenlari.xxl,
  },
  gelenAksiyon: { alignItems: 'center', gap: 10 },
  red: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kabul: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gelenLabel: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
