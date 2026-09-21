import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  PaylasilanDurumMesaji,
  type PaylasilanDurumAvailability,
} from '../tipler';

type Props = {
  availability: PaylasilanDurumAvailability;
  message?: string | null;
  mine?: boolean;
};

function SilinmisGonderiKartiIc({ availability, message, mine }: Props) {
  const metin = PaylasilanDurumMesaji(availability, message);
  return (
    <View style={[styles.kart, mine ? styles.mine : styles.theirs]}>
      <View style={styles.baslik}>
        <Ionicons
          name="ellipse-outline"
          size={16}
          color={RenkTokenlari.textDim}
        />
        <Text style={styles.baslikYazi}>Gönderiye ulaşılamıyor</Text>
      </View>
      <Text style={styles.govde}>{metin}</Text>
    </View>
  );
}

export const SilinmisGonderiKarti = memo(SilinmisGonderiKartiIc);

const styles = StyleSheet.create({
  kart: {
    maxWidth: 268,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: RenkTokenlari.bgCard,
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  baslik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  baslikYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  govde: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    lineHeight: 18,
    paddingLeft: BoslukTokenlari.lg + 4,
  },
});

/** Pressable sarmalayıcı — silinmiş karta dokununca detay açılmaz */
export function SilinmisGonderiKartiPressable(
  props: Props & { onLongPress?: () => void },
) {
  return (
    <Pressable onLongPress={props.onLongPress} delayLongPress={300}>
      <SilinmisGonderiKarti {...props} />
    </Pressable>
  );
}
