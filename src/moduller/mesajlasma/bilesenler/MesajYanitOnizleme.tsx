import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DirektMesaj } from '../okuma/MesajlariGetir';
import { mesajKartCamStil, MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { fizikselHiza } from '../../../i18n/rtl';
import { MesajYanitOzetMetin } from '../yardimcilar/MesajYanitOzetMetin';

type Props = {
  replyTo: DirektMesaj | null;
  /** Yanıtlanan mesajın yazarı (kısa önizleme etiketi) */
  yazarAdi?: string | null;
  onKapat: () => void;
};

/** Composer üstü yanıt cam kartı — kısa içerik önizlemesi */
export function MesajYanitOnizleme({ replyTo, yazarAdi, onKapat }: Props) {
  const { t } = useCeviri();
  if (!replyTo) return null;
  const hiza = fizikselHiza('start');
  const ad = (yazarAdi ?? '').trim();
  const ozet = MesajYanitOzetMetin(replyTo, t as (k: string) => string);

  return (
    <View style={[styles.wrap, hiza, mesajKartCamStil(false)]}>
      <View style={styles.bar} />
      <View style={styles.govde}>
        <Text style={styles.etiket} numberOfLines={1}>
          {ad
            ? t('mesajV2.replyTo', { ad })
            : t('mesajV2.reply')}
        </Text>
        <Text style={styles.metin} numberOfLines={1}>
          {ozet}
        </Text>
      </View>
      <Pressable
        onPress={onKapat}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('mesajV2.cancelReply')}
      >
        <Ionicons name="close" size={18} color={MesajKartTokenlari.mutedTheirs} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
  },
  bar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: MesajKartTokenlari.accent,
    marginRight: 8,
  },
  govde: { flex: 1, gap: 2, minWidth: 0 },
  etiket: {
    ...TipografiTokenlari.micro,
    color: MesajKartTokenlari.accentSoft,
    fontWeight: '700',
  },
  metin: {
    ...TipografiTokenlari.caption,
    color: MesajKartTokenlari.textTheirs,
  },
});
