/**
 * Profil / ayarlar menüsünde Tamuso Verify satırı.
 *
 * Kullanıcının gerçek kimlik doğrulama durumunu gösterir ve doğrulama
 * akışına yönlendirir. Durum sunucudan (`identity_durumum`) okunur;
 * istemci hiçbir durum alanı yazmaz.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCeviri } from '../../../i18n/useCeviri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari, YaricapTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { VerifyDurumuGetir } from '../VerifyApi';
import { durumAciklamaAnahtari, durumBaslikAnahtari } from '../HataCeviri';
import type { VerifyDurumKodu } from '../tipler';

type Props = {
  onPress: () => void;
  last?: boolean;
};

function durumRengi(durum: VerifyDurumKodu | null): string {
  switch (durum) {
    case 'approved':
      return RenkTokenlari.mint;
    case 'rejected':
      return RenkTokenlari.danger;
    case 'under_review':
    case 'additional_verification':
    case 'appeal_review':
      return RenkTokenlari.accent;
    case 'in_progress':
    case 'awaiting_document':
    case 'awaiting_selfie':
      return RenkTokenlari.accent;
    default:
      return RenkTokenlari.textDim;
  }
}

export function VerifyProfilSatiri({ onPress, last }: Props) {
  const { t } = useCeviri();
  const [durum, setDurum] = useState<VerifyDurumKodu | null>(null);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      void VerifyDurumuGetir()
        .then((d) => {
          if (!iptal) setDurum(d.status);
        })
        .catch(() => {
          if (!iptal) setDurum(null);
        });
      return () => {
        iptal = true;
      };
    }, []),
  );

  const onayli = durum === 'approved';
  const reddedildi = durum === 'rejected';
  const renk = durumRengi(durum);
  const deger = t(durumBaslikAnahtari(durum ?? 'not_started'));
  const aciklama = t(durumAciklamaAnahtari(durum ?? 'not_started'));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('verify.profilSatiri')}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${renk}1F` }]}>
        <Ionicons
          name={onayli ? 'shield-checkmark' : reddedildi ? 'shield-outline' : 'shield-half-outline'}
          size={18}
          color={renk}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label} numberOfLines={1}>
          {t('verify.profilSatiri')}
        </Text>
        <Text style={styles.hint} numberOfLines={2}>
          {aciklama}
        </Text>
      </View>
      <View style={[styles.rozet, { backgroundColor: `${renk}1F` }]}>
        <Text style={[styles.rozetYazi, { color: renk }]} numberOfLines={1}>
          {deger}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    minHeight: 56,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: YaricapTokenlari.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    lineHeight: 14,
  },
  rozet: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    maxWidth: 104,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 9.5,
    fontWeight: '800',
  },
});
