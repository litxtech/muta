import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  deger: string;
  onDegisti: (deger: string) => void;
  placeholder?: string;
};

/** Keşfet — oda/yayıncı arama çubuğu */
export function KesfetAramaCubugu({
  deger,
  onDegisti,
  placeholder,
}: Props) {
  const { t } = useCeviri();
  const placeholderYazi = placeholder ?? t('kesfet.aramaPlaceholder');
  return (
    <View style={styles.dis}>
      <LinearGradient
        colors={['rgba(232,64,145,0.16)', 'rgba(139,92,246,0.08)', RenkTokenlari.bgElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.wrap}
      >
        <View style={styles.ikonKutu}>
          <Ionicons name="search" size={16} color={RenkTokenlari.primarySoft} />
        </View>
        <TextInput
          value={deger}
          onChangeText={onDegisti}
          placeholder={placeholderYazi}
          placeholderTextColor={RenkTokenlari.textDim}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={t('kesfetX.aramaA11y')}
        />
        {deger.length > 0 ? (
          <Pressable
            onPress={() => onDegisti('')}
            hitSlop={8}
            accessibilityLabel={t('kesfetX.aramaTemizle')}
          >
            <Ionicons name="close-circle" size={18} color={RenkTokenlari.textMuted} />
          </Pressable>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    marginHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.28)',
    overflow: 'hidden',
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 48,
  },
  ikonKutu: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.14)',
  },
  input: {
    ...TipografiTokenlari.body,
    flex: 1,
    color: RenkTokenlari.text,
    paddingVertical: 10,
  },
});
