import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import {
  PlatformIletisimAyariniGetir,
  VARSAYILAN_PLATFORM_ILETISIM,
  type PlatformIletisimAyar,
} from '../../platform-iletisim/islemler/PlatformIletisimIslemleri';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  onCikis: () => void;
};

async function mailtoAc(email: string, konu: string, epostaBaslik: string) {
  const url = `mailto:${email}?subject=${encodeURIComponent(konu)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(epostaBaslik, email);
  }
}

async function whatsappAc(e164: string, mesaj: string, waBaslik: string) {
  const phone = e164.replace(/\D/g, '');
  const text = encodeURIComponent(mesaj);
  const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
  const webUrl = `https://wa.me/${phone}?text=${text}`;
  try {
    const can = await Linking.canOpenURL(appUrl);
    await Linking.openURL(can ? appUrl : webUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(waBaslik, phone);
    }
  }
}

/** Hamburger altı — kurumsal iletişim (yatay) + çıkış */
export function HamburgerIletisimAlt({ onCikis }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const [ayar, setAyar] = useState<PlatformIletisimAyar>(
    VARSAYILAN_PLATFORM_ILETISIM,
  );

  const yukle = useCallback(() => {
    void PlatformIletisimAyariniGetir().then(setAyar);
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  useFocusEffect(
    useCallback(() => {
      yukle();
    }, [yukle]),
  );

  const iletisimBaslik =
    !ayar.baslik?.trim() ||
    ayar.baslik.trim() === VARSAYILAN_PLATFORM_ILETISIM.baslik
      ? t('anaSayfa.iletisimBaslik')
      : ayar.baslik;

  return (
    <View style={styles.wrap}>
      <Text style={styles.baslik} numberOfLines={1}>
        {iletisimBaslik}
      </Text>

      <View style={styles.yatay}>
        <Pressable
          onPress={() => void mailtoAc(ayar.support_email, t('anaSayfa.mailKonu'), t('ortak.eposta'))}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${t('ortak.eposta')} ${ayar.support_email}`}
        >
          <Ionicons
            name="mail-outline"
            size={14}
            color={RenkTokenlari.primarySoft}
          />
          <Text style={styles.chipYazi} numberOfLines={1}>
            {t('ortak.eposta')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => void whatsappAc(ayar.whatsapp_e164, t('anaSayfa.whatsappMesaj'), t('ortak.whatsapp'))}
          style={({ pressed }) => [
            styles.chip,
            styles.chipWa,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t('ortak.whatsapp')} ${ayar.whatsapp_gorunen}`}
        >
          <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
          <Text style={styles.chipYazi} numberOfLines={1}>
            {t('ortak.whatsapp')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onCikis}
        style={({ pressed }) => [styles.cikis, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('auth.cikisYap')}
        hitSlop={8}
      >
        <Ionicons name="close" size={20} color={RenkTokenlari.danger} />
        <Text style={styles.cikisYazi}>{t('auth.cikisYap')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    gap: 8,
    paddingBottom: 8,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  yatay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    maxWidth: '100%',
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    overflow: 'hidden',
  },
  chipWa: {
    borderColor: 'rgba(37,211,102,0.28)',
    backgroundColor: 'rgba(37,211,102,0.08)',
  },
  chipYazi: {
    ...TipografiTokenlari.caption,
    fontSize: 11,
    fontWeight: '700',
    color: RenkTokenlari.text,
    flexShrink: 1,
  },
  pressed: { opacity: 0.82 },
  cikis: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    width: '100%',
    maxWidth: '100%',
  },
  cikisYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    fontWeight: '700',
  },
});
