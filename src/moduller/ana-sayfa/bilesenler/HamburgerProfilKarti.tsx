import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  SayiKisaBicim,
  SeviyeXpOzetiHesapla,
} from '../../../tasarim-sistemi/premium/SeviyeXpHesap';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';
import { useDil } from '../../../i18n/DilSaglayici';
import { ilerlemeDolguStili, rtlMetinStili, ltrAlanStili } from '../../../i18n/rtl';

export type HamburgerProfilVeri = {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  level?: number | null;
  xp?: number | null;
};

type Props = {
  profil: HamburgerProfilVeri | null | undefined;
  onPress: () => void;
};

/** X tarzı profil — kart yok; avatar + ad + seviye çubuğu */
export function HamburgerProfilKarti({ profil, onPress }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const { rtl } = useDil();
  const metinRtl = rtlMetinStili(rtl, true);
  const ad = profil?.displayName?.trim() || t('ortak.kullanici');
  const harf = (ad[0] ?? 'K').toUpperCase();
  const avatar = MedyaUriGuvenli(profil?.avatarUrl);
  const ozet = SeviyeXpOzetiHesapla(profil?.level, profil?.xp);
  const barPct = Math.min(100, Math.max(2, Math.round(ozet.oran * 100)));

  const avatarBlok = (
    <LinearGradient
      colors={[...RenkTokenlari.gradientPrimary]}
      style={styles.avatarRing}
    >
      <View
        style={[styles.avatarIc, { backgroundColor: RenkTokenlari.bgElevated }]}
      >
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            style={styles.avatar}
          >
            <Text style={styles.avatarHarf}>{harf}</Text>
          </LinearGradient>
        )}
      </View>
    </LinearGradient>
  );

  const copyBlok = (
    <View style={styles.copy}>
      <Text style={[styles.ad, metinRtl]} numberOfLines={1} ellipsizeMode="tail">
        {ad}
      </Text>
      {profil?.username ? (
        <Text
          style={[styles.user, ltrAlanStili()]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          @{profil.username}
        </Text>
      ) : (
        <Text style={[styles.user, metinRtl]} numberOfLines={1} ellipsizeMode="tail">
          {t('anaSayfa.profiliGoruntule')}
        </Text>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.profil, pressed && styles.pressed]}
      accessibilityLabel={t('anaSayfa.profilimeGit')}
      accessibilityRole="button"
    >
      <View style={styles.ust}>
        {rtl ? (
          <>
            {copyBlok}
            {avatarBlok}
          </>
        ) : (
          <>
            {avatarBlok}
            {copyBlok}
          </>
        )}
      </View>

      <View style={styles.seviyeBlok}>
        <View style={styles.seviyeBaslik}>
          <Text style={[styles.seviyeEtiket, metinRtl]}>
            {t('profil.seviyeKisalt', { n: ozet.level })}
          </Text>
          <Text style={styles.xpYazi}>
            {SayiKisaBicim(ozet.xp)} / {SayiKisaBicim(ozet.sonrakiEsik)}
          </Text>
        </View>
        <View style={styles.barDis}>
          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            start={rtl ? { x: 1, y: 0 } : { x: 0, y: 0 }}
            end={rtl ? { x: 0, y: 0 } : { x: 1, y: 0 }}
            style={[styles.barIc, ilerlemeDolguStili(barPct, rtl)]}
          />
        </View>
      </View>
    </Pressable>
  );
}

type IstatistikProps = {
  coin: number;
  rozet: number;
  onCoinPress: () => void;
  onRozetPress: () => void;
};

/**
 * X tarzı takip sayıları — profil altında yatay:
 * 781K Coin · 2 Rozet
 */
export function HamburgerIstatistikler({
  coin,
  rozet,
  onCoinPress,
  onRozetPress,
}: IstatistikProps) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const { rtl } = useDil();
  const metinRtl = rtlMetinStili(rtl, true);

  const coinOge = (
    <Pressable
      onPress={onCoinPress}
      style={({ pressed }) => [styles.istatOge, pressed && styles.pressed]}
      accessibilityLabel={`${coin} ${t('anaSayfa.istatCoin')}`}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Text style={styles.istatRakam}>{SayiKisaBicim(coin)}</Text>
      <Text style={[styles.istatEtiket, metinRtl]}>{t('anaSayfa.istatCoin')}</Text>
    </Pressable>
  );
  const rozetOge = (
    <Pressable
      onPress={onRozetPress}
      style={({ pressed }) => [styles.istatOge, pressed && styles.pressed]}
      accessibilityLabel={`${rozet} ${t('anaSayfa.istatRozet')}`}
      accessibilityRole="button"
      hitSlop={8}
    >
      <Text style={styles.istatRakam}>{SayiKisaBicim(rozet)}</Text>
      <Text style={[styles.istatEtiket, metinRtl]}>{t('anaSayfa.istatRozet')}</Text>
    </Pressable>
  );

  return (
    <View style={styles.istatSatir}>
      {rtl ? (
        <>
          {rozetOge}
          {coinOge}
        </>
      ) : (
        <>
          {coinOge}
          {rozetOge}
        </>
      )}
    </View>
  );
}

/** Rozet sayısını çeken ince kanca — drawer açılış animasyonu bitsin diye gecikmeli */
export function useHamburgerRozetSayisi(aktif: boolean): number {
  const [sayi, setSayi] = useState(0);

  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    const timer = setTimeout(() => {
      void import('../../gorevler/okuma/RozetlerimiGetir')
        .then(({ RozetlerimiGetir }) => RozetlerimiGetir())
        .then((liste) => {
          if (!iptal) setSayi(liste.length);
        })
        .catch(() => {
          if (!iptal) setSayi(0);
        });
    }, 280);
    return () => {
      iptal = true;
      clearTimeout(timer);
    };
  }, [aktif]);

  return sayi;
}

const styles = StyleSheet.create({
  profil: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  pressed: { opacity: 0.75 },
  ust: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    padding: 2,
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarIc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  // Android: Image için sabit ölçü + borderRadius (yüzde kırpma güvenilmez)
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnPrimary,
    fontSize: 20,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  ad: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 18,
    fontWeight: '800',
  },
  user: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 14,
  },
  seviyeBlok: {
    gap: 6,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 10,
    direction: 'ltr',
  },
  seviyeBaslik: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  seviyeEtiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    fontSize: 12,
    flexShrink: 0,
  },
  barDis: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    backgroundColor: RenkTokenlari.pressFill,
    overflow: 'hidden',
  },
  barIc: {
    height: '100%',
    borderRadius: 2,
  },
  xpYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
    writingDirection: 'ltr',
  },
  /** Profil altında yatay — Following / Followers gibi */
  istatSatir: {
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    gap: 18,
    paddingHorizontal: 10,
    paddingBottom: 10,
    marginBottom: 4,
  },
  istatOge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  istatRakam: {
    fontSize: 14,
    fontWeight: '800',
    color: RenkTokenlari.text,
    writingDirection: 'ltr',
  },
  istatEtiket: {
    fontSize: 14,
    fontWeight: '500',
    color: RenkTokenlari.textMuted,
  },
});
