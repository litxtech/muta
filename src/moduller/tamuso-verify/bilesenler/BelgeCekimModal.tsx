/**
 * Belge fotoğrafı çekimi — tam ekran kamera + çerçeve + ön kalite kontrolü.
 *
 * ÖNEMLİ: Kalite kontrolü yalnızca "fotoğraf okunabilir mi" sorusuna yanıt verir.
 * Belgenin gerçekliği veya sahibi bu ekranda doğrulanmış sayılmaz; karar
 * inceleme ekibindedir.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { bilinmeyenKalite, kaliteDegerlendir } from '../BelgeKalite';
import { kaliteAnahtari } from '../HataCeviri';
import {
  GoruntuAnalizKopru,
  type GoruntuAnalizHandle,
} from '../GoruntuAnalizKopru';
import type { VerifyBelgeKalitesi, VerifyCekimSonucu } from '../tipler';
import { BelgeCercevesi } from './VerifyParcalari';

type Props = {
  gorunur: boolean;
  baslik: string;
  /** Galeriden seçim sunulsun mu (varsayılan evet). */
  galeriIzinli?: boolean;
  onKapat: () => void;
  onTamam: (sonuc: VerifyCekimSonucu) => void;
};

type Onizleme = {
  uri: string;
  genislik: number;
  yukseklik: number;
  kaynak: 'camera' | 'library';
};

const KAMERA_ARKA = 'back' as const;

async function uriBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

