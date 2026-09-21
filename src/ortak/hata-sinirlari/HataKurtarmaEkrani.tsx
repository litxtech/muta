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
 * Tam sayfada içerik ve butonlar her zaman ortalanır.
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

  const ekran = varyant === 'ekran';

  return (
    <View style={[styles.wrap, ekran && styles.wrapEkran]}>
      <View style={[styles.kart, ekran && styles.kartEkran]}>
        <View style={styles.ikonWrap}>
          <Ionicons
            name="warning-outline"
            size={28}
            color={RenkTokenlari.primarySoft}
          />
        </View>
        <Text style={[styles.baslik, ekran && styles.metinOrtala]}>{baslik}</Text>
        <Text style={[styles.aciklama, ekran && styles.metinOrtala]}>
          {aciklama}
        </Text>
        {detay ? (
          <Text
            style={[styles.detay, ekran && styles.metinOrtala]}
            numberOfLines={3}
          >
            {detay}
          </Text>
        ) : null}

        <View style={[styles.aksiyonlar, ekran && styles.aksiyonlarOrtala]}>
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
          style={styles.anaLinkHit}
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
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
    paddingVertical: BoslukTokenlari.xxl,
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
    alignItems: 'center',
  },
  ikonWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
  metinOrtala: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  aksiyonlar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.md,
  },
  aksiyonlarOrtala: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
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
  anaLinkHit: {
    marginTop: BoslukTokenlari.md,
    alignSelf: 'center',
  },
  anaLink: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
  },
});
