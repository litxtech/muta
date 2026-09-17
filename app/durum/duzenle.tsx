import React, { useCallback, useRef, useState } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useKlavyeYuksekligi } from '../../src/bilesenler/klavye/useKlavyeYuksekligi';
import {
  DurumDetayGetir,
  DurumGuncelle,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { DurumVideoOnizleme } from '../../src/moduller/durum/bilesenler/DurumVideoOnizleme';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function DurumDuzenleEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { acik: klavyeAcik } = useKlavyeYuksekligi();
  const scrollRef = useRef<ScrollView>(null);
  const captionY = useRef(0);
  const [oge, setOge] = useState<DurumOggesi | null>(null);
  const [caption, setCaption] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await DurumDetayGetir(id);
      if (!d.is_mine) {
        Alert.alert('Düzenle', 'Bu gönderiyi düzenleyemezsin.');
        router.back();
        return;
      }
      setOge(d);
      setCaption(d.caption ?? '');
    } catch {
      setOge(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const kaydet = () => {
    if (!oge || busy) return;
    void (async () => {
      setBusy(true);
      const r = await DurumGuncelle(oge.id, caption.trim());
      setBusy(false);
      if (!r.ok) {
        Alert.alert('Düzenle', r.hata ?? 'Kaydedilemedi');
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace(`/durum/${oge.id}` as any);
    })();
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
          title="Gönderiyi düzenle"
          subtitle="Açıklama metnini güncelle"
          fallbackHref={'/(tabs)/durum' as any}
        />

        {yukleniyor && !oge ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : !oge ? (
          <Text style={styles.bos}>Gönderi bulunamadı</Text>
        ) : (
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
              <Pressable
                style={[styles.onizleme, klavyeAcik && styles.onizlemeKucuk]}
                onPress={Keyboard.dismiss}
              >
                {oge.media_type === 'video' ? (
                  <DurumVideoOnizleme
                    uri={oge.media_url}
                    style={[styles.img, klavyeAcik && styles.imgKucuk]}
                  />
                ) : (
                  <Image
                    source={{ uri: oge.media_url }}
                    style={[styles.img, klavyeAcik && styles.imgKucuk]}
                  />
                )}
                {oge.media_type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="videocam" size={16} color="#fff" />
                    <Text style={styles.videoBadgeYazi}>Video</Text>
                  </View>
                ) : null}
              </Pressable>

              <View
                onLayout={(e) => {
                  captionY.current = e.nativeEvent.layout.y;
                }}
              >
                <TextInput
                  style={styles.caption}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Açıklama yaz… (isteğe bağlı)"
                  placeholderTextColor={RenkTokenlari.textDim}
                  multiline
                  maxLength={500}
                  onFocus={metneKaydir}
                />
              </View>
              <Text style={styles.sayac}>{caption.length}/500</Text>

              {busy ? (
                <ActivityIndicator color={RenkTokenlari.primarySoft} />
              ) : (
                <GradientButton title="Kaydet" onPress={kaydet} />
              )}

              <Pressable
                style={styles.bosAlan}
                onPress={Keyboard.dismiss}
                accessibilityRole="button"
                accessibilityLabel="Klavyeyi kapat"
              />
            </ScrollView>
          </KlavyeGuvenliAlan>
        )}
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
  bos: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 40,
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
  sayac: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textAlign: 'right',
    marginTop: -8,
  },
  bosAlan: {
    minHeight: 160,
    flexGrow: 1,
  },
});
