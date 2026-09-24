import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useCeviri, type CeviriAnahtari } from '../../src/i18n/useCeviri';
import { useAuth } from '../../src/contexts/AuthContext';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const SEBEPLER: { id: string; key: CeviriAnahtari }[] = [
  { id: 'kullanmiyorum', key: 'hesapSil.sebepKullanmiyorum' },
  { id: 'gizlilik', key: 'hesapSil.sebepGizlilik' },
  { id: 'baska', key: 'hesapSil.sebepBaskaHesap' },
  { id: 'spam', key: 'hesapSil.sebepSpam' },
  { id: 'diger', key: 'hesapSil.sebepDiger' },
];

const MADDELER: CeviriAnahtari[] = [
  'hesapSil.madde1',
  'hesapSil.madde2',
  'hesapSil.madde3',
  'hesapSil.madde4',
  'hesapSil.madde5',
  'hesapSil.madde6',
  'hesapSil.madde7',
  'hesapSil.madde8',
];

/**
 * Apple / Google uyumlu hesap silme ekrani
 * Soft delete + mumkunse auth hard delete
 */
export default function HesapSilEkrani() {
  const { t, dil } = useCeviri();
  const { isGuest, user, deleteAccount } = useAuth();
  const [sebepId, setSebepId] = useState<string | null>(null);
  const [onay, setOnay] = useState('');
  const [busy, setBusy] = useState(false);

  const onayKelime = t('hesapSil.onayKelime');
  const onayHazir = useMemo(() => {
    const locale = dil === 'tr' ? 'tr-TR' : undefined;
    return onay.trim().toLocaleUpperCase(locale) === onayKelime.toLocaleUpperCase(locale);
  }, [onay, onayKelime, dil]);

  if (isGuest) {
    return (
      <Screen edges={['top']}>
        <EkranBasligi
          title={t('hesapSil.baslik')}
          subtitle={t('hesapSil.misafirAlt')}
          fallbackHref={'/profil-ayarlar' as any}
        />
        <View style={styles.pad}>
          <Text style={styles.body}>{t('hesapSil.misafirBody')}</Text>
          <Pressable
            style={styles.secondary}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.secondaryText}>{t('hesapSil.girisEkraninaDon')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const sil = () => {
    if (!sebepId) {
      Alert.alert(t('hesapSil.sebepBaslik'), t('hesapSil.sebepSec'));
      return;
    }
    if (!onayHazir) {
      Alert.alert(
        t('hesapSil.onayBaslik'),
        t('hesapSil.onayYaz', { kelime: onayKelime }),
      );
      return;
    }

    const sebepLabel =
      t(SEBEPLER.find((s) => s.id === sebepId)!.key);

    Alert.alert(t('hesapSil.sonOnay'), t('hesapSil.sonOnayMesaj'), [
      { text: t('ortak.vazgec'), style: 'cancel' },
      {
        text: t('hesapSil.hesabimiSil'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const r = await deleteAccount(sebepLabel);
            setBusy(false);
            if (r.error) {
              Alert.alert(t('hesapSil.silinemedi'), r.error);
              return;
            }
            Alert.alert(t('hesapSil.silindi'), t('hesapSil.silindiMesaj'), [
              {
                text: t('ortak.tamam'),
                onPress: () => router.replace('/(auth)/login'),
              },
            ]);
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <EkranBasligi
        title={t('hesapSil.baslik')}
        subtitle={t('hesapSil.altBaslik')}
        fallbackHref={'/profil-ayarlar' as any}
      />
      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warn}>
          <Ionicons name="warning" size={22} color={RenkTokenlari.danger} />
          <Text style={styles.warnText}>{t('hesapSil.uyariKalici')}</Text>
        </View>

        <View style={[styles.warn, styles.warnIade]}>
          <Ionicons name="card-outline" size={22} color={RenkTokenlari.danger} />
          <Text style={styles.warnText}>{t('hesapSil.uyariIade')}</Text>
        </View>

        <Text style={styles.label}>{t('hesapSil.hesapEtiket')}</Text>
        <Text style={styles.meta}>{user?.email ?? t('hesapSil.kayitliHesap')}</Text>

        <Text style={styles.label}>{t('hesapSil.nedenSiliyorsun')}</Text>
        {SEBEPLER.map((s) => {
          const label = t(s.key);
          return (
            <Pressable
              key={s.id}
              style={[styles.chip, sebepId === s.id && styles.chipAktif]}
              onPress={() => setSebepId(s.id)}
            >
              <Text
                style={[styles.chipText, sebepId === s.id && styles.chipTextAktif]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        <Text style={styles.label}>
          {t('hesapSil.onaylamakIcin', { kelime: onayKelime })}
        </Text>
        <TextInput
          value={onay}
          onChangeText={setOnay}
          placeholder={onayKelime}
          placeholderTextColor={RenkTokenlari.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          editable={!busy}
        />

        <View style={styles.liste}>
          {MADDELER.map((key) => (
            <View key={key} style={styles.listeSatir}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={RenkTokenlari.textMuted}
              />
              <Text style={styles.listeText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[
            styles.dangerBtn,
            (!onayHazir || !sebepId || busy) && styles.dangerDisabled,
          ]}
          disabled={!onayHazir || !sebepId || busy}
          onPress={sil}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerBtnText}>{t('hesapSil.kaliciSil')}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondary}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>{t('ortak.vazgec')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.sm,
  },
  warn: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(232, 64, 100, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 100, 0.35)',
    marginBottom: BoslukTokenlari.md,
  },
  warnIade: {
    backgroundColor: 'rgba(232, 64, 100, 0.08)',
  },
  warnText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
    lineHeight: 20,
  },
  label: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginTop: BoslukTokenlari.md,
    marginBottom: 4,
  },
  meta: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    marginBottom: BoslukTokenlari.sm,
  },
  body: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
  chip: {
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
    marginBottom: 6,
  },
  chipAktif: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
  },
  chipText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  chipTextAktif: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    borderRadius: YaricapTokenlari.md,
    color: RenkTokenlari.text,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    ...TipografiTokenlari.body,
    letterSpacing: 2,
    fontWeight: '800',
  },
  liste: {
    marginTop: BoslukTokenlari.lg,
    gap: 8,
    marginBottom: BoslukTokenlari.lg,
  },
  listeSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listeText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
  dangerBtn: {
    backgroundColor: RenkTokenlari.danger,
    borderRadius: YaricapTokenlari.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: BoslukTokenlari.sm,
  },
  dangerDisabled: { opacity: 0.4 },
  dangerBtnText: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.lg,
  },
  secondaryText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
