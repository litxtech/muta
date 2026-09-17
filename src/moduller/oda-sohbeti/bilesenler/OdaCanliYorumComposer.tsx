/**
 * Canlı oda yorum composer — dock ile aynı satırda, klavye üstüne çıkar.
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
import { OdaSohbetMesajiGonder } from '../../canli-sohbet/islemler/CanliSohbetIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  roomId: string;
  canSend: boolean;
  onNeedUpgrade?: () => void;
  onSent?: () => void;
  /** Composer odaklanınca (yorum paneli açmak için) */
  onFocus?: () => void;
};

export function OdaCanliYorumComposer({
  roomId,
  canSend,
  onNeedUpgrade,
  onSent,
  onFocus,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const upgradeIste = () => {
    onNeedUpgrade?.();
  };

  const gonder = async () => {
    if (!canSend) {
      upgradeIste();
      return;
    }
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setText('');
    const r = await OdaSohbetMesajiGonder({ roomId, body });
    setBusy(false);
    if (!r.ok) {
      setText(body);
      Alert.alert('Yorum gönderilemedi', r.hata || 'Bir hata oluştu. Tekrar dene.');
      return;
    }
    onSent?.();
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  if (!canSend) {
    return (
      <View style={styles.row}>
        <Pressable
          onPress={upgradeIste}
          style={styles.upgradeHit}
          accessibilityRole="button"
          accessibilityLabel="Hesabı tamamla — yorum yazmak için"
        >
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={RenkTokenlari.primarySoft}
          />
          <Text style={styles.upgradeYazi} numberOfLines={1}>
            Yorum yazmak için hesabı tamamla
          </Text>
        </Pressable>
        <Pressable
          onPress={upgradeIste}
          style={styles.send}
          accessibilityLabel="Hesabı tamamla"
        >
          <Ionicons name="person-add" size={18} color={RenkTokenlari.text} />
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
        placeholder="Bir şeyler yaz…"
        placeholderTextColor={RenkTokenlari.textDim}
        style={styles.input}
        maxLength={500}
        editable
        multiline
        blurOnSubmit={false}
        onFocus={onFocus}
        onSubmitEditing={() => void gonder()}
        returnKeyType="send"
        textAlignVertical="center"
      />
      <Pressable
        onPress={() => void gonder()}
        disabled={busy || !text.trim()}
        style={[styles.send, (busy || !text.trim()) && styles.sendDisabled]}
        accessibilityLabel="Gönder"
      >
        <Ionicons
          name="send"
          size={16}
          color={
            busy || !text.trim() ? RenkTokenlari.textDim : RenkTokenlari.text
          }
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
    gap: 6,
    minWidth: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: Platform.OS === 'android' ? 40 : 38,
    maxHeight: 80,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: RenkTokenlari.text,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 10 : 9,
    paddingBottom: Platform.OS === 'android' ? 10 : 9,
    ...TipografiTokenlari.body,
    fontSize: 14,
    lineHeight: 18,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  upgradeHit: {
    flex: 1,
    minWidth: 0,
    minHeight: Platform.OS === 'android' ? 40 : 38,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232, 64, 145, 0.28)',
    backgroundColor: 'rgba(232, 64, 145, 0.1)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upgradeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    flex: 1,
    fontWeight: '600',
    fontSize: 12,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  sendDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
});
