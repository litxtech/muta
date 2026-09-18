import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  /** 1-based koltuk no (taht için null) */
  numara?: number | null;
  tahtMi?: boolean;
  doluMu?: boolean;
  hostMu?: boolean;
  yardimciMu?: boolean;
};

const KOLTUK_PALET: ReadonlyArray<readonly [string, string, string]> = [
  ['#FF6BA8', '#E84091', '#9B1F5C'], // fuşya
  ['#7EC8FF', '#3B8FE8', '#1A4F8C'], // mavi
  ['#6EF0C4', '#2EC4A0', '#0F6B55'], // mint
  ['#C9A0FF', '#8B5CF6', '#4C2A8A'], // mor
  ['#FFB86B', '#F08A2E', '#8C4A10'], // turuncu
  ['#FF7A9A', '#E84B6A', '#8C2038'], // kırmızı
  ['#7EE0FF', '#2AB8D9', '#0E5F73'], // camgöbeği
  ['#B8F06B', '#7BC42E', '#3F6B12'], // yeşil
];

function koltukRenk(
  numara: number | null | undefined,
  yardimciMu: boolean,
): readonly [string, string, string] {
  if (yardimciMu) return ['#9ECFFF', '#4A8FD9', '#1E4A7A'] as const;
  const i = Math.max(0, (numara ?? 1) - 1) % KOLTUK_PALET.length;
  return KOLTUK_PALET[i];
}

/**
 * Dikey sandalye / taht silueti — yatay “yatak” kaide değil.
 */
function KoltukTahtiIc({
  numara,
  tahtMi = false,
  doluMu = false,
  hostMu = false,
  yardimciMu = false,
}: Props) {
  if (tahtMi || hostMu) {
    return <PadisahTahti doluMu={doluMu} />;
  }

  const renk = koltukRenk(numara, yardimciMu);
  const etiket = numara != null && numara > 0 ? String(numara) : '·';

  return (
    <View style={styles.koltukWrap} pointerEvents="none">
      {/* Sırt — dikey sandalye */}
      <LinearGradient
        colors={[`${renk[0]}CC`, `${renk[1]}99`, `${renk[2]}66`]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.koltukSirt, !doluMu && styles.soluk]}
      >
        <View style={[styles.sirtCizgi, { backgroundColor: renk[0] }]} />
      </LinearGradient>

      {/* Oturak */}
      <LinearGradient
        colors={[renk[0], renk[1], renk[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.koltukOturak, !doluMu && styles.soluk]}
      >
        <Text style={styles.koltukNo}>{etiket}</Text>
      </LinearGradient>

      {/* Kollar */}
      <View style={styles.koltukKollar}>
        <View style={[styles.kol, { backgroundColor: renk[1] }]} />
        <View style={[styles.kol, { backgroundColor: renk[1] }]} />
      </View>

      {/* Ayaklar */}
      <View style={styles.ayaklar}>
        <View style={[styles.ayak, { backgroundColor: renk[2] }]} />
        <View style={[styles.ayak, { backgroundColor: renk[2] }]} />
      </View>
    </View>
  );
}

function PadisahTahti({ doluMu }: { doluMu: boolean }) {
  return (
    <View style={[styles.padisahWrap, !doluMu && styles.soluk]} pointerEvents="none">
      {/* Taç */}
      <View style={styles.tacSatir}>
        <View style={styles.tacUc} />
        <Ionicons name="diamond" size={12} color="#FFE9A8" style={styles.tacIcon} />
        <View style={styles.tacUc} />
      </View>

      {/* Yüksek sırt — padişah tahtı */}
      <LinearGradient
        colors={['#FFE08A', '#F0B429', '#C9891A', '#7A4A0E']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.padisahSirt}
      >
        <View style={styles.padisahSirtDesen} />
        <View style={styles.padisahSirtDesenAlt} />
        <Ionicons name="sparkles" size={14} color="rgba(255,240,200,0.85)" />
      </LinearGradient>

      {/* Kolluklar + oturak */}
      <View style={styles.padisahGovde}>
        <LinearGradient
          colors={['#8B1E3F', '#C41E5A', '#6B102E']}
          style={styles.padisahKol}
        />
        <LinearGradient
          colors={['#FFD76A', '#E8A820', '#A86B10']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.padisahOturak}
        >
          <Text style={styles.padisahEtiket}>TAHT</Text>
        </LinearGradient>
        <LinearGradient
          colors={['#8B1E3F', '#C41E5A', '#6B102E']}
          style={styles.padisahKol}
        />
      </View>

      {/* Ayak basamağı */}
      <LinearGradient
        colors={['#D4A017', '#8B6914', '#5C3D0A']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.padisahBasamak}
      />
      <View style={styles.padisahAyaklar}>
        <View style={styles.padisahAyak} />
        <View style={styles.padisahAyak} />
      </View>
    </View>
  );
}

export const KoltukTahti = memo(KoltukTahtiIc);

const styles = StyleSheet.create({
  soluk: { opacity: 0.62 },

  koltukWrap: {
    width: 48,
    alignItems: 'center',
    marginTop: -2,
    zIndex: 2,
  },
  koltukSirt: {
    width: 34,
    height: 18,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  sirtCizgi: {
    width: 14,
    height: 2,
    borderRadius: 1,
    opacity: 0.85,
  },
  koltukOturak: {
    width: 46,
    height: 18,
    borderRadius: 8,
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  koltukNo: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  koltukKollar: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  kol: {
    width: 6,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ayaklar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 36,
    marginTop: 1,
  },
  ayak: {
    width: 5,
    height: 6,
    borderRadius: 1.5,
  },

  padisahWrap: {
    width: 108,
    alignItems: 'center',
    marginTop: -6,
    zIndex: 3,
  },
  tacSatir: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginBottom: -2,
    zIndex: 4,
  },
  tacUc: {
    width: 8,
    height: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#F0B429',
    borderWidth: 1,
    borderColor: '#FFE9A8',
  },
  tacIcon: {
    marginBottom: 2,
  },
  padisahSirt: {
    width: 72,
    height: 36,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,230,150,0.75)',
    borderBottomWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  padisahSirtDesen: {
    position: 'absolute',
    top: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,240,200,0.35)',
  },
  padisahSirtDesenAlt: {
    position: 'absolute',
    bottom: -8,
    width: 56,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(139,30,63,0.35)',
  },
  padisahGovde: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: -4,
    gap: 2,
  },
  padisahKol: {
    width: 14,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,200,220,0.35)',
  },
  padisahOturak: {
    width: 64,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,230,150,0.8)',
  },
  padisahEtiket: {
    ...TipografiTokenlari.micro,
    color: '#2A1808',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  padisahBasamak: {
    width: 88,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,220,120,0.45)',
  },
  padisahAyaklar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 70,
    marginTop: 2,
  },
  padisahAyak: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#8B6914',
    borderWidth: 1,
    borderColor: '#F0B429',
  },
});
