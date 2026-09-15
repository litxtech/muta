/**
 * 6 haneli OTP giriş alanı.
 */

import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputKeyPressEventData,
  type NativeSyntheticEvent,
} from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  value: string;
  onChange: (kod: string) => void;
  autoFocus?: boolean;
  hataMi?: boolean;
};

const HANE = 6;

export function AltiHaneliKodAlani({
  value,
  onChange,
  autoFocus = true,
  hataMi = false,
}: Props) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = value.replace(/\D/g, '').slice(0, HANE).split('');
  while (digits.length < HANE) digits.push('');

  const yaz = (index: number, char: string) => {
    const temiz = char.replace(/\D/g, '');
    if (temiz.length > 1) {
      // Yapıştırma
      const hep = temiz.slice(0, HANE);
      onChange(hep);
      const hedef = Math.min(hep.length, HANE - 1);
      refs.current[hedef]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = temiz.slice(-1);
    const birlesik = next.join('').replace(/\s/g, '');
    onChange(birlesik);
    if (temiz && index < HANE - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const sil = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (digits[index]) {
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }
    if (index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      onChange(next.join(''));
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <Pressable
          key={i}
          onPress={() => refs.current[i]?.focus()}
          style={[styles.hane, hataMi && styles.haneHata, d ? styles.haneDolu : null]}
        >
          <TextInput
            ref={(r) => {
              refs.current[i] = r;
            }}
            value={d}
            onChangeText={(t) => yaz(i, t)}
            onKeyPress={(e) => sil(i, e)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={i === 0 ? HANE : 1}
            style={styles.input}
            autoFocus={autoFocus && i === 0}
            selectTextOnFocus
            caretHidden
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  hane: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 52,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haneDolu: {
    borderColor: RenkTokenlari.primarySoft,
  },
  haneHata: {
    borderColor: RenkTokenlari.danger,
  },
  input: {
    ...TipografiTokenlari.h1,
    width: '100%',
    textAlign: 'center',
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 22,
    padding: 0,
  },
});
