import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useCeviri } from '../../src/i18n/useCeviri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { FikirKategoriSecici } from '../../src/moduller/fikir-geri-bildirim/bilesenler/FikirKategoriSecici';
import {
  FikirBenzerAra,
  FikirGonder,
  FikirKategorileriGetir,
} from '../../src/moduller/fikir-geri-bildirim/islemler/FikirIslemleri';
import { FikirGorseliSecVeYukle } from '../../src/moduller/fikir-geri-bildirim/yardimcilar/FikirMedyaYukle';
import type { FikirEk } from '../../src/moduller/fikir-geri-bildirim/yardimcilar/FikirMedyaYukle';
import {
  FIKIR_ACIKLAMA_MAX,
  FIKIR_ACIKLAMA_MIN,
  FIKIR_BASLIK_MAX,
  FIKIR_BASLIK_MIN,
  type FikirKategori,
  type FikirOzet,
} from '../../src/moduller/fikir-geri-bildirim/tipler';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function FikirGonderEkrani() {
  const { t } = useCeviri();
  const [kategoriler, setKategoriler] = useState<FikirKategori[]>([]);
  const [kategori, setKategori] = useState<FikirKategori | null>(null);
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [bugWhere, setBugWhere] = useState('');
  const [bugWhat, setBugWhat] = useState('');
  const [bugRepro, setBugRepro] = useState('');
  const [ekler, setEkler] = useState<FikirEk[]>([]);
  const [benzer, setBenzer] = useState<FikirOzet[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [yukleniyorEk, setYukleniyorEk] = useState(false);
  const kilitRef = useRef(false);

  useEffect(() => {
    ImagePickerOnIsit();
    void (async () => {
      try {
        setKategoriler(await FikirKategorileriGetir());
      } catch {
        setKategoriler([]);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void FikirBenzerAra(baslik).then(setBenzer).catch(() => setBenzer([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [baslik]);

  const gorselEkle = useCallback(async () => {
    if (ekler.length >= 3) {
      Alert.alert(t('fikirler.limit'), t('fikirler.gorselLimit'));
      return;
    }
    setYukleniyorEk(true);
    const r = await FikirGorseliSecVeYukle();
    setYukleniyorEk(false);
    if (!r.ok) {
      if (!r.iptal) Alert.alert(t('fikirler.gorsel'), r.hata);
      return;
    }
    setEkler((prev) => [...prev, r.ek]);
  }, [ekler.length, t]);

  const gonder = useCallback(async () => {
    if (kilitRef.current || gonderiliyor) return;
    if (!kategori) {
      Alert.alert(t('fikirler.kategori'), t('fikirler.kategoriSec'));
      return;
    }
    if (baslik.trim().length < FIKIR_BASLIK_MIN) {
      Alert.alert(t('fikirler.baslikLabel'), t('fikirler.baslikMin', { n: FIKIR_BASLIK_MIN }));
      return;
    }
    if (aciklama.trim().length < FIKIR_ACIKLAMA_MIN) {
      Alert.alert(
        t('fikirler.aciklama'),
        t('fikirler.aciklamaMin', { n: FIKIR_ACIKLAMA_MIN }),
      );
      return;
    }

    kilitRef.current = true;
    setGonderiliyor(true);
    try {
      const clientToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const sonuc = await FikirGonder({
        categoryId: kategori.id,
        title: baslik.trim(),
        description: aciklama.trim(),
        attachments: ekler,
        bugWhere: kategori.is_bug_form ? bugWhere : undefined,
        bugWhat: kategori.is_bug_form ? bugWhat : undefined,
        bugRepro: kategori.is_bug_form ? bugRepro : undefined,
        clientToken,
      });
      Alert.alert(t('fikirler.tesekkurler'), t('fikirler.tesekkurlerBody'), [
        {
          text: t('fikirler.detayaGit'),
          onPress: () => router.replace(`/fikirler/${sonuc.id}` as any),
        },
      ]);
    } catch (e) {
      Alert.alert(
        t('fikirler.gonderilemedi'),
        e instanceof Error ? e.message : t('ortak.hata'),
      );
      kilitRef.current = false;
    } finally {
      setGonderiliyor(false);
    }
  }, [
    kategori,
    baslik,
    aciklama,
    ekler,
    bugWhere,
    bugWhat,
    bugRepro,
    gonderiliyor,
    t,
  ]);

  return (
    <Screen>
      <ModulHataSiniri modulAdi="fikir-gonder">
        <EkranBasligi
          title={t('fikirler.olustur')}
          subtitle={t('fikirler.altDetayli')}
          onBack={() => router.back()}
        />
        <ScrollView
          contentContainerStyle={styles.govde}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>{t('fikirler.kategori')}</Text>
          <FikirKategoriSecici
            kategoriler={kategoriler}
            seciliId={kategori?.id ?? null}
            onSec={setKategori}
          />

          <Text style={styles.label}>{t('fikirler.baslikLabel')}</Text>
          <TextInput
            style={styles.input}
            value={baslik}
            onChangeText={(txt) => setBaslik(txt.slice(0, FIKIR_BASLIK_MAX))}
            placeholder={t('fikirler.baslikPlaceholder')}
            placeholderTextColor={RenkTokenlari.textMuted}
          />
          <Text style={styles.sayac}>
            {baslik.trim().length}/{FIKIR_BASLIK_MAX}
          </Text>

          {benzer.length > 0 ? (
            <View style={styles.benzerKutu}>
              <Text style={styles.benzerBaslik}>{t('fikirler.benzerBaslik')}</Text>
              {benzer.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.benzerSatir}
                  onPress={() => router.push(`/fikirler/${b.id}` as any)}
                >
                  <Text style={styles.benzerYazi} numberOfLines={1}>
                    {b.title}
                  </Text>
                  <Text style={styles.benzerOy}>
                    💡 {b.vote_count.toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>{t('fikirler.fikriniAnlat')}</Text>
          <Text style={styles.yardim}>{t('fikirler.anlatYardim')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={aciklama}
            onChangeText={(txt) => setAciklama(txt.slice(0, FIKIR_ACIKLAMA_MAX))}
            placeholder={t('fikirler.aciklamaPlaceholder')}
            placeholderTextColor={RenkTokenlari.textMuted}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.sayac}>
            {t('fikirler.sayacMin', {
              cur: aciklama.trim().length,
              max: FIKIR_ACIKLAMA_MAX,
              min: FIKIR_ACIKLAMA_MIN,
            })}
          </Text>

          {kategori?.is_bug_form ? (
            <View style={styles.bugBlok}>
              <Text style={styles.label}>{t('fikirler.bugNerede')}</Text>
              <TextInput
                style={styles.input}
                value={bugWhere}
                onChangeText={setBugWhere}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder={t('fikirler.bugNeredePh')}
              />
              <Text style={styles.label}>{t('fikirler.bugNe')}</Text>
              <TextInput
                style={styles.input}
                value={bugWhat}
                onChangeText={setBugWhat}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder={t('fikirler.bugNePh')}
              />
              <Text style={styles.label}>{t('fikirler.bugTekrar')}</Text>
              <TextInput
                style={styles.input}
                value={bugRepro}
                onChangeText={setBugRepro}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder={t('fikirler.bugTekrarPh')}
              />
            </View>
          ) : null}

          <Text style={styles.label}>{t('fikirler.gorselEkle')}</Text>
          <View style={styles.ekSerit}>
            {ekler.map((e, i) => (
              <View key={e.storage_path} style={styles.ekKart}>
                <Image source={{ uri: e.public_url }} style={styles.ekImg} />
                <Pressable
                  style={styles.ekSil}
                  onPress={() => setEkler((p) => p.filter((_, idx) => idx !== i))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {ekler.length < 3 ? (
              <Pressable style={styles.ekEkle} onPress={() => void gorselEkle()}>
                {yukleniyorEk ? (
                  <ActivityIndicator color={RenkTokenlari.primarySoft} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={22} color={RenkTokenlari.primarySoft} />
                    <Text style={styles.ekEkleYazi}>{t('fikirler.galeri')}</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.gonder, gonderiliyor && { opacity: 0.6 }]}
            disabled={gonderiliyor}
            onPress={() => void gonder()}
          >
            {gonderiliyor ? (
              <ActivityIndicator color={RenkTokenlari.textOnPrimary} />
            ) : (
              <Text style={styles.gonderYazi}>{t('fikirler.fikrimiGonder')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  govde: {
    padding: BoslukTokenlari.md,
    gap: 8,
    paddingBottom: 48,
  },
  label: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    marginTop: 8,
  },
  yardim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
  },
  textarea: { minHeight: 140 },
  sayac: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    alignSelf: 'flex-end',
  },
  benzerKutu: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.md,
    padding: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  benzerBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  benzerSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  benzerYazi: { ...TipografiTokenlari.body, color: RenkTokenlari.text, flex: 1 },
  benzerOy: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  bugBlok: { gap: 6 },
  ekSerit: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ekKart: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden' },
  ekImg: { width: '100%', height: '100%' },
  ekSil: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    padding: 2,
  },
  ekEkle: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ekEkleYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  gonder: {
    marginTop: 16,
    backgroundColor: RenkTokenlari.primarySoft,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gonderYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },
});
