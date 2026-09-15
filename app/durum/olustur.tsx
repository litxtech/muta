import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
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
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { DurumMedyasiSecVeYukle } from '../../src/moduller/durum/islemler/DurumMedyasiYukle';
import { DurumOlustur } from '../../src/moduller/durum/islemler/DurumIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function DurumOlusturEkrani() {
  const { isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  const sec = (tur: 'image' | 'video') => {
    islemiDene('durum_paylas', () => {
      void (async () => {
        setBusy(true);
        const r = await DurumMedyasiSecVeYukle(tur);
        setBusy(false);
        if (r.ok === false) {
          if (!r.iptal) Alert.alert('Medya', r.hata);
          return;
        }
        setMediaUrl(r.url);
        setMediaType(r.mediaType);
      })();
    });
  };

  const yayinla = () => {
    if (!mediaUrl) {
      Alert.alert('Durum', 'Önce fotoğraf veya video seç.');
      return;
    }
    islemiDene('durum_paylas', () => {
      void (async () => {
        setBusy(true);
        const r = await DurumOlustur({
          mediaType,
          mediaUrl,
          caption: caption.trim() || undefined,
        });
        setBusy(false);
        if (!r.ok) {
          Alert.alert('Durum', r.hata ?? 'Paylaşılamadı');
          return;
        }
        router.replace('/(tabs)/durum' as any);
        if (r.id) {
          setTimeout(() => router.push(`/durum/${r.id}` as any), 120);
        }
      })();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="durum">
        <EkranBasligi
          title="Durum paylaş"
          subtitle="Foto veya video · metin ekle"
          fallbackHref={'/(tabs)/durum' as any}
        />
        <View style={styles.content}>
          {mediaUrl ? (
            <View style={styles.onizleme}>
              <Image source={{ uri: mediaUrl }} style={styles.img} />
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
            </View>
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

          <TextInput
            style={styles.caption}
            value={caption}
            onChangeText={setCaption}
            placeholder="Bir şeyler yaz… (isteğe bağlı)"
            placeholderTextColor={RenkTokenlari.textDim}
            multiline
            maxLength={500}
          />

          {busy ? (
            <ActivityIndicator color={RenkTokenlari.primarySoft} />
          ) : (
            <GradientButton title="Paylaş" onPress={yayinla} />
          )}
        </View>

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
  content: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
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
  img: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: RenkTokenlari.bgElevated,
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
    minHeight: 88,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    padding: BoslukTokenlari.md,
    color: RenkTokenlari.text,
    ...TipografiTokenlari.body,
    textAlignVertical: 'top',
  },
});
