import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

export type MesajMenuAksiyon =
  | 'reply'
  | 'edit'
  | 'pin'
  | 'unpin'
  | 'copy'
  | 'delete_me'
  | 'delete_everyone'
  | 'report'
  | 'retry';

type AksiyonTanimi = {
  id: MesajMenuAksiyon;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  aksiyonlar: MesajMenuAksiyon[];
  onSec: (aksiyon: MesajMenuAksiyon) => void;
};

const META: Record<MesajMenuAksiyon, AksiyonTanimi> = {
  reply: { id: 'reply', icon: 'arrow-undo' },
  edit: { id: 'edit', icon: 'pencil' },
  pin: { id: 'pin', icon: 'pin' },
  unpin: { id: 'unpin', icon: 'pin-outline' },
  copy: { id: 'copy', icon: 'copy-outline' },
  delete_me: { id: 'delete_me', icon: 'trash-outline', destructive: true },
  delete_everyone: {
    id: 'delete_everyone',
    icon: 'trash',
    destructive: true,
  },
  report: { id: 'report', icon: 'flag-outline', destructive: true },
  retry: { id: 'retry', icon: 'refresh' },
};

function etiket(
  id: MesajMenuAksiyon,
  t: (k: any) => string,
): string {
  switch (id) {
    case 'reply':
      return t('mesajV2.reply');
    case 'edit':
      return t('mesajV2.edit');
    case 'pin':
      return t('mesajV2.pin');
    case 'unpin':
      return t('mesajV2.unpin');
    case 'copy':
      return t('mesajV2.copy');
    case 'delete_me':
      return t('mesajSohbet.bendenSil');
    case 'delete_everyone':
      return t('mesajSohbet.herkestenSil');
    case 'report':
      return t('mesajV2.report');
    case 'retry':
      return t('mesajV2.retry');
    default:
      return id;
  }
}

export function MesajUzunBasMenu({
  visible,
  onClose,
  aksiyonlar,
  onSec,
}: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();

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
        <View style={styles.handle} />
        {aksiyonlar.map((id) => {
          const meta = META[id];
          return (
            <Pressable
              key={id}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() => {
                onClose();
                onSec(id);
              }}
              accessibilityRole="button"
              accessibilityLabel={etiket(id, t)}
            >
              <Ionicons
                name={meta.icon}
                size={20}
                color={
                  meta.destructive
                    ? RenkTokenlari.danger
                    : RenkTokenlari.text
                }
              />
              <Text
                style={[
                  styles.yazi,
                  meta.destructive && styles.yaziDanger,
                ]}
              >
                {etiket(id, t)}
              </Text>
            </Pressable>
          );
        })}
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
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.border,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowPressed: {
    backgroundColor: RenkTokenlari.pressFill,
  },
  yazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  yaziDanger: {
    color: RenkTokenlari.danger,
  },
  iptal: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 12,
  },
  iptalYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
