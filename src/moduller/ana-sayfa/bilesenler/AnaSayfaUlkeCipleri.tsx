/**
 * Ana sayfa ülke çipleri — Tümü / Türkiye / Almanya / ABD / S.Arabistan / BAE.
 * Seçili çip pink→purple degrade; ülke filtresi yayıncı ülkesine göre çalışır.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { kullaniciTemaKodunuAl, temaAcikMi } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';
import {
  ANA_SAYFA_ULKE_KODLARI,
  ulkeAdi,
  ulkeBayragi,
} from '../sabitler/UlkeEtiketleri';

type Props = {
  /** null → Tümü */
  secili: string | null;
  onSec: (kod: string | null) => void;
};

const CIKIS_BOSLUK = 44;

export function AnaSayfaUlkeCipleri({ secili, onSec }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const acik = temaAcikMi(kullaniciTemaKodunuAl());
  const kaydirmaRef = useRef<ScrollView>(null);
  const [sonda, setSonda] = useState(false);

  const kaydirildi = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const sagKenar = contentOffset.x + layoutMeasurement.width;
      setSonda(sagKenar >= contentSize.width - 8);
    },
    [],
  );

  const okaBas = useCallback(() => {
    if (sonda) {
      kaydirmaRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    kaydirmaRef.current?.scrollToEnd({ animated: true });
  }, [sonda]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={kaydirmaRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.satir}
        onScroll={kaydirildi}
        scrollEventThrottle={64}
      >
        <Pressable
          onPress={() => onSec(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: secili === null }}
          style={({ pressed }) => [pressed && styles.basili]}
        >
          {secili === null ? (
            <LinearGradient
              colors={[...RenkTokenlari.gradientPrimary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.cip, styles.cipSecili]}
            >
              <Ionicons name="globe-outline" size={13} color="#fff" />
              <Text style={[styles.yazi, styles.yaziSecili]}>
                {t('anaSayfa.filtreTumu')}
              </Text>
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.cip,
                {
                  backgroundColor: acik
                    ? RenkTokenlari.bgElevated
                    : RenkTokenlari.bgCard,
                  borderColor: RenkTokenlari.border,
                },
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={13}
                color={RenkTokenlari.textMuted}
              />
              <Text style={styles.yazi}>{t('anaSayfa.filtreTumu')}</Text>
            </View>
          )}
        </Pressable>

        {ANA_SAYFA_ULKE_KODLARI.map((kod) => {
          const aktif = secili === kod;
          const ad = ulkeAdi(kod);
          return (
            <Pressable
              key={kod}
              onPress={() => onSec(aktif ? null : kod)}
              accessibilityRole="button"
              accessibilityState={{ selected: aktif }}
              accessibilityLabel={ad}
              style={({ pressed }) => [pressed && styles.basili]}
            >
              {aktif ? (
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.cip, styles.cipSecili]}
                >
                  <Text style={styles.bayrak}>{ulkeBayragi(kod)}</Text>
                  <Text style={[styles.yazi, styles.yaziSecili]}>{ad}</Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.cip,
                    {
                      backgroundColor: acik
                        ? RenkTokenlari.bgElevated
                        : RenkTokenlari.bgCard,
                      borderColor: RenkTokenlari.border,
                    },
                  ]}
                >
                  <Text style={styles.bayrak}>{ulkeBayragi(kod)}</Text>
                  <Text style={styles.yazi}>{ad}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sagCikis} pointerEvents="box-none">
        <Pressable
          onPress={okaBas}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('anaSayfa.tumunuGor')}
          style={[
            styles.okBtn,
            {
              backgroundColor: acik
                ? RenkTokenlari.bgElevated
                : RenkTokenlari.bgCard,
              borderColor: RenkTokenlari.border,
            },
          ]}
        >
          <Ionicons
            name={sonda ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={RenkTokenlari.primarySoft}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  satir: {
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingRight: CIKIS_BOSLUK,
    paddingVertical: BoslukTokenlari.xs,
  },
  basili: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  cip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cipSecili: {
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bayrak: {
    fontSize: 12,
    lineHeight: 15,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 12,
  },
  yaziSecili: {
    color: '#fff',
  },
  sagCikis: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: CIKIS_BOSLUK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: BoslukTokenlari.lg - 2,
  },
  okBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
