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
import { useAuth } from '../../src/contexts/AuthContext';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const SEBEPLER = [
  'Uygulamayı artık kullanmıyorum',
  'Gizlilik endişesi',
  'Başka hesap kullanacağım',
  'Spam / rahatsız edici içerik',
  'Diğer',
] as const;

const ONAY_KELIME = 'SİL';

/**
 * Apple / Google uyumlu hesap silme ekrani
 * Soft delete + mumkunse auth hard delete
 */
export default function HesapSilEkrani() {
  const { isGuest, user, deleteAccount } = useAuth();
  const [sebep, setSebep] = useState<string | null>(null);
  const [onay, setOnay] = useState('');
  const [busy, setBusy] = useState(false);

  const onayHazir = useMemo(
    () => onay.trim().toLocaleUpperCase('tr-TR') === ONAY_KELIME,
    [onay],
  );

  if (isGuest) {
    return (
      <Screen edges={['top']}>
        <EkranBasligi
          title="Hesabı sil"
          subtitle="Misafir oturumu"
          fallbackHref={'/profil-ayarlar' as any}
        />
        <View style={styles.pad}>
          <Text style={styles.body}>
            Misafir hesapta silinecek kalıcı veri yok. Önce hesabını tamamla veya
            çıkış yap.
          </Text>
          <Pressable
            style={styles.secondary}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.secondaryText}>Giriş ekranına dön</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const sil = () => {
    if (!sebep) {
      Alert.alert('Sebep', 'Lütfen bir sebep seç.');
      return;
    }
    if (!onayHazir) {
      Alert.alert('Onay', `Devam etmek için ${ONAY_KELIME} yaz.`);
      return;
    }

    Alert.alert(
      'Son onay',
      'Hesabın kapatılacak. Profil, içerik ve oturumlar temizlenecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabımı sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await deleteAccount(sebep);
              setBusy(false);
              if (r.error) {
                Alert.alert('Hesap silinemedi', r.error);
                return;
              }
              Alert.alert(
                'Hesap silindi',
                'Hesabın kapatıldı. İstersen yeni bir hesap oluşturabilirsin.',
                [
                  {
                    text: 'Tamam',
                    onPress: () => router.replace('/(auth)/login'),
                  },
                ],
              );
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <EkranBasligi
        title="Hesabı sil"
        subtitle="Kalıcı hesap kapatma"
        fallbackHref={'/profil-ayarlar' as any}
      />
      <ScrollView
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warn}>
          <Ionicons name="warning" size={22} color={RenkTokenlari.danger} />
          <Text style={styles.warnText}>
            Bu işlem hesabını kalıcı kapatır. Profilin anonimleşir; durumların,
            yorumların ve sohbetlerin gizlenir. Giriş yapılamaz.
          </Text>
        </View>

        <View style={[styles.warn, styles.warnIade]}>
          <Ionicons name="card-outline" size={22} color={RenkTokenlari.danger} />
          <Text style={styles.warnText}>
            Mağaza iadesi, chargeback veya sahte dekont durumunda açık takas
            anlaşmaları iptal edilir, bakiye geri alınır ve hesap askıya
            alınabilir / kapatılabilir. İade geçmişi olan hesaplarda takas
            kapalıdır.
          </Text>
        </View>

        <Text style={styles.label}>Hesap</Text>
        <Text style={styles.meta}>{user?.email ?? 'Kayıtlı hesap'}</Text>

        <Text style={styles.label}>Neden siliyorsun?</Text>
        {SEBEPLER.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, sebep === s && styles.chipAktif]}
            onPress={() => setSebep(s)}
          >
            <Text style={[styles.chipText, sebep === s && styles.chipTextAktif]}>
              {s}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.label}>
          Onaylamak için {ONAY_KELIME} yaz
        </Text>
        <TextInput
          value={onay}
          onChangeText={setOnay}
          placeholder={ONAY_KELIME}
          placeholderTextColor={RenkTokenlari.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          editable={!busy}
        />

        <View style={styles.liste}>
          {[
            'Profil “Silinmiş hesap” olur; ad, foto, bio, telefon, doğum tarihi silinir',
            'Durum paylaşımların ve yorumların gizlenir',
            'Oda / canlı yayın yorumların kaldırılır',
            'Açık odalar ve yayınlar kapatılır; oturumlar sonlanır',
            'Push bildirimleri ve banka bilgilerin temizlenir',
            'Mümkünse giriş kimliği de silinir (Apple/Google gereksinimi)',
            'Açık takas anlaşmaları iptal edilebilir; iade/chargeback riski hesap kapatma sebebidir',
            'Bu işlem geri alınamaz',
          ].map((t) => (
            <View key={t} style={styles.listeSatir}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={RenkTokenlari.textMuted}
              />
              <Text style={styles.listeText}>{t}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[
            styles.dangerBtn,
            (!onayHazir || !sebep || busy) && styles.dangerDisabled,
          ]}
          disabled={!onayHazir || !sebep || busy}
          onPress={sil}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.dangerBtnText}>Hesabımı kalıcı olarak sil</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondary}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>Vazgeç</Text>
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
