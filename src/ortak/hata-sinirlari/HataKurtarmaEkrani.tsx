import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { guvenliGeriDon } from '../../components/EkranBasligi';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  baslik?: string;
  aciklama?: string;
  detay?: string | null;
  onTekrarDene?: () => void;
  onGeriDon?: () => void;
  fallbackHref?: Href;
  /** kart: panel ici; ekran: tam sayfa kurtarma */
  varyant?: 'kart' | 'ekran';
};

/**
 * Ozellik bozulunca kullanici sayfada takilmaz — tekrar dene / geri don.
 */
export function HataKurtarmaEkrani({
  baslik = 'Bu bölüm geçici olarak kullanılamıyor',
  aciklama = 'Diğer özellikler çalışmaya devam eder. Geri dönüp uygulamayı kullanabilirsin.',
  detay,
  onTekrarDene,
  onGeriDon,
  fallbackHref = '/(tabs)',
  varyant = 'ekran',
}: Props) {
  const geri = () => {
    if (onGeriDon) {
      onGeriDon();
      return;
    }
    try {
      guvenliGeriDon(fallbackHref);
    } catch {
      router.replace('/(tabs)' as Href);
    }
  };

  return (
    <View style={[styles.wrap, varyant === 'ekran' && styles.wrapEkran]}>
      <View style={[styles.kart, varyant === 'ekran' && styles.kartEkran]}>
        <View style={styles.ikonWrap}>
          <Ionicons
            name="warning-outline"
            size={28}
            color={RenkTokenlari.primarySoft}
          />
        </View>
        <Text style={styles.baslik}>{baslik}</Text>
        <Text style={styles.aciklama}>{aciklama}</Text>
        {detay ? (
          <Text style={styles.detay} numberOfLines={3}>
            {detay}
          </Text>
        ) : null}

        <View style={styles.aksiyonlar}>
          {onTekrarDene ? (
            <Pressable
              onPress={onTekrarDene}
              style={({ pressed }) => [
                styles.btnPrimary,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Tekrar dene"
            >
              <Text style={styles.btnPrimaryText}>Tekrar dene</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={geri}
            style={({ pressed }) => [
              styles.btnGeri,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={RenkTokenlari.mint}
            />
            <Text style={styles.btnGeriText}>Geri dön</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            try {
              router.replace('/(tabs)' as Href);
            } catch {
              /* ignore */
            }
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ana sayfaya git"
        >
          <Text style={styles.anaLink}>Ana sayfaya git</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: BoslukTokenlari.md,
  },
  wrapEkran: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: BoslukTokenlari.xl,
    backgroundColor: RenkTokenlari.bg,
  },
  kart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  kartEkran: {
    width: '100%',
    maxWidth: 420,
    padding: BoslukTokenlari.xl,
  },
  ikonWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
    marginBottom: 4,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  aciklama: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
  detay: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginTop: 4,
  },
  aksiyonlar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.md,
  },
  btnPrimary: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  btnPrimaryText: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
  btnGeri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnGeriText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '800',
  },
  pressed: { opacity: 0.85 },
  anaLink: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginTop: BoslukTokenlari.md,
    textAlign: 'center',
  },
});
