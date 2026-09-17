import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TakipSayaciniFormatla } from '../TakipSayacFormat';

type Props = {
  posts: number;
  followers: number;
  following: number;
  onPosts?: () => void;
  onFollowers?: () => void;
  onFollowing?: () => void;
};

function Hucre({
  n,
  label,
  onPress,
}: {
  n: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${TakipSayaciniFormatla(n)} ${label}`}
      style={({ pressed }) => [styles.hucre, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={styles.n}>{TakipSayaciniFormatla(n)}</Text>
      <Text style={styles.l}>{label}</Text>
    </Pressable>
  );
}

export function TakipSayaclari({
  posts,
  followers,
  following,
  onPosts,
  onFollowers,
  onFollowing,
}: Props) {
  return (
    <View style={styles.row}>
      <Hucre n={posts} label="Gönderi" onPress={onPosts} />
      <View style={styles.div} />
      <Hucre n={followers} label="Takipçi" onPress={onFollowers} />
      <View style={styles.div} />
      <Hucre n={following} label="Takip" onPress={onFollowing} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: BoslukTokenlari.lg,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  hucre: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  pressed: { opacity: 0.7 },
  n: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  l: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 2,
  },
  div: {
    width: 1,
    height: 28,
    backgroundColor: RenkTokenlari.border,
  },
});

void LinearGradient;
