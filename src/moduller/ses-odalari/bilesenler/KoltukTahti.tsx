import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  /** 1-based koltuk no (taht için null) */
  numara?: number | null;
  tahtMi?: boolean;
  doluMu?: boolean;
  hostMu?: boolean;
  yardimciMu?: boolean;
};

/**
 * Sahne podiumu — sandalye silueti değil; elips kaide + metal kenar.
 * Host: geniş bronz/obsidiyen taht. Koltuk: kompakt mat metal disk.
 */
function KoltukTahtiIc({
  numara,
  tahtMi = false,
  doluMu = false,
  hostMu = false,
  yardimciMu = false,
}: Props) {
  if (tahtMi || hostMu) {
    return <HostPodiyumu doluMu={doluMu} />;
  }

  const etiket = numara != null && numara > 0 ? String(numara) : '';
  const kenar = yardimciMu
    ? (['#B8D4F0', '#6A9CC8', '#3A6088'] as const)
    : (['#C8C4D0', '#7A7688', '#3A3844'] as const);
  const taban = yardimciMu
    ? (['#2A3848', '#1A2430', '#0E141C'] as const)
    : (['#2C2A34', '#1C1A22', '#100E14'] as const);

  return (
    <View style={[styles.koltukWrap, !doluMu && styles.soluk]} pointerEvents="none">
      {/* Üst yüz — fırçalı metal halka */}
      <LinearGradient
        colors={[...kenar]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.koltukHalka}
      >
        <LinearGradient
          colors={[...taban]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.koltukYuzey}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.14)', 'transparent']}
            style={styles.koltukParlama}
          />
          {etiket ? (
            <Text style={[styles.koltukNo, yardimciMu && styles.koltukNoYardimci]}>
              {etiket}
            </Text>
          ) : null}
        </LinearGradient>
      </LinearGradient>
      {/* Alt gölge / kalınlık */}
      <View style={[styles.koltukKalinlik, yardimciMu && styles.koltukKalinlikYardimci]} />
      <View style={styles.koltukGolge} />
    </View>
  );
}

function HostPodiyumu({ doluMu }: { doluMu: boolean }) {
  return (
    <View style={[styles.tahtWrap, !doluMu && styles.soluk]} pointerEvents="none">
      {/* Üst basamak — ince altın halka */}
      <LinearGradient
        colors={['#F2E2B0', '#C9A84A', '#8A6A28']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.tahtUstHalka}
      >
        <LinearGradient
          colors={['#3A2A18', '#1E160C', '#0C0A06']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.tahtUstYuzey}
        >
          <LinearGradient
            colors={['rgba(242,226,176,0.22)', 'transparent']}
            style={styles.tahtParlama}
          />
        </LinearGradient>
      </LinearGradient>

      {/* Ana kaide */}
      <LinearGradient
        colors={['#E8D090', '#B8923A', '#6E5420']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.tahtAnaHalka}
      >
        <LinearGradient
          colors={['#2A1E12', '#14100A', '#080604']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.tahtAnaYuzey}
        >
          <View style={styles.tahtCizgi} />
          <Text style={styles.tahtEtiket}>HOST</Text>
        </LinearGradient>
      </LinearGradient>

      {/* Alt basamak */}
      <LinearGradient
        colors={['#A88838', '#6A5420', '#3A2E10']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.tahtAltBasamak}
      />
      <View style={styles.tahtGolge} />
    </View>
  );
}

export const KoltukTahti = memo(KoltukTahtiIc);

const styles = StyleSheet.create({
  soluk: { opacity: 0.5 },

  koltukWrap: {
    width: 52,
    height: 22,
    alignItems: 'center',
    marginTop: 0,
    zIndex: 2,
  },
  koltukHalka: {
    width: 46,
    height: 14,
    borderRadius: 23,
    padding: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  koltukYuzey: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  koltukParlama: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
  },
  koltukNo: {
    ...TipografiTokenlari.micro,
    color: 'rgba(210,205,220,0.9)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  koltukNoYardimci: {
    color: 'rgba(180,210,240,0.95)',
  },
  koltukKalinlik: {
    width: 40,
    height: 3,
    marginTop: -1,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: '#141218',
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderColor: 'rgba(120,116,130,0.35)',
  },
  koltukKalinlikYardimci: {
    backgroundColor: '#121820',
    borderColor: 'rgba(100,140,180,0.4)',
  },
  koltukGolge: {
    width: 34,
    height: 3,
    marginTop: 1,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  tahtWrap: {
    width: 118,
    height: 42,
    alignItems: 'center',
    marginTop: -2,
    zIndex: 3,
  },
  tahtUstHalka: {
    width: 72,
    height: 12,
    borderRadius: 36,
    padding: 1.5,
    zIndex: 3,
  },
  tahtUstYuzey: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
  },
  tahtParlama: {
    ...StyleSheet.absoluteFill,
  },
  tahtAnaHalka: {
    width: 100,
    height: 18,
    borderRadius: 50,
    padding: 2,
    marginTop: -4,
    zIndex: 2,
  },
  tahtAnaYuzey: {
    flex: 1,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tahtCizgi: {
    position: 'absolute',
    top: 3,
    width: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(232,208,144,0.35)',
  },
  tahtEtiket: {
    ...TipografiTokenlari.micro,
    color: '#E8D090',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tahtAltBasamak: {
    width: 108,
    height: 6,
    borderRadius: 3,
    marginTop: -2,
    zIndex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,208,144,0.3)',
  },
  tahtGolge: {
    width: 88,
    height: 4,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
