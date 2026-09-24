/**
 * Canlı yayın yorum composer — klavye üstüne çıkar (alt bar ile).
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CanliYayinSohbetMesajiGonder } from '../../canli-sohbet/islemler/CanliSohbetIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  sessionId: string;
  canSend: boolean;
  onNeedUpgrade?: () => void;
  onSent?: () => void;
  placeholder?: string;
};

export function CanliYorumComposer({
  sessionId,
  canSend,
  onNeedUpgrade,
  onSent,
  placeholder,
}: Props) {
  const { t } = useCeviri();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const gonder = async () => {
    if (!canSend) {
      onNeedUpgrade?.();
      return;
    }
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setText('');
    const r = await CanliYayinSohbetMesajiGonder({ sessionId, body });
    setBusy(false);
    if (!r.ok) {
      setText(body);
      Alert.alert(t('canliYayin.yorum'), r.hata || t('canliYayin.gonderilemedi'));
      return;
    }
    onSent?.();
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  if (!canSend) {
    return (
      <View style={styles.row}>
        <Pressable onPress={() => onNeedUpgrade?.()} style={styles.upgradeHit}>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={RenkTokenlari.primarySoft}
          />
          <Text style={styles.upgradeYazi} numberOfLines={1}>
            {t('canliYayin.yorumHesap')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        placeholder={placeholder ?? t('canliYayin.yorumEkle')}
        placeholderTextColor="rgba(255,255,255,0.55)"
        style={styles.input}
        maxLength={500}
        editable
        multiline
        blurOnSubmit={false}
        onSubmitEditing={() => void gonder()}
        returnKeyType="send"
        textAlignVertical="center"
        keyboardAppearance="dark"
        selectionColor="#FFFFFF"
        cursorColor="#FFFFFF"
      />
      <Pressable
        onPress={() => void gonder()}
        disabled={busy || !text.trim()}
        style={[styles.send, (busy || !text.trim()) && styles.sendDisabled]}
        accessibilityLabel={t('ortak.gonder')}
      >
        <Ionicons
          name="send"
          size={18}
          color={busy || !text.trim() ? 'rgba(255,255,255,0.35)' : '#FFFFFF'}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minWidth: 0,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 9,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    ...TipografiTokenlari.body,
    fontSize: 15,
  },
  upgradeHit: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    flex: 1,
    fontWeight: '600',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  sendDisabled: {
    backgroundColor: RenkTokenlari.surface,
  },
});
