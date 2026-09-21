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
    const t = setTimeout(() => {
      void FikirBenzerAra(baslik).then(setBenzer).catch(() => setBenzer([]));
    }, 350);
    return () => clearTimeout(t);
  }, [baslik]);

  const gorselEkle = useCallback(async () => {
    if (ekler.length >= 3) {
      Alert.alert('Limit', 'En fazla 3 görsel ekleyebilirsin.');
      return;
    }
    setYukleniyorEk(true);
    const r = await FikirGorseliSecVeYukle();
    setYukleniyorEk(false);
    if (!r.ok) {
      if (!r.iptal) Alert.alert('Görsel', r.hata);
      return;
    }
    setEkler((prev) => [...prev, r.ek]);
  }, [ekler.length]);

  const gonder = useCallback(async () => {
    if (kilitRef.current || gonderiliyor) return;
    if (!kategori) {
      Alert.alert('Kategori', 'Önce bir kategori seç.');
      return;
    }
    if (baslik.trim().length < FIKIR_BASLIK_MIN) {
      Alert.alert('Başlık', `Başlık en az ${FIKIR_BASLIK_MIN} karakter olmalı.`);
      return;
    }
    if (aciklama.trim().length < FIKIR_ACIKLAMA_MIN) {
      Alert.alert(
        'Açıklama',
        `Fikrini en az ${FIKIR_ACIKLAMA_MIN} karakterle anlat.`,
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
      Alert.alert(
        'Teşekkürler 💜',
        'Fikrin bize ulaştı. Ekibimiz tarafından değerlendirilecek.',
        [
          {
            text: 'Detaya git',
            onPress: () => router.replace(`/fikirler/${sonuc.id}` as any),
          },
        ],
      );
    } catch (e) {
      Alert.alert('Gönderilemedi', e instanceof Error ? e.message : 'Hata');
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
  ]);

  return (
    <Screen>
      <ModulHataSiniri modulAdi="fikir-gonder">
        <EkranBasligi
          title="Fikir Gönder"
          subtitle="Detaylı anlat · kaliteli fikir"
          onBack={() => router.back()}
        />
        <ScrollView
          contentContainerStyle={styles.govde}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Kategori</Text>
          <FikirKategoriSecici
            kategoriler={kategoriler}
            seciliId={kategori?.id ?? null}
            onSec={setKategori}
          />

          <Text style={styles.label}>Başlık</Text>
          <TextInput
            style={styles.input}
            value={baslik}
            onChangeText={(t) => setBaslik(t.slice(0, FIKIR_BASLIK_MAX))}
            placeholder='Örn: "Ses odalarına zamanlayıcı eklenebilir"'
            placeholderTextColor={RenkTokenlari.textMuted}
          />
          <Text style={styles.sayac}>
            {baslik.trim().length}/{FIKIR_BASLIK_MAX}
          </Text>

          {benzer.length > 0 ? (
            <View style={styles.benzerKutu}>
              <Text style={styles.benzerBaslik}>Buna benzer fikirler olabilir</Text>
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
                    💡 {b.vote_count.toLocaleString('tr-TR')}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>Fikrini anlat</Text>
          <Text style={styles.yardim}>
            Ne eklenmesini veya değiştirilmesini istediğini ve bunun Tamuso
            deneyimini nasıl iyileştireceğini anlat.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={aciklama}
            onChangeText={(t) => setAciklama(t.slice(0, FIKIR_ACIKLAMA_MAX))}
            placeholder="Fikrini mümkün olduğunca detaylı anlat..."
            placeholderTextColor={RenkTokenlari.textMuted}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.sayac}>
            {aciklama.trim().length}/{FIKIR_ACIKLAMA_MAX} · min {FIKIR_ACIKLAMA_MIN}
          </Text>

          {kategori?.is_bug_form ? (
            <View style={styles.bugBlok}>
              <Text style={styles.label}>Sorun nerede yaşandı?</Text>
              <TextInput
                style={styles.input}
                value={bugWhere}
                onChangeText={setBugWhere}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder="Örn: Ses odası koltuk paneli"
              />
              <Text style={styles.label}>Ne yaparken oldu?</Text>
              <TextInput
                style={styles.input}
                value={bugWhat}
                onChangeText={setBugWhat}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder="Örn: Mikrofon isterken"
              />
              <Text style={styles.label}>Tekrar yaşanıyor mu?</Text>
              <TextInput
                style={styles.input}
                value={bugRepro}
                onChangeText={setBugRepro}
                placeholderTextColor={RenkTokenlari.textMuted}
                placeholder="Her seferinde / ara sıra / bir kez"
              />
            </View>
          ) : null}

          <Text style={styles.label}>Görsel ekle (opsiyonel)</Text>
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
                    <Text style={styles.ekEkleYazi}>Galeri</Text>
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
              <Text style={styles.gonderYazi}>Fikrimi Gönder</Text>
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
