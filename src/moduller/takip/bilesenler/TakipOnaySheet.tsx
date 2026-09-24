import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import i18n from '../../../i18n';
import { useCeviri } from '../../../i18n/useCeviri';

export function TakipOnaySheet({
  visible,
  username,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  username?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useCeviri();
  const handle = username ? `@${username}` : t('takip.buKullaniciyi');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t('takip.takiptenCik')}</Text>
          <Text style={styles.body}>
            {t('takip.takiptenCikSoru', { ad: handle })}
          </Text>
          <Pressable
            style={styles.danger}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={t('takip.takiptenCik')}
          >
            <Text style={styles.dangerYazi}>{t('takip.takiptenCikBtn')}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelYazi}>{t('ortak.iptal')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function takiptenCikOnayi(
  username: string | null | undefined,
  onConfirm: () => void,
) {
  const handle = username ? `@${username}` : i18n.t('takip.buKullaniciyi');
  Alert.alert(
    i18n.t('takip.takiptenCik'),
    i18n.t('takip.takiptenCikSoru', { ad: handle }),
    [
      { text: i18n.t('ortak.iptal'), style: 'cancel' },
      { text: i18n.t('takip.takiptenCikBtn'), style: 'destructive', onPress: onConfirm },
    ],
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  body: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  danger: {
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.danger,
    alignItems: 'center',
  },
  dangerYazi: { ...TipografiTokenlari.body, color: '#fff', fontWeight: '800' },
  cancel: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelYazi: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted, fontWeight: '700' },
});
