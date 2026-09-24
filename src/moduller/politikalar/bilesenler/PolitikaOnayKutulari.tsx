import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PolitikaGorunum } from '../tipler/PolitikaTipleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  politikalar: PolitikaGorunum[];
  onaylar: Record<string, boolean>;
  onDegisti: (kod: string, deger: boolean) => void;
  onOku: (kod: string) => void;
};

/** Kayıt — dinamik zorunlu politika onay kutuları */
export function PolitikaOnayKutulari({
  politikalar,
  onaylar,
  onDegisti,
  onOku,
}: Props) {
  const { t } = useCeviri();
  if (!politikalar.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.baslik}>{t('auth.yasalOnaylar')}</Text>
      {politikalar.map((p) => {
        const secili = !!onaylar[p.kod];
        return (
          <View key={p.kod} style={styles.satir}>
            <Pressable
              onPress={() => onDegisti(p.kod, !secili)}
              style={styles.kutuHit}
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: secili }}
            >
              <View style={[styles.kutu, secili && styles.kutuAktif]}>
                {secili ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : null}
              </View>
            </Pressable>
            <Pressable style={styles.metinHit} onPress={() => onOku(p.kod)}>
              <Text style={styles.etiket}>
                {p.onayEtiketi} <Text style={styles.link}>{t('auth.politikayiOku')}</Text>
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function TumPolitikaOnaylariVerildi(
  politikalar: PolitikaGorunum[],
  onaylar: Record<string, boolean>,
): boolean {
  if (!politikalar.length) return true;
  return politikalar.every((p) => onaylar[p.kod]);
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
  },
  kutuHit: { paddingTop: 2 },
  kutu: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  kutuAktif: {
    backgroundColor: RenkTokenlari.primary,
    borderColor: RenkTokenlari.primary,
  },
  metinHit: { flex: 1 },
  etiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 20,
  },
  link: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
