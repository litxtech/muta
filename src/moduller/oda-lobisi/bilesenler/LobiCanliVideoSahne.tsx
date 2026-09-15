/**
 * Lobi canlı video sahnesi — tam ekran gerçek insan videosu + PiP’ler.
 * Asset.fromModule ile URI çözümler (require numarası bazı cihazlarda boş kalır).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { VideoView, useVideoPlayer } from 'expo-video';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { LOBI_AMBIENT_VIDEOLARI } from '../sabitler/LobiAmbientVideolari';

const KLIP_SURESI_MS = 24_000;
const { width: W, height: H } = Dimensions.get('window');

type Props = {
  aktif?: boolean;
};

async function assetUri(mod: number): Promise<string> {
  const a = Asset.fromModule(mod);
  if (!a.localUri) await a.downloadAsync();
  const uri = a.localUri ?? a.uri;
  if (!uri) throw new Error('Video asset URI yok');
  return uri;
}

function LobiPip({ uri, style }: { uri: string; style: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    try {
      player.replace(uri);
      player.muted = true;
      player.loop = true;
      player.play();
    } catch {
      /* ignore */
    }
  }, [uri, player]);

  return (
    <View style={[styles.pip, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
      <View style={styles.pipKenar} pointerEvents="none" />
    </View>
  );
}

export function LobiCanliVideoSahne({ aktif = true }: Props) {
  const [index, setIndex] = useState(0);
  const [uris, setUris] = useState<string[]>([]);

  const n = LOBI_AMBIENT_VIDEOLARI.length;

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const list = await Promise.all(
          LOBI_AMBIENT_VIDEOLARI.map((v) => assetUri(v.kaynak)),
        );
        if (!iptal) setUris(list);
      } catch (e) {
        console.warn('[LobiCanliVideoSahne] asset', e);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const anaUri = uris.length ? uris[index % uris.length] : null;
  const pipAUri = uris.length > 1 ? uris[(index + 1) % uris.length] : null;
  const pipBUri = uris.length > 2 ? uris[(index + 2) % uris.length] : null;

  const player = useVideoPlayer(anaUri ?? null, (p) => {
    p.loop = true;
    p.muted = true;
    if (anaUri) p.play();
  });

  useEffect(() => {
    if (!anaUri || !aktif) {
      try {
        player.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      player.replace(anaUri);
      player.muted = true;
      player.loop = true;
      player.play();
    } catch (e) {
      console.warn('[LobiCanliVideoSahne] play', e);
    }
  }, [aktif, anaUri, player]);

  useEffect(() => {
    if (!aktif || uris.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % uris.length);
    }, KLIP_SURESI_MS);
    return () => clearInterval(t);
  }, [aktif, uris.length]);

  const pipBoyutlar = useMemo(
    () => ({
      buyuk: { width: Math.min(118, W * 0.28), height: Math.min(168, W * 0.4) },
      kucuk: { width: Math.min(96, W * 0.24), height: Math.min(128, W * 0.32) },
    }),
    [],
  );

  return (
    <View style={styles.sahne} pointerEvents="none">
      {anaUri ? (
        <VideoView
          player={player}
          style={styles.anaVideo}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />
      ) : (
        <View style={[styles.anaVideo, styles.yedek]} />
      )}

      <LinearGradient
        colors={['rgba(8,4,14,0.45)', 'transparent']}
        style={styles.ustGolge}
      />
      <LinearGradient
        colors={['transparent', 'rgba(8,4,14,0.25)', 'rgba(8,4,14,0.88)']}
        locations={[0.4, 0.68, 1]}
        style={styles.altGolge}
      />

      {aktif && pipAUri ? (
        <View style={styles.pipKolon}>
          <LobiPip uri={pipAUri} style={pipBoyutlar.buyuk} />
          {pipBUri ? <LobiPip uri={pipBUri} style={pipBoyutlar.kucuk} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sahne: {
    ...StyleSheet.absoluteFill,
    width: W,
    height: H,
    backgroundColor: '#0A0610',
    overflow: 'hidden',
  },
  anaVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: W,
    height: H,
  },
  yedek: {
    backgroundColor: RenkTokenlari.deepPlum,
  },
  ustGolge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  altGolge: {
    ...StyleSheet.absoluteFill,
  },
  pipKolon: {
    position: 'absolute',
    right: 12,
    top: H * 0.26,
    gap: 10,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  pip: {
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  pipKenar: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.4)',
  },
});
