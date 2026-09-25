import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MesajLinkOnizleme } from '../okuma/MesajlariGetir';
import { mesajKartCamStil, MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { MedyaUriGuvenli } from '../yardimcilar/MedyaUriGecerliMi';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  preview: MesajLinkOnizleme;
  url?: string | null;
  mine: boolean;
};

export function MesajLinkOnizlemeKarti({ preview, url, mine }: Props) {
  const { t } = useCeviri();
  const hedef = url || preview.url;
  const img = MedyaUriGuvenli(preview.image_url);
  const metinRenk = mine
    ? MesajKartTokenlari.textMine
    : MesajKartTokenlari.textTheirs;
  const muted = mine
    ? MesajKartTokenlari.mutedMine
    : MesajKartTokenlari.mutedTheirs;

  return (
    <Pressable
      onPress={() => {
        if (hedef) void Linking.openURL(hedef);
      }}
      style={[styles.kart, mesajKartCamStil(mine)]}
      accessibilityRole="link"
      accessibilityLabel={t('mesajV2.linkPreviewA11y')}
    >
      {img ? <Image source={{ uri: img }} style={styles.img} /> : null}
      <View style={styles.govde}>
        {preview.site_name ? (
          <Text style={[styles.site, { color: muted }]} numberOfLines={1}>
            {preview.site_name}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: metinRenk }]} numberOfLines={2}>
          {preview.title || hedef || t('mesajV2.linkPreviewA11y')}
        </Text>
        {preview.description ? (
          <Text style={[styles.desc, { color: muted }]} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    overflow: 'hidden',
    padding: 0,
  },
  img: {
    width: '100%',
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  govde: {
    padding: MesajKartTokenlari.padding,
    gap: 4,
  },
  site: {
    ...TipografiTokenlari.micro,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    fontSize: 14,
  },
  desc: {
    ...TipografiTokenlari.caption,
  },
});
