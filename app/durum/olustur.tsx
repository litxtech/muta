import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { ImagePickerOnIsit } from '../../src/ortak/medya/ImagePickerHazirMi';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useKlavyeYuksekligi } from '../../src/bilesenler/klavye/useKlavyeYuksekligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { DurumMedyasiSecVeYukle } from '../../src/moduller/durum/islemler/DurumMedyasiYukle';
import {
  DurumMedyaHttpsMi,
  DurumOlustur,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function DurumOlusturEkrani() {
  const { isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const { acik: klavyeAcik } = useKlavyeYuksekligi();
  const scrollRef = useRef<ScrollView>(null);
  const captionY = useRef(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Video seçiminde izin dialog’u picker’dan önce gelmesin
    ImagePickerOnIsit({ izinIste: true });
  }, []);

  const MOODLAR: { kod: string; etiket: string; emoji: string }[] = [
    { kod: 'mutlu', etiket: 'İyi hissediyorum', emoji: '😊' },
    { kod: 'enerjik', etiket: 'Enerjik', emoji: '⚡' },
    { kod: 'sakin', etiket: 'Sakin', emoji: '🌙' },
    { kod: 'sosyal', etiket: 'Sohbetteyim', emoji: '💬' },
    { kod: 'muzik', etiket: 'Müzik', emoji: '🎧' },
    { kod: 'oyun', etiket: 'Oyundayım', emoji: '🎮' },
  ];

  const sec = (tur: 'image' | 'video') => {
    islemiDene('durum_paylas', () => {
      void (async () => {
        const r = await DurumMedyasiSecVeYukle(tur, {
          onYuklemeBasladi: () => setBusy(true),
        });
        setBusy(false);
        if (r.ok === false) {
          if (!r.iptal) Alert.alert('Medya', r.hata);
          return;
        }
        // Yalnızca https public URL — file:// / content:// Image/Video crash önlenir.
        if (!DurumMedyaHttpsMi(r.url)) {
          Alert.alert('Medya', 'Yüklenen dosya adresi geçersiz.');
          return;
        }
        setMediaUrl(r.url.trim());
        setMediaType(r.mediaType);
      })();
    });
  };

  const yayinla = () => {
    if (!mediaUrl && !caption.trim() && !mood) {
      Alert.alert('Durum', 'Medya, mood veya kısa bir metin ekle.');
      return;
    }
    if (!mediaUrl || !DurumMedyaHttpsMi(mediaUrl)) {
      Alert.alert('Durum', 'Önizleme için fotoğraf veya video seç.');
      return;
    }
    islemiDene('durum_paylas', () => {
      void (async () => {
        setBusy(true);
        const moodEtiket = MOODLAR.find((m) => m.kod === mood);
        const birlesik = [
          moodEtiket ? `${moodEtiket.emoji} ${moodEtiket.etiket}` : null,
          caption.trim() || null,
        ]
          .filter(Boolean)
          .join(' · ');
        const r = await DurumOlustur({
          mediaType,
          mediaUrl: mediaUrl.trim(),
          caption: birlesik || undefined,
        });
        setBusy(false);
        if (!r.ok) {
          Alert.alert('Durum', r.hata ?? 'Paylaşılamadı');
          return;
        }
        // Detaya otomatik push etme — fullScreenModal siyah ekranda
        // takılıyor; paylaşım zaten oluştu, feed'e dön.
        try {
          router.replace('/(tabs)/durum' as any);
        } catch {
          try {
            router.navigate('/(tabs)/durum' as any);
          } catch {
            if (router.canGoBack()) router.back();
          }
        }
      })();
    });
  };

  const metneKaydir = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, captionY.current - 16),
        animated: true,
      });
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="durum">
        <EkranBasligi
          title="Anlık durum"
          subtitle="Mood · medya · kısa metin · önizleme"
          fallbackHref={'/(tabs)/durum' as any}
        />
        <KlavyeGuvenliAlan style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <Text style={styles.moodBaslik}>Nasıl hissediyorsun?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodSerit}
            >
              {MOODLAR.map((m) => {
                const secili = mood === m.kod;
                return (
                  <Pressable
                    key={m.kod}
                    onPress={() => setMood(secili ? null : m.kod)}
                    style={[styles.moodChip, secili && styles.moodChipAktif]}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text
                      style={[styles.moodYazi, secili && styles.moodYaziAktif]}
                      numberOfLines={1}
                    >
                      {m.etiket}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {mediaUrl && DurumMedyaHttpsMi(mediaUrl) ? (
              <Pressable
                style={[styles.onizleme, klavyeAcik && styles.onizlemeKucuk]}
                onPress={Keyboard.dismiss}
              >
                {mediaType === 'video' ? (
                  // Oluştur ekranında native VideoPlayer mount etme —
                  // paylaş / geri navigasyonunda crash + çoklu player riski.
                  <View
                    style={[
                      styles.img,
                      styles.videoPlaceholder,
                      klavyeAcik && styles.imgKucuk,
                    ]}
                  >
                    <Ionicons
                      name="play-circle"
                      size={48}
                      color="rgba(255,255,255,0.8)"
                    />
                  </View>
                ) : (
                  <Image
                    source={{ uri: mediaUrl.trim() }}
                    style={[styles.img, klavyeAcik && styles.imgKucuk]}
                  />
                )}
                {mediaType === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={16} color="#fff" />
                    <Text style={styles.videoBadgeYazi}>Video</Text>
                  </View>
                ) : null}
                <Pressable
                  style={styles.degistir}
                  onPress={() => setMediaUrl(null)}
                >
                  <Text style={styles.degistirYazi}>Değiştir</Text>
                </Pressable>
              </Pressable>
            ) : (
              <View style={styles.secim}>
                <Pressable style={styles.secBtn} onPress={() => sec('image')}>
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color={RenkTokenlari.primarySoft}
                  />
                  <Text style={styles.secYazi}>Fotoğraf</Text>
                </Pressable>
                <Pressable style={styles.secBtn} onPress={() => sec('video')}>
                  <Ionicons
                    name="videocam-outline"
                    size={28}
                    color={RenkTokenlari.accent}
                  />
                  <Text style={styles.secYazi}>Video</Text>
                </Pressable>
              </View>
            )}

            <View
              onLayout={(e) => {
                captionY.current = e.nativeEvent.layout.y;
              }}
            >
              <TextInput
                style={styles.caption}
                value={caption}
                onChangeText={setCaption}
                placeholder="Bir şeyler yaz… (isteğe bağlı)"
                placeholderTextColor={RenkTokenlari.textDim}
                multiline
                maxLength={500}
                onFocus={metneKaydir}
              />
            </View>

            {busy ? (
              <ActivityIndicator color={RenkTokenlari.primarySoft} />
            ) : (
              <GradientButton title="Paylaş" onPress={yayinla} />
            )}

            <Pressable
              style={styles.bosAlan}
              onPress={Keyboard.dismiss}
              accessibilityRole="button"
              accessibilityLabel="Klavyeyi kapat"
            />
          </ScrollView>
        </KlavyeGuvenliAlan>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={upgradeKapat}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.xl,
  },
  moodBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  moodSerit: {
    gap: BoslukTokenlari.sm,
    paddingRight: BoslukTokenlari.md,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  moodChipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: 'rgba(232,64,145,0.16)',
  },
  moodEmoji: {
    fontSize: 16,
  },
  moodYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  moodYaziAktif: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  secim: {
    flexDirection: 'row',
    gap: 12,
  },
  secBtn: {
    flex: 1,
    height: 120,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  onizleme: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  onizlemeKucuk: {
    alignSelf: 'center',
    width: '55%',
  },
  img: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a22',
  },
  imgKucuk: {
    aspectRatio: 1,
    maxHeight: 160,
  },
  videoBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  videoBadgeYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '700',
  },
  degistir: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  degistirYazi: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '700',
  },
  caption: {
    minHeight: 100,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    padding: BoslukTokenlari.md,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
    textAlignVertical: 'top',
  },
  bosAlan: {
    minHeight: 160,
    flexGrow: 1,
  },
});
