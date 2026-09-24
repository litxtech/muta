import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { DmMedyaKaynak, DmMedyaTuru } from '../islemler/DmMedyasiYukle';
import { useCeviri, type CeviriAnahtari } from '../../../i18n/useCeviri';

export type MesajMedyaSecim = {
  tur: DmMedyaTuru;
  kaynak: DmMedyaKaynak;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSec: (secim: MesajMedyaSecim) => void;
};

type Secenek = {
  id: string;
  tur: DmMedyaTuru;
  kaynak: DmMedyaKaynak;
  baslik: CeviriAnahtari;
  alt: CeviriAnahtari;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  vurgulu?: boolean;
};

const SECENEKLER: Secenek[] = [
  {
    id: 'kamera-foto',
    tur: 'image',
    kaynak: 'kamera',
    baslik: 'mesajlar.kamera',
    alt: 'mesajlar.fotoCek',
    icon: 'camera',
    tint: '#5ADCC8',
  },
  {
    id: 'kamera-video',
    tur: 'video',
    kaynak: 'kamera',
    baslik: 'mesajlar.kamera',
    alt: 'mesajlar.videoCek',
    icon: 'videocam',
    tint: '#C48CFF',
  },
  {
    id: 'galeri-foto',
    tur: 'image',
    kaynak: 'galeri',
    baslik: 'mesajlar.galeri',
    alt: 'mesajlar.fotoSec',
    icon: 'images',
    tint: '#FFB45A',
  },
  {
    id: 'galeri-video',
    tur: 'video',
    kaynak: 'galeri',
    baslik: 'mesajlar.galeriVideo',
    alt: 'mesajlar.videoSecGonder',
    icon: 'film',
    tint: '#7DD3FC',
    vurgulu: true,
  },
];

function SecimKarti({
  item,
  onPress,
}: {
  item: Secenek;
  onPress: () => void;
}) {
  const { t } = useCeviri();
  const baslik = t(item.baslik);
  const alt = t(item.alt);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.kartPress, pressed && styles.kartPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${baslik}: ${alt}`}
    >
      <LinearGradient
        colors={
          item.vurgulu
            ? [`${item.tint}55`, `${item.tint}22`, 'rgba(18,12,28,0.96)']
            : [`${item.tint}33`, 'rgba(22,18,32,0.97)', 'rgba(14,10,22,0.98)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[
          styles.kart,
          item.vurgulu && { borderColor: `${item.tint}99`, borderWidth: 1.5 },
        ]}
      >
        <View style={[styles.ikonKutu, { backgroundColor: `${item.tint}28` }]}>
          <Ionicons name={item.icon} size={26} color={item.tint} />
        </View>
        <Text style={styles.kartBaslik}>{baslik}</Text>
        <Text style={styles.kartAlt} numberOfLines={2}>
          {alt}
        </Text>
        {item.vurgulu ? (
          <View style={[styles.rozet, { backgroundColor: item.tint }]}>
            <Text style={styles.rozetYazi}>Video</Text>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

/** Modern medya seçim kartı — kamera / galeri foto & video */
export function MesajMedyaSecimPaneli({ visible, onClose, onSec }: Props) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();

  return (
    <TamusoModal
      visible={visible}
      onClose={onClose}
      placement="bottom"
      animationType="slide"
      contentStyle={styles.sheetWrap}
    >
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, BoslukTokenlari.lg) },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.baslikSatir}>
          <View style={styles.baslikMetin}>
            <Text style={styles.fisilti}>{t('mesajlar.medyaFisilti')}</Text>
            <Text style={styles.baslik}>{t('mesajlar.medyaBaslik')}</Text>
          </View>
          <Pressable
            style={styles.kapat}
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel={t('ortak.kapat')}
          >
            <Ionicons name="close" size={20} color={RenkTokenlari.textMuted} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {SECENEKLER.map((s) => (
            <SecimKarti
              key={s.id}
              item={s}
              onPress={() => {
                onClose();
                // Modal kapanmadan picker açılırsa iOS/Android takılabilir
                setTimeout(() => onSec({ tur: s.tur, kaynak: s.kaynak }), 280);
              }}
            />
          ))}
        </View>

        <Pressable
          style={styles.iptal}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('ortak.vazgec')}
        >
          <Text style={styles.iptalYazi}>{t('ortak.vazgec')}</Text>
        </Pressable>
      </View>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
    gap: BoslukTokenlari.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.border,
    marginBottom: 4,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  baslikMetin: {
    flex: 1,
    gap: 2,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 18,
  },
  kapat: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kartPress: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
  },
  kartPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  kart: {
    minHeight: 132,
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
    overflow: 'hidden',
  },
  ikonKutu: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kartBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 15,
  },
  kartAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
  },
  rozet: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    color: '#0B1220',
    fontWeight: '800',
    fontSize: 10,
  },
  iptal: {
    marginTop: 4,
    height: 48,
    borderRadius: YaricapTokenlari.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  iptalYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
