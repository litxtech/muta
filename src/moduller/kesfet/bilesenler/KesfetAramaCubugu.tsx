import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  deger: string;
  onDegisti: (deger: string) => void;
  placeholder?: string;
};

/** Keşfet — oda/yayıncı arama çubuğu */
export function KesfetAramaCubugu({
  deger,
  onDegisti,
  placeholder = 'Oda, konu veya yayıncı ara',
}: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={17} color={RenkTokenlari.textDim} />
      <TextInput
        value={deger}
        onChangeText={onDegisti}
        placeholder={placeholder}
        placeholderTextColor={RenkTokenlari.textDim}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel="Keşfet araması"
      />
      {deger.length > 0 ? (
        <Pressable onPress={() => onDegisti('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
          <Ionicons name="close-circle" size={18} color={RenkTokenlari.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    marginHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    minHeight: 44,
  },
  input: {
    ...TipografiTokenlari.body,
    flex: 1,
    color: RenkTokenlari.text,
    paddingVertical: 10,
  },
});
