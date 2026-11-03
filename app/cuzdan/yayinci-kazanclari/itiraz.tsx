import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../../src/i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../src/i18n/diller';
import {
  YayinciItirazOlustur,
  YayinciItirazlarimGetir,
  type YayinciItiraz,
} from '../../../src/moduller/cuzdan/yayinci/YayinciKazancApi';

type Tur = 'payout' | 'earning' | 'refund' | 'account';

const TURLER: { id: Tur; anahtar: CeviriAnahtari; ikon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'payout', anahtar: 'yayinciK.itirazTurPayout', ikon: 'card-outline' },
  { id: 'earning', anahtar: 'yayinciK.itirazTurEarning', ikon: 'trending-up-outline' },
  { id: 'refund', anahtar: 'yayinciK.itirazTurRefund', ikon: 'refresh-outline' },
  { id: 'account', anahtar: 'yayinciK.itirazTurAccount', ikon: 'business-outline' },
];

function tarih(iso: string, locale: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function ItirazEkrani() {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const params = useLocalSearchParams<{ earningId?: string; batchItemId?: string }>();

  const [tur, setTur] = useState<Tur>('payout');
  const [konu, setKonu] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [gonderiyor, setGonderiyor] = useState(false);
  const [itirazlar, setItirazlar] = useState<YayinciItiraz[]>([]);

  const yukle = useCallback(async () => {
    try {
      setItirazlar(await YayinciItirazlarimGetir());
    } catch {
      setItirazlar([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const gonder = async () => {
    if (!konu.trim() || !aciklama.trim()) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.itirazZorunlu'));
      return;
    }
    setGonderiyor(true);
    const r = await YayinciItirazOlustur({
      kind: tur,
      subject: konu.trim(),
      body: aciklama.trim(),
      earningId: params.earningId ?? null,
      batchItemId: params.batchItemId ?? null,
    });
    setGonderiyor(false);
    if (!r.ok) {
      Alert.alert(t('yayinciK.hata'), t('yayinciK.hata'));
      return;
    }
    setKonu('');
    setAciklama('');
    await yukle();
    Alert.alert(t('yayinciK.itirazAlindi'), t('yayinciK.itirazAlindiAlt'));
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title={t('yayinciK.itirazOlustur')}
        subtitle={t('yayinciK.itirazAlt')}
        fallbackHref={'/cuzdan/yayinci-kazanclari' as any}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.kart}>
          <Text style={styles.etiket}>{t('yayinciK.itirazTur')}</Text>
          <View style={styles.turSatir}>
            {TURLER.map((x) => {
              const aktif = tur === x.id;
              return (
                <Pressable
                  key={x.id}
                  onPress={() => setTur(x.id)}
                  style={[styles.turCip, aktif && styles.turCipAktif]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: aktif }}
                >
                  <Ionicons
                    name={x.ikon}
                    size={13}
                    color={aktif ? RenkTokenlari.textOnPrimary : RenkTokenlari.textMuted}
                  />
                  <Text style={[styles.turYazi, aktif && styles.turYaziAktif]} numberOfLines={1}>
                    {t(x.anahtar)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.etiket}>{t('yayinciK.itirazKonu')}</Text>
          <TextInput
            value={konu}
            onChangeText={setKonu}
            placeholder={t('yayinciK.itirazKonuPh')}
            placeholderTextColor={RenkTokenlari.textDim}
            maxLength={120}
            style={styles.girdi}
          />

          <Text style={styles.etiket}>{t('yayinciK.itirazAciklama')}</Text>
          <TextInput
            value={aciklama}
            onChangeText={setAciklama}
            placeholder={t('yayinciK.itirazAciklamaPh')}
            placeholderTextColor={RenkTokenlari.textDim}
            multiline
            maxLength={2000}
            style={[styles.girdi, styles.girdiCoklu]}
          />

          {params.earningId || params.batchItemId ? (
            <Text style={styles.baglamNotu}>{t('yayinciK.itirazBaglamEklendi')}</Text>
          ) : null}

          <Pressable
            onPress={gonder}
            disabled={gonderiyor}
            style={({ pressed }) => [
              styles.dugme,
              (pressed || gonderiyor) && { opacity: 0.75 },
            ]}
          >
            {gonderiyor ? (
              <ActivityIndicator color={RenkTokenlari.textOnPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="send-outline" size={15} color={RenkTokenlari.textOnPrimary} />
                <Text style={styles.dugmeYazi}>{t('yayinciK.itirazGonder')}</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.bolum}>{t('yayinciK.itirazlarim')}</Text>
        {itirazlar.length === 0 ? (
          <Text style={styles.bos}>{t('yayinciK.itirazYok')}</Text>
        ) : (
          itirazlar.map((i) => (
            <View key={i.id} style={styles.satir}>
              <View style={styles.satirIkon}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={RenkTokenlari.violet} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.satirBaslik} numberOfLines={1}>
                  {i.subject}
                </Text>
                <Text style={styles.satirMeta} numberOfLines={2}>
                  {i.body}
                </Text>
                <Text style={styles.satirMeta}>{tarih(i.created_at, locale)}</Text>
              </View>
              <Text style={styles.durum}>{i.status}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  kart: {
    gap: 8,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  etiket: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  turSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  turCip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  turCipAktif: { backgroundColor: RenkTokenlari.primary },
  turYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, fontWeight: '700' },
  turYaziAktif: { color: RenkTokenlari.textOnPrimary, fontWeight: '900' },
  girdi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  girdiCoklu: { minHeight: 110, textAlignVertical: 'top' },
  baglamNotu: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontSize: 9.5 },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
    marginTop: 6,
  },
  dugmeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textOnPrimary, fontWeight: '900', fontSize: 13 },
  bolum: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontSize: 16, marginTop: 4 },
  bos: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, textAlign: 'center', paddingVertical: 16 },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  satirIkon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.violet}1A`,
  },
  satirBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 12 },
  satirMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 9.5 },
  durum: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 9, fontWeight: '800' },
});
