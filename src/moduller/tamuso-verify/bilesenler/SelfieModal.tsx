/**
 * Canlı selfie akışı — oval çerçeve + sunucudan gelen hareket sırası.
 *
 * DÜRÜSTLÜK NOTU: Bu ekran yüz algılama veya anti-spoofing yaptığını İDDİA ETMEZ.
 * Hareketler yönlendirme adımlarıdır; görüntü kalitesi ön kontrolden geçer,
 * nihai kimlik/canlılık değerlendirmesi yetkili inceleme ekibindedir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { adimAnahtari, kaliteAnahtari } from '../HataCeviri';
import {
  GoruntuAnalizKopru,
  type GoruntuAnalizHandle,
} from '../GoruntuAnalizKopru';
import type {
  VerifyAdim,
  VerifyBelgeKalitesi,
  VerifyOturum,
} from '../tipler';
import { YuzCercevesi } from './VerifyParcalari';

type Props = {
  gorunur: boolean;
  oturum: VerifyOturum | null;
  oturumYukleniyor: boolean;
  hata: string | null;
  kalanDeneme: number;
  gonderiliyor: boolean;
  onKapat: () => void;
  onOturumYenile: () => void;
  onTamam: (girdi: {
    uri: string;
    genislik: number;
    yukseklik: number;
    kalite: VerifyBelgeKalitesi;
    tamamlanan: VerifyAdim[];
  }) => void;
};

function adimIkonu(adim: VerifyAdim): React.ComponentProps<typeof Ionicons>['name'] {
  switch (adim) {
    case 'right':
      return 'arrow-forward-circle-outline';
    case 'left':
      return 'arrow-back-circle-outline';
    case 'blink':
      return 'eye-outline';
    case 'smile':
      return 'happy-outline';
    default:
      return 'person-circle-outline';
  }
}

async function dosyaBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

export function SelfieModal({
  gorunur,
  oturum,
  oturumYukleniyor,
  hata,
  kalanDeneme,
  gonderiliyor,
  onKapat,
  onOturumYenile,
  onTamam,
}: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const camRef = useRef<CameraView>(null);
  const kopruRef = useRef<GoruntuAnalizHandle>(null);

  const [izin, izinIste] = useCameraPermissions();
  const [adimIndex, setAdimIndex] = useState(0);
  const [tamamlanan, setTamamlanan] = useState<VerifyAdim[]>([]);
  const [kalanSaniye, setKalanSaniye] = useState(180);
  const [geriSayim, setGeriSayim] = useState<number | null>(null);
  const [foto, setFoto] = useState<{ uri: string; w: number; h: number } | null>(null);
  const [kalite, setKalite] = useState<VerifyBelgeKalitesi | null>(null);
  const [analizEdiliyor, setAnalizEdiliyor] = useState(false);
  const [yerelHata, setYerelHata] = useState<string | null>(null);

  const adimlar = useMemo<VerifyAdim[]>(
    () => (oturum?.challenge_sequence?.length ? oturum.challenge_sequence : ['center']),
    [oturum],
  );

  // Oturum değişince akışı sıfırla
  useEffect(() => {
    if (!gorunur) return;
    setAdimIndex(0);
    setTamamlanan([]);
    setFoto(null);
    setKalite(null);
    setYerelHata(null);
    setGeriSayim(null);
  }, [gorunur, oturum?.session_id]);

  // Sunucu süresi: istemci saati değil, dönen saniye sayılır
  useEffect(() => {
    if (!gorunur || !oturum) return;
    const bitis = Date.now() + Math.max(0, oturum.sure_saniye) * 1000;
    const guncelle = () => {
      const kalan = Math.max(0, Math.ceil((bitis - Date.now()) / 1000));
      setKalanSaniye(kalan);
    };
    guncelle();
    const zaman = setInterval(guncelle, 1000);
    return () => clearInterval(zaman);
  }, [gorunur, oturum]);

  const sureDoldu = Boolean(oturum) && kalanSaniye <= 0;
  const denemeBitti = kalanDeneme <= 0;

  const kapat = useCallback(() => {
    setFoto(null);
    setKalite(null);
    setGeriSayim(null);
    onKapat();
  }, [onKapat]);

  const adimTamam = useCallback(() => {
    if (!oturum || sureDoldu || denemeBitti) return;
    const adim = adimlar[adimIndex];
    if (!adim) return;
    setTamamlanan((eski) => (eski.includes(adim) ? eski : [...eski, adim]));
    if (adimIndex >= adimlar.length - 1) {
      // Son adım: kısa geri sayım sonrası kare alınır
      let sayi = 3;
      setGeriSayim(sayi);
      const zaman = setInterval(() => {
        sayi -= 1;
        if (sayi <= 0) {
          clearInterval(zaman);
          setGeriSayim(null);
          void (async () => {
            try {
              const kare = await camRef.current?.takePictureAsync({
                quality: 0.8,
                exif: false,
              });
              if (!kare?.uri) return;
              setFoto({ uri: kare.uri, w: kare.width ?? 0, h: kare.height ?? 0 });
              setKalite(null);
              setAnalizEdiliyor(true);
              const b64 = await dosyaBase64(kare.uri);
              const metrik = b64 ? await kopruRef.current?.analizEt(b64) : null;
              setKalite(metrik ? kaliteDegerlendir(metrik) : bilinmeyenKalite());
              setAnalizEdiliyor(false);
            } catch {
              setAnalizEdiliyor(false);
              setYerelHata(t('verify.hataGenel'));
            }
          })();
        } else {
          setGeriSayim(sayi);
        }
      }, 800);
    } else {
      setAdimIndex((i) => i + 1);
    }
  }, [adimIndex, adimlar, denemeBitti, oturum, sureDoldu, t]);

  const gonder = useCallback(() => {
    if (!foto || kalite?.state === 'failed') return;
    onTamam({
      uri: foto.uri,
      genislik: foto.w,
      yukseklik: foto.h,
      kalite: kalite ?? bilinmeyenKalite(),
      tamamlanan,
    });
  }, [foto, kalite, onTamam, tamamlanan]);

  const aktifAdim = adimlar[Math.min(adimIndex, adimlar.length - 1)] ?? 'center';
  const ilerleme = adimlar.length ? Math.min(1, tamamlanan.length / adimlar.length) : 0;

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

        {/* Üst bar */}
        <View style={[styles.ustBar, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={kapat} hitSlop={10} style={styles.ustDugme}>
            <Ionicons name="close" size={22} color={RenkTokenlari.textOnOverlay} />
          </Pressable>
          <View style={styles.ustOrta}>
            <Text style={styles.ustBaslik}>{t('verify.selfieBaslik')}</Text>
            {oturum ? (
              <Text style={styles.ustAlt}>
                {t('verify.sureKalan', { saniye: kalanSaniye })}
              </Text>
            ) : null}
          </View>
          <View style={styles.ustDugme} />
        </View>

        {oturumYukleniyor ? (
          <View style={styles.merkez}>
            <ActivityIndicator color={RenkTokenlari.accent} />
            <Text style={styles.merkezYazi}>{t('verify.selfieSuruyor')}</Text>
          </View>
        ) : denemeBitti ? (
          <ScrollView contentContainerStyle={styles.blokKap}>
            <Ionicons name="shield-outline" size={40} color={RenkTokenlari.warning} />
            <Text style={styles.blokBaslik}>{t('verify.denemeBitti')}</Text>
            <Text style={styles.blokMetin}>{t('verify.destekMetin')}</Text>
            <Pressable onPress={kapat} style={styles.blokDugme}>
              <Text style={styles.blokDugmeYazi}>{t('verify.kapat')}</Text>
            </Pressable>
          </ScrollView>
        ) : sureDoldu || !oturum ? (
          <ScrollView contentContainerStyle={styles.blokKap}>
            <Ionicons name="timer-outline" size={40} color={RenkTokenlari.warning} />
            <Text style={styles.blokBaslik}>{t('verify.hataOturumSuresi')}</Text>
            <Text style={styles.blokMetin}>
              {t('verify.denemeKalan', { sayi: kalanDeneme })}
            </Text>
            <Pressable onPress={onOturumYenile} style={styles.blokDugme}>
              <Text style={styles.blokDugmeYazi}>{t('verify.selfieBaslat')}</Text>
            </Pressable>
            <Pressable onPress={kapat} style={styles.blokIkincil}>
              <Text style={styles.blokIkincilYazi}>{t('verify.kapat')}</Text>
            </Pressable>
          </ScrollView>
        ) : foto ? (
          <>
            <Image source={{ uri: foto.uri }} style={styles.onizleme} resizeMode="cover" />
            <View style={[styles.altPanel, { paddingBottom: insets.bottom + 14 }]}>
              {analizEdiliyor ? (
                <View style={styles.satir}>
                  <ActivityIndicator size="small" color={RenkTokenlari.accent} />
                  <Text style={styles.satirYazi}>{t('verify.kontrolEdiliyor')}</Text>
                </View>
              ) : kalite && kalite.kodlar.length > 0 ? (
                <View style={styles.uyariKutu}>
                  <Ionicons
                    name={kalite.state === 'failed' ? 'close-circle' : 'warning'}
                    size={15}
                    color={kalite.state === 'failed' ? RenkTokenlari.danger : RenkTokenlari.warning}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    {kalite.kodlar.map((k) => (
                      <Text
                        key={k}
                        style={[
                          styles.uyariYazi,
                          kalite.state === 'failed' && { color: RenkTokenlari.danger },
                        ]}
                      >
                        {t(kaliteAnahtari(k))}
                      </Text>
                    ))}
                  </View>
                </View>
              ) : kalite ? (
                <View style={styles.satir}>
                  <Ionicons name="checkmark-circle" size={15} color={RenkTokenlari.mint} />
                  <Text style={[styles.satirYazi, { color: RenkTokenlari.mint }]}>
                    {t('verify.kaliteTamam')}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.onNot}>{t('verify.selfieNot')}</Text>

              <View style={styles.dugmeSatir}>
                <Pressable
                  onPress={() => {
                    setFoto(null);
                    setKalite(null);
                    setAdimIndex(0);
                    setTamamlanan([]);
                  }}
                  style={styles.yeniden}
                >
                  <Ionicons name="refresh" size={16} color={RenkTokenlari.textOnOverlay} />
                  <Text style={styles.yenidenYazi}>{t('verify.tekrarCek')}</Text>
                </Pressable>
                <Pressable
                  onPress={gonder}
                  disabled={gonderiliyor || analizEdiliyor || kalite?.state === 'failed'}
                  style={[
                    styles.gonder,
                    (gonderiliyor || analizEdiliyor || kalite?.state === 'failed') && {
                      opacity: 0.45,
                    },
                  ]}
                >
                  {gonderiliyor ? (
                    <ActivityIndicator size="small" color={RenkTokenlari.bg} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={17} color={RenkTokenlari.bg} />
                      <Text style={styles.gonderYazi}>{t('verify.selfieGonder')}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        ) : izin?.granted ? (
          <>
            <CameraView
              ref={camRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              animateShutter={false}
              mirror
            />
            <YuzCercevesi durum={geriSayim != null ? 'tarama' : 'bekliyor'} />

            {geriSayim != null ? (
              <View style={styles.geriSayimKap} pointerEvents="none">
                <Text style={styles.geriSayimYazi}>{geriSayim}</Text>
              </View>
            ) : null}

            <View style={[styles.altPanel, { paddingBottom: insets.bottom + 14 }]}>
              <View style={styles.ilerlemeRay}>
                <View style={[styles.ilerlemeDolu, { width: `${Math.max(4, ilerleme * 100)}%` }]} />
              </View>
              <View style={styles.adimKart}>
                <View style={styles.adimIkonKap}>
                  <Ionicons
                    name={adimIkonu(aktifAdim)}
                    size={22}
                    color={RenkTokenlari.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adimBaslik}>{t(adimAnahtari(aktifAdim))}</Text>
                  <Text style={styles.adimAlt}>{t('verify.selfieIpucu')}</Text>
                </View>
              </View>

              <View style={styles.adimNoktaSatir}>
                {adimlar.map((a, i) => (
                  <View
                    key={`${a}-${i}`}
                    style={[
                      styles.adimNokta,
                      tamamlanan.includes(a) && styles.adimNoktaTamam,
                      i === adimIndex && !tamamlanan.includes(a) && styles.adimNoktaAktif,
                    ]}
                  />
                ))}
                <Text style={styles.adimSayac}>
                  {t('verify.denemeKalan', { sayi: kalanDeneme })}
                </Text>
              </View>

              <Pressable
                onPress={adimTamam}
                disabled={geriSayim != null}
                style={({ pressed }) => [
                  styles.hazir,
                  (geriSayim != null || pressed) && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.hazirYazi}>
                  {geriSayim != null ? t('verify.cekiyoruz') : t('verify.hazir')}
                </Text>
              </Pressable>
              <Text style={styles.onNot}>{t('verify.selfieNot')}</Text>
            </View>
          </>
        ) : izin == null ? (
          <View style={styles.merkez}>
            <ActivityIndicator color={RenkTokenlari.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.blokKap}>
            <View style={styles.izinIkon}>
              <Ionicons name="camera-reverse-outline" size={26} color={RenkTokenlari.accent} />
            </View>
            <Text style={styles.blokBaslik}>{t('verify.kameraIzinBaslik')}</Text>
            <Text style={styles.blokMetin}>{t('verify.kameraIzinMetin')}</Text>
            <Pressable
              onPress={() => {
                void izinIste().then((n) => {
                  if (!n.granted) setYerelHata(t('verify.kameraIzinReddedildi'));
                });
              }}
              style={styles.blokDugme}
            >
              <Text style={styles.blokDugmeYazi}>{t('verify.kameraIzinVer')}</Text>
            </Pressable>
            <Pressable onPress={kapat} style={styles.blokIkincil}>
              <Text style={styles.blokIkincilYazi}>{t('verify.kapat')}</Text>
            </Pressable>
          </ScrollView>
        )}

        {hata || yerelHata ? (
          <View style={[styles.hataKap, { bottom: insets.bottom + 120 }]}>
            <Ionicons name="alert-circle" size={15} color={RenkTokenlari.danger} />
            <Text style={styles.hataYazi}>{hata ?? yerelHata}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1, backgroundColor: '#000' },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  merkezYazi: { ...TipografiTokenlari.caption, color: 'rgba(255,255,255,0.75)' },
  onizleme: { flex: 1, width: '100%' },
  ustBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.sm,
  },
  ustOrta: { flex: 1, alignItems: 'center', gap: 1 },
  ustDugme: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  ustBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '800',
  },
  ustAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
  },
  altPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.md,
    gap: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  satirYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textOnOverlay, flex: 1 },
  uyariKutu: {
    flexDirection: 'row',
    gap: 7,
    padding: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  uyariYazi: {
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
  dugmeSatir: { flexDirection: 'row', gap: 9 },
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
  gonder: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.accent,
  },
  gonderYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  geriSayimKap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  geriSayimYazi: {
    fontSize: 82,
    fontWeight: '800',
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.9,
  },
  ilerlemeRay: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  ilerlemeDolu: { height: 3, borderRadius: 2, backgroundColor: RenkTokenlari.accent },
  adimKart: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adimIkonKap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}24`,
  },
  adimBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnOverlay,
    fontSize: 16.5,
  },
  adimAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 10,
    letterSpacing: 0.1,
  },
  adimNoktaSatir: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  adimNokta: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  adimNoktaTamam: { backgroundColor: RenkTokenlari.mint },
  adimNoktaAktif: { backgroundColor: RenkTokenlari.accent, width: 18 },
  adimSayac: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9.5,
    marginLeft: 'auto',
  },
  hazir: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.accent,
  },
  hazirYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  blokKap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  blokBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnOverlay,
    textAlign: 'center',
  },
  blokMetin: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    lineHeight: 19,
  },
  blokDugme: {
    marginTop: BoslukTokenlari.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.accent,
  },
  blokDugmeYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.bg,
    fontWeight: '800',
  },
  blokIkincil: { paddingVertical: 11, alignSelf: 'stretch', alignItems: 'center' },
  blokIkincilYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
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
  hataKap: {
    position: 'absolute',
    left: BoslukTokenlari.lg,
    right: BoslukTokenlari.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  hataYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    flex: 1,
    fontSize: 10.5,
  },
});
