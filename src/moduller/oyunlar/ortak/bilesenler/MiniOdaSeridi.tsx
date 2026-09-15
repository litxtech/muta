/**
 * Mini oda şeridi — oda adı, kişi sayısı, mikrofon ipucu.
 * Oyun sırasında ses odası bağlantısını kesmez.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { RoomGameMeta } from '../tipler/OyunTipleri';

type Props = {
  meta: RoomGameMeta;
  onPress?: () => void;
};

export function MiniOdaSeridi({ meta, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <View style={styles.dot} />
      <Text style={styles.name} numberOfLines={1}>
        {meta.roomName}
      </Text>
      <Text style={styles.meta}>{meta.participantCount} kişi</Text>
      <Text style={styles.mic}>
        {meta.micEnabled ? 'Mikrofon açık' : 'Mikrofon kapalı'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    backgroundColor: RenkTokenlari.bgGlass,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.live,
  },
  name: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    flexShrink: 1,
    maxWidth: 140,
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  mic: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.micOn,
    marginLeft: 'auto',
  },
});