export function BelgeCekimModal({
  gorunur,
  baslik,
  galeriIzinli = true,
  onKapat,
  onTamam,
}: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const kopruRef = useRef<GoruntuAnalizHandle>(null);

  const [izin, izinIste] = useCameraPermissions();
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [kalite, setKalite] = useState<VerifyBelgeKalitesi | null>(null);
  const [analizEdiliyor, setAnalizEdiliyor] = useState(false);
  const [cekiliyor, setCekiliyor] = useState(false);
  const [torch, setTorch] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const sifirla = useCallback(() => {
    setOnizleme(null);
    setKalite(null);
    setHata(null);
    setCekiliyor(false);
    setAnalizEdiliyor(false);
    setTorch(false);
  }, []);

  const kapat = useCallback(() => {
    sifirla();
    onKapat();
  }, [onKapat, sifirla]);

  const analiz = useCallback(async (uri: string) => {
    setAnalizEdiliyor(true);
    const b64 = await uriBase64(uri);
    const metrik = b64 ? await kopruRef.current?.analizEt(b64) : null;
    setKalite(metrik ? kaliteDegerlendir(metrik) : bilinmeyenKalite());
    setAnalizEdiliyor(false);
  }, []);

  const cek = useCallback(async () => {
    if (cekiliyor) return;
    setCekiliyor(true);
    setHata(null);
    try {
      const foto = await camRef.current?.takePictureAsync({
        quality: 0.78,
        base64: false,
        exif: false,
      });
      if (!foto?.uri) throw new Error('capture_failed');
      setOnizleme({
        uri: foto.uri,
        genislik: foto.width ?? 0,
        yukseklik: foto.height ?? 0,
        kaynak: 'camera',
      });
      setKalite(null);
      void analiz(foto.uri);
    } catch {
      setHata(t('verify.hataGenel'));
    } finally {
      setCekiliyor(false);
    }
  }, [analiz, cekiliyor, t]);

  const galeridenSec = useCallback(async () => {
    try {
      const sonuc = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (sonuc.canceled || !sonuc.assets[0]) return;
      const a = sonuc.assets[0];
      setOnizleme({
        uri: a.uri,
        genislik: a.width ?? 0,
        yukseklik: a.height ?? 0,
        kaynak: 'library',
      });
      setKalite(null);
      void analiz(a.uri);
    } catch {
      setHata(t('verify.hataYukleme'));
    }
  }, [analiz, t]);

  const izinVer = useCallback(async () => {
    try {
      const n = await izinIste();
      if (!n.granted) setHata(t('verify.kameraIzinReddedildi'));
    } catch {
      setHata(t('verify.kameraIzinReddedildi'));
    }
  }, [izinIste, t]);

  const kaliteBlok = kalite?.state === 'failed';
  const kodlar = kalite?.kodlar ?? [];

  const kullan = useCallback(() => {
    if (!onizleme || kaliteBlok || analizEdiliyor) return;
    onTamam({
      uri: onizleme.uri,
      genislik: onizleme.genislik,
      yukseklik: onizleme.yukseklik,
      mime: 'image/jpeg',
      kalite: kalite ?? bilinmeyenKalite(),
      kaynak: onizleme.kaynak,
    });
    sifirla();
  }, [analizEdiliyor, kalite, kaliteBlok, onizleme, onTamam, sifirla]);

  const izinDurumu =
    izin == null ? 'yukleniyor' : izin.granted ? 'var' : 'yok';

  return (
    <Modal
      visible={gorunur}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={kapat}
    >
      <StatusBar style="light" />
      <View style={styles.kok}>
        <GoruntuAnalizKopru ref={kopruRef} />

        {onizleme ? (
          <>
            <Image
              source={{ uri: onizleme.uri }}
              style={styles.onizleme}
              resizeMode="contain"
            />
            <View style={[styles.altPanel, { paddingBottom: insets.bottom + 14 }]}>
              {analizEdiliyor ? (
                <View style={styles.analizSatir}>
                  <ActivityIndicator color={RenkTokenlari.accent} size="small" />
                  <Text style={styles.analizYazi}>{t('verify.kontrolEdiliyor')}</Text>
                </View>
              ) : kalite && kodlar.length > 0 ? (
                <View style={styles.uyariKutu}>
                  <Ionicons
                    name={kaliteBlok ? 'close-circle' : 'warning'}
                    size={15}
                    color={kaliteBlok ? RenkTokenlari.danger : RenkTokenlari.warning}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    {kodlar.map((k) => (
                      <Text
                        key={k}
                        style={[
                          styles.uyariMetin,
                          kaliteBlok && { color: RenkTokenlari.danger },
                        ]}
                      >
                        {t(kaliteAnahtari(k))}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : kalite ? (
                <View style={styles.analizSatir}>
                  <Ionicons name="checkmark-circle" size={15} color={RenkTokenlari.mint} />
                  <Text style={[styles.analizYazi, { color: RenkTokenlari.mint }]}>
                    {t('verify.kaliteTamam')}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.onNot}>{t('verify.kaliteOnNot')}</Text>

              <View style={styles.dugmeSatir}>
                <Pressable
                  onPress={() => {
                    setOnizleme(null);
                    setKalite(null);
                  }}
                  style={({ pressed }) => [styles.yeniden, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="camera-reverse-outline" size={16} color={RenkTokenlari.text} />
                  <Text style={styles.yenidenYazi}>{t('verify.tekrarCek')}</Text>
                </Pressable>
                <Pressable
                  onPress={kullan}
                  disabled={kaliteBlok || analizEdiliyor}
                  style={({ pressed }) => [
                    styles.kullan,
                    (kaliteBlok || analizEdiliyor) && { opacity: 0.4 },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Ionicons name="checkmark" size={17} color={RenkTokenlari.bg} />
                  <Text style={styles.kullanYazi}>{t('verify.kullan')}</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : izinDurumu === 'var' ? (
          <>
            <CameraView
              ref={camRef}
              style={StyleSheet.absoluteFill}
              facing={KAMERA_ARKA}
              enableTorch={torch}
              animateShutter={false}
            />
            <View style={[styles.ustBar, { paddingTop: insets.top + 6 }]}>
              <Pressable onPress={kapat} hitSlop={10} style={styles.ustDugme}>
                <Ionicons name="close" size={22} color={RenkTokenlari.textOnOverlay} />
              </Pressable>
              <Text style={styles.ustBaslik} numberOfLines={1}>
                {baslik}
              </Text>
              <Pressable
                onPress={() => setTorch((v) => !v)}
                hitSlop={10}
                style={styles.ustDugme}
                accessibilityLabel={t('verify.flas')}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-off'}
                  size={20}
                  color={RenkTokenlari.textOnOverlay}
                />
              </Pressable>
            </View>

            <BelgeCercevesi etkin />

            <View style={[styles.altPanel, { paddingBottom: insets.bottom + 14 }]}>
              <Text style={styles.ipucu}>{t('verify.cerceveIpucu')}</Text>
              <Text style={styles.ipucuAlt}>{t('verify.cekimIpucu')}</Text>
              <View style={styles.deklansorSatir}>
                {galeriIzinli ? (
                  <Pressable onPress={() => void galeridenSec()} style={styles.galeriDugme}>
                    <Ionicons name="images-outline" size={20} color={RenkTokenlari.textOnOverlay} />
                    <Text style={styles.galeriYazi} numberOfLines={1}>
                      {t('verify.galeridenSec')}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 76 }} />
                )}
                <Pressable
                  onPress={() => void cek()}
                  disabled={cekiliyor}
                  accessibilityRole="button"
                  accessibilityLabel={t('verify.cek')}
                  style={({ pressed }) => [
                    styles.deklansor,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  {cekiliyor ? (
                    <ActivityIndicator color={RenkTokenlari.bg} />
                  ) : (
                    <View style={styles.deklansorIc} />
                  )}
                </Pressable>
                <View style={{ width: 76 }} />
              </View>
            </View>
          </>
        ) : izinDurumu === 'yukleniyor' ? (
          <View style={styles.merkez}>
            <ActivityIndicator color={RenkTokenlari.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.izinKap, { paddingTop: insets.top + 40 }]}>
            <View style={styles.izinIkon}>
              <Ionicons name="videocam-off-outline" size={26} color={RenkTokenlari.accent} />
            </View>
            <Text style={styles.izinBaslik}>{t('verify.kameraIzinBaslik')}</Text>
            <Text style={styles.izinMetin}>{t('verify.kameraIzinMetin')}</Text>
            {izin && !izin.canAskAgain ? (
              <Text style={styles.izinMetin}>{t('verify.kameraIzinReddedildi')}</Text>
            ) : null}
            <Pressable onPress={() => void izinVer()} style={styles.izinDugme}>
              <Text style={styles.izinDugmeYazi}>{t('verify.kameraIzinVer')}</Text>
            </Pressable>
            {galeriIzinli ? (
              <Pressable onPress={() => void galeridenSec()} style={styles.izinIkincil}>
                <Text style={styles.izinIkincilYazi}>{t('verify.galeridenSec')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={kapat} style={styles.izinIkincil}>
              <Text style={styles.izinIkincilYazi}>{t('verify.kapat')}</Text>
            </Pressable>
          </ScrollView>
        )}

        {hata ? (
          <View style={[styles.hataKap, { bottom: insets.bottom + 90 }]}>
            <Ionicons name="alert-circle" size={15} color={RenkTokenlari.danger} />
            <Text style={styles.hataYazi}>{hata}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: '#000' },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onizleme: { flex: 1, width: '100%', backgroundColor: '#000' },
  ustBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.sm,
    gap: BoslukTokenlari.sm,
  },
  ustDugme: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ustBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  altPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.md,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  ipucu: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    textAlign: 'center',
    fontWeight: '700',
  },
  ipucuAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  deklansorSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  galeriDugme: {
    width: 76,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
  },
  galeriYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textOnOverlay, fontSize: 9.5 },
  deklansor: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deklansorIc: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: RenkTokenlari.textOnOverlay,
  },
  analizSatir: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  analizYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textOnOverlay, flex: 1 },
  uyariKutu: {
    flexDirection: 'row',
    gap: 7,
    padding: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  uyariMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.warning,
    fontSize: 10.5,
    lineHeight: 14,
  },
  onNot: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9.5,
    lineHeight: 13,
  },
  dugmeSatir: { flexDirection: 'row', gap: 9, marginTop: 2 },
  yeniden: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  yenidenYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
  kullan: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.accent,
  },
  kullanYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  izinKap: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  izinIkon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}1F`,
    marginBottom: BoslukTokenlari.sm,
  },
  izinBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnOverlay,
    textAlign: 'center',
  },
  izinMetin: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 19,
  },
  izinDugme: {
    marginTop: BoslukTokenlari.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.accent,
  },
  izinDugmeYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  izinIkincil: { paddingVertical: 11, alignSelf: 'stretch', alignItems: 'center' },
  izinIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  hataKap: {
    position: 'absolute',
    left: BoslukTokenlari.lg,
    right: BoslukTokenlari.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  hataYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    flex: 1,
    fontSize: 10.5,
  },
});
