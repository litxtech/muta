import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { kullaniciTemaKodunuAl } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

type Props = {
  deger: string;
  onDegisti: (deger: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
};

const KUTU_H = 44;

/** Ana keşif arama — metin kutunun içinde ortalanır */
export function AnaSayfaAramaCubugu({
  deger,
  onDegisti,
  placeholder = 'İnsanları, odaları, etiketleri keşfet...',
  onSubmit,
}: Props) {
  useTemayaAboneOl();
  const acik = kullaniciTemaKodunuAl() === 'acik';

  return (
    <View
      style={[
        styles.dis,
        {
          backgroundColor: acik ? RenkTokenlari.bgGlass : RenkTokenlari.bgCard,
          borderColor: acik ? RenkTokenlari.border : 'rgba(139,92,246,0.22)',
          shadowOpacity: acik ? 0.06 : 0,
        },
      ]}
    >
      <View style={styles.wrap}>
        <View
          style={[
            styles.ikonKutu,
            { backgroundColor: 'rgba(232,64,145,0.12)' },
          ]}
        >
          <Ionicons name="search" size={16} color={RenkTokenlari.primarySoft} />
        </View>
        <TextInput
          value={deger}
          onChangeText={onDegisti}
          placeholder={placeholder}
          placeholderTextColor={RenkTokenlari.textDim}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
          underlineColorAndroid="transparent"
          onSubmitEditing={onSubmit}
          accessibilityLabel="Keşfet araması"
          {...(Platform.OS === 'android'
            ? { includeFontPadding: false }
            : null)}
        />
        {deger.length > 0 ? (
          <Pressable
            onPress={() => onDegisti('')}
            hitSlop={8}
            accessibilityLabel="Aramayı temizle"
            style={styles.temizle}
          >
            <Ionicons name="close-circle" size={18} color={RenkTokenlari.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    marginHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: StyleSheet.hairlineWidth,
    height: KUTU_H,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    height: KUTU_H,
  },
  ikonKutu: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: KUTU_H,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    color: RenkTokenlari.text,
    fontSize: 14,
    lineHeight: Platform.OS === 'ios' ? 18 : undefined,
    fontWeight: '500',
  },
  temizle: {
    height: KUTU_H,
    justifyContent: 'center',
  },
});
