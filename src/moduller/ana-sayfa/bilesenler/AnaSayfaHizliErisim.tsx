import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type AnaSayfaHizliOge = {
  key: string;
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  href: string;
};

type Props = {
  ogeler: AnaSayfaHizliOge[];
  onSec: (href: string) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function HizliKart({
  oge,
  index,
  onSec,
}: {
  oge: AnaSayfaHizliOge;
  index: number;
  onSec: (href: string) => void;
}) {
  const olcek = useSharedValue(1);

  const stil = useAnimatedStyle(() => ({
    transform: [{ scale: olcek.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(80 + index * 70)
        .duration(AnimasyonTokenlari.yavas)
        .springify()
        .damping(16)}
    >
      <AnimatedPressable
        onPress={() => onSec(oge.href)}
        onPressIn={() => {
          olcek.value = withSpring(0.96, { damping: 16, stiffness: 280 });
        }}
        onPressOut={() => {
          olcek.value = withSpring(1, { damping: 14, stiffness: 220 });
        }}
        style={[styles.kart, stil]}
        accessibilityRole="button"
        accessibilityLabel={`${oge.baslik}. ${oge.alt}`}
      >
        <LinearGradient
          colors={[`${oge.tint}28`, 'rgba(33,28,46,0.92)', RenkTokenlari.bgCard]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.kartIc}
        >
          <View style={[styles.ikon, { borderColor: `${oge.tint}55` }]}>
            <LinearGradient
              colors={[`${oge.tint}55`, `${oge.tint}18`]}
              style={styles.ikonIc}
            >
              <Ionicons name={oge.icon} size={20} color={oge.tint} />
            </LinearGradient>
          </View>
          <Text style={styles.kartBaslik} numberOfLines={1}>
            {oge.baslik}
          </Text>
          <Text style={styles.kartAlt} numberOfLines={2}>
            {oge.alt}
          </Text>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

/** Ana sayfa — premium hızlı giriş şeridi */
export function AnaSayfaHizliErisim({ ogeler, onSec }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.baslikSatir}>
        <Text style={styles.baslik}>Sahneye çık</Text>
        <View style={styles.cizgi} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.satir}
        decelerationRate="fast"
      >
        {ogeler.map((o, i) => (
          <HizliKart key={o.key} oge={o} index={i} onSec={onSec} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: BoslukTokenlari.xs,
    paddingBottom: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm + 2,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  cizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  satir: {
    gap: BoslukTokenlari.sm + 2,
    paddingRight: BoslukTokenlari.lg,
  },
  kart: {
    width: 152,
    borderRadius: YaricapTokenlari.md + 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.22)',
  },
  kartIc: {
    padding: BoslukTokenlari.md,
    gap: 6,
    minHeight: 118,
  },
  ikon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 4,
  },
  ikonIc: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kartBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kartAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
  },
});
