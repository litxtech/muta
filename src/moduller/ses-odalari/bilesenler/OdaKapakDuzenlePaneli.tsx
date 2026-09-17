import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '../../../components/TextField';
import { GradientButton } from '../../../components/GradientButton';
import { useKlavyeYuksekligi } from '../../../bilesenler/klavye/useKlavyeYuksekligi';
import { OdaBilgileriniGuncelle } from '../islemler/OdaBilgileriniGuncelle';
import { OdaKoltukSayisiniAyarla } from '../islemler/OdaKoltukSayisiniAyarla';
import {
  ODA_KOLTUK_MAX,
  ODA_KOLTUK_MIN,
} from '../islemler/OdaKoltukSinirlari';
import {
  OdaKapakSec,
  OdaKapakUriIleYukle,
} from '../islemler/OdaKapakMedyasiYukle';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  roomId: string;
  title: string;
  topic: string | null;
  coverUrl: string | null;
  maxSeats: number;
  /** Dolu mikrofon koltuğu sayısı (azaltmada uyarı için) */
  doluKoltuk: number;
  onClose: () => void;
  onKaydedildi: (next: {
    title: string;
    topic: string | null;
    cover_url: string | null;
    max_seats?: number;
    capacity_tier_code?: string | null;
  }) => void;
};

