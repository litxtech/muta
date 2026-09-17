import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

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
  const handle = username ? `@${username}` : 'bu kullanıcıyı';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Takipten çık</Text>
          <Text style={styles.body}>
            {handle} kullanıcısını takipten çıkarmak istiyor musun?
          </Text>
          <Pressable
            style={styles.danger}
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel="Takipten çık"
          >
            <Text style={styles.dangerYazi}>Takipten Çık</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelYazi}>İptal</Text>
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
  const handle = username ? `@${username}` : 'bu kullanıcıyı';
  Alert.alert(
    'Takipten çık',
    `${handle} kullanıcısını takipten çıkarmak istiyor musun?`,
    [
      { text: 'İptal', style: 'cancel' },
      { text: 'Takipten Çık', style: 'destructive', onPress: onConfirm },
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
