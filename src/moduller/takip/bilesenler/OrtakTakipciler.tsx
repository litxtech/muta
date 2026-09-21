import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { OrtakTakipciOzeti } from '../TakipTipleri';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

export function OrtakTakipciler({ ozet }: { ozet: OrtakTakipciOzeti | null }) {
  if (!ozet || ozet.count <= 0) return null;
  const adlar = ozet.previews
    .map((p) => p.display_name?.trim())
    .filter(Boolean)
    .slice(0, 2);
  const kalan = Math.max(0, ozet.count - adlar.length);
  let yazi = '';
  if (adlar.length === 0) {
    yazi = `${ozet.count} takip ettiğin kişi takip ediyor`;
  } else if (kalan <= 0) {
    yazi =
      adlar.length === 1
        ? `${adlar[0]} takip ediyor`
        : `${adlar[0]} ve ${adlar[1]} takip ediyor`;
  } else {
    yazi = `${adlar.join(', ')} ve ${kalan} kişi daha takip ediyor`;
  }

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={yazi}>
      <View style={styles.avatars}>
        {ozet.previews.slice(0, 3).map((p, i) => {
          const avatar = MedyaUriGuvenli(p.avatar_url);
          return avatar ? (
            <Image
              key={p.user_id}
              source={{ uri: avatar }}
              style={[styles.av, { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}
            />
          ) : (
            <View
              key={p.user_id}
              style={[styles.av, styles.bos, { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}
            >
              <Text style={styles.harf}>
                {(p.display_name || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.yazi} numberOfLines={2}>
        {yazi}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.md,
    width: '100%',
    paddingHorizontal: BoslukTokenlari.sm,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  av: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.bg,
  },
  bos: {
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    ...TipografiTokenlari.caption,
    fontSize: 9,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
});