/** Lider: oda kapak + başlık + açıklama + koltuk sayısı düzenler */
export function OdaKapakDuzenlePaneli({
  visible,
  roomId,
  title: baslikIlk,
  topic: topicIlk,
  coverUrl: kapakIlk,
  maxSeats: maxSeatsIlk,
  doluKoltuk,
  onClose,
  onKaydedildi,
}: Props) {
  const insets = useSafeAreaInsets();
  const { yukseklik: klavyeH, acik: klavyeAcik } = useKlavyeYuksekligi();
  const scrollRef = useRef<ScrollView>(null);
  const [title, setTitle] = useState(baslikIlk);
  const [topic, setTopic] = useState(topicIlk ?? '');
  const [kapakUrl, setKapakUrl] = useState<string | null>(kapakIlk);
  const [maxSeats, setMaxSeats] = useState(
    Math.min(ODA_KOLTUK_MAX, Math.max(ODA_KOLTUK_MIN, maxSeatsIlk || 8)),
  );
  const [yerelUri, setYerelUri] = useState<string | null>(null);
  const [yerelMime, setYerelMime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kapakBusy, setKapakBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(baslikIlk);
    setTopic(topicIlk ?? '');
    setKapakUrl(kapakIlk);
    setMaxSeats(
      Math.min(ODA_KOLTUK_MAX, Math.max(ODA_KOLTUK_MIN, maxSeatsIlk || 8)),
    );
    setYerelUri(null);
    setYerelMime(null);
  }, [visible, baslikIlk, topicIlk, kapakIlk, maxSeatsIlk]);
  useEffect(() => {
    if (!visible || !klavyeAcik) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === 'android' ? 80 : 40);
    return () => clearTimeout(t);
  }, [visible, klavyeAcik, klavyeH]);

  const onizlemeUri = yerelUri ?? kapakUrl;
  const onizlemeBaslik = title.trim() || 'Oda adı';
  const onizlemeKonu = topic.trim();

  const kapakSec = async () => {
    setKapakBusy(true);
    try {
      const sec = await OdaKapakSec();
      if (!sec.ok) {
        if (!sec.iptal) Alert.alert('Kapak', sec.hata);
        return;
      }
      setYerelUri(sec.uri);
      setYerelMime(sec.mimeType ?? null);
    } finally {
      setKapakBusy(false);
    }
  };

  const koltukUygula = async (
    hedef: number,
  ): Promise<{
    max_seats: number;
    capacity_tier_code?: string | null;
  } | null> => {
    const r = await OdaKoltukSayisiniAyarla(roomId, hedef);
    if (!r.ok) {
      Alert.alert('Koltuk', r.hata);
      return null;
    }
    if (r.kicked > 0) {
      Alert.alert(
        'Koltuk',
        `${r.kicked} kişi (en son gelenler) koltuktan düşürüldü.`,
      );
    }
    return {
      max_seats: r.maxSeats,
      capacity_tier_code: r.capacityTierCode,
    };
  };

  const kaydet = async () => {
    const baslik = title.trim();
    if (!baslik) {
      Alert.alert('Oda', 'Başlık gerekli');
      return;
    }

    const onceki = Math.min(
      ODA_KOLTUK_MAX,
      Math.max(ODA_KOLTUK_MIN, maxSeatsIlk || 8),
    );
    const fazla =
      maxSeats < onceki ? Math.max(0, doluKoltuk - maxSeats) : 0;

    const devamEt = async () => {
      setBusy(true);
      try {
        let cover = kapakUrl;
        if (yerelUri) {
          const up = await OdaKapakUriIleYukle(yerelUri, yerelMime);
          if (!up.ok) {
            Alert.alert('Kapak', up.hata);
            return;
          }
          cover = up.url;
        }

        const r = await OdaBilgileriniGuncelle({
          roomId,
          title: baslik,
          topic: topic.trim() || null,
          coverUrl: cover,
        });
        if (!r.ok) {
          Alert.alert('Oda', r.hata);
          return;
        }

        let koltukPatch: {
          max_seats?: number;
          capacity_tier_code?: string | null;
        } = {};
        if (maxSeats !== onceki) {
          const k = await koltukUygula(maxSeats);
          if (!k) return;
          koltukPatch = k;
          setMaxSeats(k.max_seats);
        }

        onKaydedildi({
          title: baslik,
          topic: topic.trim() || null,
          cover_url: cover,
          ...koltukPatch,
        });
        onClose();
      } finally {
        setBusy(false);
      }
    };

    if (fazla > 0) {
      Alert.alert(
        'Koltuk sayısı',
        `${maxSeats} koltuğa inince ${fazla} kişi (en son gelenler) otomatik koltuktan düşürülecek. Devam edilsin mi?`,
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Uygula', style: 'destructive', onPress: () => void devamEt() },
        ],
      );
      return;
    }

    await devamEt();
  };
  const alanOdak = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  /** Modal Android'de window resize almaz — sheet'i klavye üstüne taşı */
  const sheetBottomPad =
    Math.max(insets.bottom, 16) + 8 + (klavyeAcik ? Math.max(klavyeH, 0) : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.kok}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: sheetBottomPad,
              maxHeight: klavyeAcik ? '78%' : '92%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.ust}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.baslik}>Oda kartı & arka plan</Text>
              <Text style={styles.alt}>
                Kapak resmi keşfette ve odada tam ekran arka plan olarak görünür
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.kapatBtn}
              hitSlop={8}
              accessibilityLabel="Kapat"
            >
              <Ionicons
                name="close"
                size={20}
                color={RenkTokenlari.textMuted}
              />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            bounces={false}
          >
            {!klavyeAcik ? (
              <>
                <Text style={styles.onizlemeEtiket}>Önizleme</Text>
                <Pressable
                  onPress={() => void kapakSec()}
                  disabled={kapakBusy || busy}
                  style={styles.kartOnizleme}
                  accessibilityLabel="Kapak seç"
                >
                  {onizlemeUri ? (
                    <Image
                      source={{ uri: onizlemeUri }}
                      style={styles.kapak}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={['#2A1A32', '#16101E']}
                      style={styles.kapak}
                    />
                  )}
                  <LinearGradient
                    colors={['rgba(14,8,20,0.15)', 'rgba(14,8,20,0.92)']}
                    style={styles.kartOverlay}
                  />
                  <View style={styles.kartUst} pointerEvents="none">
                    <View style={styles.canliPill}>
                      <View style={styles.canliNokta} />
                      <Text style={styles.canliYazi}>CANLI</Text>
                    </View>
                  </View>
                  <View style={styles.kartAlt} pointerEvents="none">
                    <Text style={styles.kartBaslik} numberOfLines={2}>
                      {onizlemeBaslik}
                    </Text>
                    {onizlemeKonu ? (
                      <Text style={styles.kartKonu} numberOfLines={1}>
                        {onizlemeKonu}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.kapakAksiyon} pointerEvents="none">
                    {kapakBusy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={styles.kapakChip}>
                        <Ionicons
                          name="camera-outline"
                          size={14}
                          color="#fff"
                        />
                        <Text style={styles.kapakChipYazi}>
                          {onizlemeUri
                            ? yerelUri
                              ? 'Yeni arka plan'
                              : 'Değiştir'
                            : 'Arka plan ekle'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => void kapakSec()}
                disabled={kapakBusy || busy}
                style={styles.miniOnizleme}
                accessibilityLabel="Kapak önizleme"
              >
                {onizlemeUri ? (
                  <Image
                    source={{ uri: onizlemeUri }}
                    style={styles.miniKapak}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.miniKapak, styles.miniKapakBos]}>
                    <Ionicons
                      name="image-outline"
                      size={16}
                      color={RenkTokenlari.textMuted}
                    />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.miniBaslik} numberOfLines={1}>
                    {onizlemeBaslik}
                  </Text>
                  <Text style={styles.miniAlt} numberOfLines={1}>
                    {onizlemeKonu || 'Açıklama yok'}
                  </Text>
                </View>
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={RenkTokenlari.textMuted}
                />
              </Pressable>
            )}

            <TextField
              label="Başlık"
              value={title}
              onChangeText={setTitle}
              maxLength={40}
              placeholder="Oda adı"
              onFocus={() => alanOdak()}
            />
            <TextField
              label="Açıklama"
              value={topic}
              onChangeText={setTopic}
              maxLength={120}
              placeholder="Kısa konu / davet metni"
              multiline
              numberOfLines={2}
              onFocus={() => alanOdak()}
            />

            <Text style={styles.koltukEtiket}>Mikrofon koltuğu</Text>
            <Text style={styles.koltukAlt}>
              {ODA_KOLTUK_MIN}–{ODA_KOLTUK_MAX} arası · dolu {doluKoltuk}
              {maxSeats < (maxSeatsIlk || 8) && doluKoltuk > maxSeats
                ? ` · ${doluKoltuk - maxSeats} kişi düşer`
                : ''}
            </Text>
            <View style={styles.koltukSatir}>
              <Pressable
                onPress={() =>
                  setMaxSeats((n) => Math.max(ODA_KOLTUK_MIN, n - 1))
                }
                disabled={busy || maxSeats <= ODA_KOLTUK_MIN}
                style={[
                  styles.koltukBtn,
                  (busy || maxSeats <= ODA_KOLTUK_MIN) && styles.koltukBtnDisabled,
                ]}
                accessibilityLabel="Koltuk azalt"
                accessibilityRole="button"
              >
                <Ionicons
                  name="remove"
                  size={22}
                  color={
                    maxSeats <= ODA_KOLTUK_MIN
                      ? RenkTokenlari.textMuted
                      : RenkTokenlari.text
                  }
                />
              </Pressable>
              <Text style={styles.koltukSayi}>{maxSeats}</Text>
              <Pressable
                onPress={() =>
                  setMaxSeats((n) => Math.min(ODA_KOLTUK_MAX, n + 1))
                }
                disabled={busy || maxSeats >= ODA_KOLTUK_MAX}
                style={[
                  styles.koltukBtn,
                  (busy || maxSeats >= ODA_KOLTUK_MAX) && styles.koltukBtnDisabled,
                ]}
                accessibilityLabel="Koltuk artır"
                accessibilityRole="button"
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={
                    maxSeats >= ODA_KOLTUK_MAX
                      ? RenkTokenlari.textMuted
                      : RenkTokenlari.text
                  }
                />
              </Pressable>
            </View>

            <GradientButton
              title={busy ? 'Kaydediliyor…' : 'Kaydet'}
              onPress={() => void kaydet()}
              loading={busy}
              style={styles.cta}
            />
            <Pressable onPress={onClose} style={styles.iptal} disabled={busy}>
              <Text style={styles.iptalYazi}>Vazgeç</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: RenkTokenlari.surface,
    borderTopLeftRadius: YaricapTokenlari.lg + 4,
    borderTopRightRadius: YaricapTokenlari.lg + 4,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 8,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: BoslukTokenlari.sm,
  },
  kapatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 20,
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 2,
  },
  scroll: {
    gap: BoslukTokenlari.md,
    paddingBottom: 8,
  },
  onizlemeEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  kartOnizleme: {
    height: 168,
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  miniOnizleme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  miniKapak: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  miniKapakBos: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 14,
  },
  miniAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 1,
  },
  kapak: {
    ...StyleSheet.absoluteFillObject,
  },
  kartOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  kartUst: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  canliPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(232, 64, 145, 0.35)',
  },
  canliNokta: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RenkTokenlari.live,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kartAlt: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 2,
  },
  kartBaslik: {
    ...TipografiTokenlari.title,
    color: '#fff',
    fontSize: 16,
    lineHeight: 20,
  },
  kartKonu: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.78)',
  },
  kapakAksiyon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  kapakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(8,4,14,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  kapakChipYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '700',
  },
  koltukEtiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  koltukAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    marginBottom: 10,
  },
  koltukSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginBottom: BoslukTokenlari.md,
  },
  koltukBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  koltukBtnDisabled: {
    opacity: 0.45,
  },
  koltukSayi: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 28,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'center',
  },
  cta: { marginTop: 4 },
  iptal: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  iptalYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
