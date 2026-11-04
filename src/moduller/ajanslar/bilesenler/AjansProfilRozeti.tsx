import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';
import type { AjansUyelikAjans } from '../okuma/AjansUyelikGetir';
import { AjansSahipRozeti } from './AjansSahipRozeti';

type Varyant = 'uye' | 'basvur' | 'beklemede';

type Props = {
  varyant: Varyant;
  ajans?: AjansUyelikAjans | null;
  /** Ajans sahibi: etiketin içinde küçük altın işaret */
  sahip?: boolean;
  onPress: () => void;
};

const ALTIN = '#C49A2A';

/**
 * Profil kimlik bloğundaki ajans etiketi (kullanıcı adı / ID satırının altında).
 * Tek satır, içerik kadar geniş; sahiplik ayrı satır değil, etiketin parçası.
 */
export function AjansProfilRozeti({ varyant, ajans, sahip = false, onPress }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const uye = varyant === 'uye';
  const beklemede = varyant === 'beklemede';
  const ad = ajans?.name?.trim() || t('ajans.baslik');
  const metin = uye
    ? ad
    : beklemede
      ? t('ajans.basvuruInceleniyor')
      : t('ajans.ajansaBasvur');
  const logo =
    uye && typeof ajans?.logo_url === 'string' && /^https?:\/\//i.test(ajans.logo_url.trim())
      ? ajans.logo_url.trim()
      : null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.etiket,
        uye ? styles.etiketUye : styles.etiketNotr,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        uye
          ? [ad, sahip ? t('ajans.sahipUnvan') : null, t('ajans.aksiyonProfil')]
              .filter(Boolean)
              .join(', ')
          : metin
      }
    >
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} />
      ) : (
        <View style={[styles.logo, uye ? styles.logoUye : styles.logoNotr]}>
          <Ionicons
            name={uye ? 'briefcase' : beklemede ? 'time-outline' : 'business-outline'}
            size={12}
            color={uye ? ALTIN : RenkTokenlari.textMuted}
          />
        </View>
      )}
      <Text style={[styles.yazi, !uye && styles.yaziNotr]} numberOfLines={1}>
        {metin}
      </Text>
      {uye && sahip ? <AjansSahipRozeti compact /> : null}
      {beklemede ? null : (
        <Ionicons
          name="chevron-forward"
          size={13}
          color={uye ? ALTIN : RenkTokenlari.textDim}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  etiket: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 30,
    paddingLeft: 4,
    paddingRight: 10,
    gap: 6,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
  },
  etiketUye: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderColor: 'rgba(212,175,55,0.45)',
  },
  etiketNotr: {
    backgroundColor: RenkTokenlari.chipFill,
    borderColor: RenkTokenlari.border,
  },
  pressed: { opacity: 0.8 },
  logo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoUye: { backgroundColor: 'rgba(212,175,55,0.18)' },
  logoNotr: { backgroundColor: RenkTokenlari.surface },
  yazi: {
    ...TipografiTokenlari.caption,
    flexShrink: 1,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  yaziNotr: {
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
