import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../i18n/useCeviri';

type Props = {
  title: string;
  loading?: boolean;
  progress?: number;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onClose: () => void;
  onMenu?: () => void;
};

export function TamusoWebViewHeader({
  title,
  loading,
  progress = 0,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  onClose,
  onMenu,
}: Props) {
  const { t } = useCeviri();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ortak.kapat')}
          onPress={onClose}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Ionicons name="close" size={22} color={RenkTokenlari.text} />
        </Pressable>

        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ortak.geri')}
            onPress={onBack}
            disabled={!canGoBack}
            style={[styles.iconBtn, !canGoBack && styles.disabled]}
          >
            <Ionicons name="chevron-back" size={22} color={RenkTokenlari.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('ortak.ileri')}
            onPress={onForward}
            disabled={!canGoForward}
            style={[styles.iconBtn, !canGoForward && styles.disabled]}
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={RenkTokenlari.text}
            />
          </Pressable>
        </View>

        <Text style={styles.title} numberOfLines={1}>
          {title || 'Tamuso'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ortak.yenile')}
          onPress={onReload}
          style={styles.iconBtn}
        >
          {loading ? (
            <ActivityIndicator size="small" color={RenkTokenlari.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={RenkTokenlari.text} />
          )}
        </Pressable>

        {onMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('anaSayfa.menu')}
            onPress={onMenu}
            style={styles.iconBtn}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={RenkTokenlari.text}
            />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressBar,
            { width: `${Math.min(100, Math.max(0, progress * 100))}%` },
            !loading && progress >= 1 ? styles.progressDone : null,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: RenkTokenlari.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.sm,
    paddingVertical: 8,
    gap: 4,
  },
  nav: {
    flexDirection: 'row',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressBar: {
    height: 2,
    backgroundColor: RenkTokenlari.primary,
  },
  progressDone: {
    opacity: 0,
  },
});
