import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnaSayfaCanliNokta } from '../../ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { TextField } from '../../../components/TextField';
import { GradientButton } from '../../../components/GradientButton';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  title: string;
  onChangeTitle: (v: string) => void;
  onBaslat: () => void;
  loading?: boolean;
  placeholder?: string;
};

/** Canlıya çık öncesi stüdyo hero + form */
export function CanliYayinStudioKarti({
  title,
  onChangeTitle,
  onBaslat,
  loading,
  placeholder = 'Gece şovu...',
}: Props) {
  return (
    <Animated.View
      entering={FadeInDown.delay(60)
        .duration(AnimasyonTokenlari.yavas)
        .springify()
        .damping(18)}
    >
      <LinearGradient
        colors={[
          `${RenkTokenlari.primary}2E`,
          RenkTokenlari.bgElevated,
          RenkTokenlari.bgCard,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.kart}
      >
        <View style={styles.ust}>
          <View style={styles.liveRozet}>
            <AnaSayfaCanliNokta boyut={6} />
            <Text style={styles.liveYazi}>STÜDYO</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="videocam" size={12} color={RenkTokenlari.mint} />
            <Text style={styles.metaYazi}>HD · anlık</Text>
          </View>
        </View>

        <View style={styles.sahne}>
          <LinearGradient
            colors={[
              `${RenkTokenlari.primary}38`,
              `${RenkTokenlari.violet}2E`,
              RenkTokenlari.pressFill,
            ]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.sahneIc}
          >
            <View style={styles.ikonHalka}>
              <Ionicons
                name="radio"
                size={30}
                color={RenkTokenlari.primarySoft}
              />
            </View>
            <Text style={styles.sahneBaslik}>Yayın sahnesi</Text>
            <Text style={styles.sahneAlt}>
              Başlık yaz — canlıya çıkınca kamera açılır
            </Text>
          </LinearGradient>
        </View>

        <TextField
          label="Yayın başlığı"
          value={title}
          onChangeText={onChangeTitle}
          placeholder={placeholder}
          maxLength={60}
        />
        <GradientButton
          title={loading ? 'Açılıyor…' : 'Canlıya çık'}
          onPress={onBaslat}
          loading={loading}
        />
        <View style={styles.ipucu}>
          <Ionicons name="flash" size={13} color={RenkTokenlari.primarySoft} />
          <Text style={styles.ipucuYazi}>
            Yayın anında başlar · izleyiciler seni listeden görür
          </Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: BoslukTokenlari.md,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RenkTokenlari.pressFill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.borderAccent,
  },
  liveYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  sahne: {
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  sahneIc: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  ikonHalka: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    marginBottom: 2,
  },
  sahneBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 18,
  },
  sahneAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  ipucu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 2,
  },
  ipucuYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    flex: 1,
    lineHeight: 16,
  },
});
