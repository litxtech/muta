import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '../../../components/TextField';
import { GradientButton } from '../../../components/GradientButton';
import { CanliKameraOnizleme } from './CanliKameraOnizleme';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  title: string;
  onChangeTitle: (v: string) => void;
  onBaslat: () => void;
  loading?: boolean;
  placeholder?: string;
  /** Kamera önizleme (prewarm) */
  kameraOnizleme?: boolean;
};

/** Canlıya çık öncesi stüdyo — kamera preview + minimal form */
export function CanliYayinStudioKarti({
  title,
  onChangeTitle,
  onBaslat,
  loading,
  placeholder,
  kameraOnizleme = true,
}: Props) {
  const { t } = useCeviri();
  return (
    <View style={styles.wrap}>
      <View style={styles.onizleme}>
        <CanliKameraOnizleme aktif={kameraOnizleme} facing="front" />
      </View>

      <View style={styles.form}>
        <Text style={styles.etiket}>{t('canliYayin.yayinBasligi')}</Text>
        <TextField
          label=""
          value={title}
          onChangeText={onChangeTitle}
          placeholder={placeholder ?? t('canliYayin.placeholder')}
          maxLength={60}
        />
        <GradientButton
          title={loading ? t('canliYayin.hazirlaniyor') : t('canliYayin.baslat')}
          onPress={onBaslat}
          loading={loading}
          disabled={loading}
        />
        <View style={styles.ipucu}>
          <Ionicons name="flash" size={13} color={RenkTokenlari.primarySoft} />
          <Text style={styles.ipucuYazi}>{t('canliYayin.ipucu')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.md,
  },
  onizleme: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  form: {
    gap: BoslukTokenlari.sm,
    paddingHorizontal: 2,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginBottom: -4,
  },
  ipucu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 2,
  },
  ipucuYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    flex: 1,
    lineHeight: 16,
  },
});
