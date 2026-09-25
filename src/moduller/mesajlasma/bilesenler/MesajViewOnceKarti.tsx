import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DirektMesaj } from '../okuma/MesajlariGetir';
import { MesajViewOnceAc } from '../islemler/MesajViewOnceAc';
import { mesajKartCamStil, MesajKartTokenlari } from '../tasarim/MesajKartTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  item: DirektMesaj;
  mine: boolean;
  onAcildi?: (uri: string, tur: 'image' | 'video') => void;
  onLongPress?: () => void;
  onDurumGuncelle?: (patch: Partial<DirektMesaj>) => void;
};

export function MesajViewOnceKarti({
  item,
  mine,
  onAcildi,
  onLongPress,
  onDurumGuncelle,
}: Props) {
  const { t } = useCeviri();
  const [busy, setBusy] = useState(false);
  const consumed = !!item.view_once_opened_at;
  const isVideo = item.message_type === 'video';
  const metinRenk = mine
    ? MesajKartTokenlari.textMine
    : MesajKartTokenlari.textTheirs;

  const ac = () => {
    if (busy || consumed) return;
    void (async () => {
      setBusy(true);
      const r = await MesajViewOnceAc(item.id);
      setBusy(false);
      if (!r.ok) return;
      const s = r.sonuc;
      if (s.state === 'CONSUMED' || s.state === 'UNAVAILABLE') {
        onDurumGuncelle?.({
          view_once_opened_at: s.opened_at ?? new Date().toISOString(),
          view_once_opened_by: 'opened_by' in s ? s.opened_by : null,
        });
        return;
      }
      if (
        (s.state === 'OPENING' || s.state === 'AVAILABLE') &&
        s.media_url
      ) {
        if (s.state === 'OPENING') {
          onDurumGuncelle?.({
            view_once_opened_at: s.opened_at ?? new Date().toISOString(),
          });
        }
        onAcildi?.(s.media_url, isVideo ? 'video' : 'image');
      }
    })();
  };

  return (
    <Pressable
      onPress={ac}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={[styles.kart, mesajKartCamStil(mine)]}
      accessibilityRole="button"
      accessibilityLabel={t('mesajV2.tapToView')}
    >
      <View style={styles.iconWrap}>
        {busy ? (
          <ActivityIndicator color={RenkTokenlari.mint} />
        ) : (
          <Ionicons
            name={
              consumed
                ? 'eye-off'
                : isVideo
                  ? 'videocam'
                  : 'image'
            }
            size={28}
            color={metinRenk}
          />
        )}
      </View>
      <Text style={[styles.yazi, { color: metinRenk }]}>
        {consumed
          ? t('mesajV2.opened')
          : mine
            ? t('mesajV2.viewOnce')
            : t('mesajV2.tapToView')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kart: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  yazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '700',
  },
});
