import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { YonluIkon } from './YonluIkon';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  GolgeTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
  last?: boolean;
};

/** Ayarlar / profil menü satırı */
export function ListeSatiri({
  icon,
  label,
  value,
  onPress,
  danger,
  showChevron = true,
  last,
}: Props) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.iconWrap, danger && styles.iconDanger]}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? RenkTokenlari.danger : RenkTokenlari.primarySoft}
        />
      </View>
      <Text style={[styles.label, danger && styles.labelDanger]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && showChevron ? (
        <YonluIkon yon="chevron-forward" size={16} color={RenkTokenlari.textDim} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

type GrupProps = {
  title?: string;
  children: React.ReactNode;
};

export function ListeGrubu({ title, children }: GrupProps) {
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.md,
    ...GolgeTokenlari.card,
  },
  groupTitle: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    paddingHorizontal: BoslukTokenlari.sm,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: YaricapTokenlari.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 64, 145, 0.12)',
  },
  iconDanger: {
    backgroundColor: 'rgba(232, 75, 106, 0.14)',
  },
  label: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
    minWidth: 0,
  },
  labelDanger: {
    color: RenkTokenlari.danger,
  },
  value: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    maxWidth: '40%',
    textAlign: 'right',
  },
});
