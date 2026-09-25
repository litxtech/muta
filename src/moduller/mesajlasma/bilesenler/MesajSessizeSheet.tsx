import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  visible: boolean;
  onClose: () => void;
  mutedUntil?: string | null;
  onMute: (opts: { minutes?: number; forever?: boolean }) => void;
  onUnmute: () => void;
};

const SURELER: {
  minutes?: number;
  forever?: boolean;
  label: 'mesajV2.mute1h' | 'mesajV2.mute8h' | 'mesajV2.mute1d' | 'mesajV2.muteForever';
}[] = [
  { minutes: 60, label: 'mesajV2.mute1h' },
  { minutes: 480, label: 'mesajV2.mute8h' },
  { minutes: 1440, label: 'mesajV2.mute1d' },
  { forever: true, label: 'mesajV2.muteForever' },
];

export function MesajSessizeSheet({
  visible,
  onClose,
  mutedUntil,
  onMute,
  onUnmute,
}: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const muted = !!mutedUntil;

  return (
    <TamusoModal
      visible={visible}
      onClose={onClose}
      placement="bottom"
      animationType="slide"
    >
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Text style={styles.baslik}>
          {muted ? t('mesajV2.unmute') : t('mesajV2.muteNotifications')}
        </Text>
        {muted ? (
          <Pressable
            style={styles.row}
            onPress={() => {
              onClose();
              onUnmute();
            }}
          >
            <Text style={styles.yazi}>{t('mesajV2.unmute')}</Text>
          </Pressable>
        ) : (
          SURELER.map((s) => (
            <Pressable
              key={s.label}
              style={styles.row}
              onPress={() => {
                onClose();
                onMute({ minutes: s.minutes, forever: s.forever });
              }}
            >
              <Text style={styles.yazi}>{t(s.label)}</Text>
            </Pressable>
          ))
        )}
        <Pressable style={styles.iptal} onPress={onClose}>
          <Text style={styles.iptalYazi}>{t('mesajV2.cancel')}</Text>
        </Pressable>
      </View>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: RenkTokenlari.bgCard,
    borderTopLeftRadius: YaricapTokenlari.lg,
    borderTopRightRadius: YaricapTokenlari.lg,
    paddingTop: 16,
    paddingHorizontal: 14,
    gap: 4,
  },
  baslik: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: RenkTokenlari.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  yazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  iptal: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  iptalYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
