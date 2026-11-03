import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  HediyeGecmisiniGetir,
  type HediyeGecmisiKaydi,
} from '../../src/moduller/hediyeler/okuma/HediyeGecmisiniGetir';
import {
  AyaGoreGrupla,
  AyBaslikSatiri,
  HediyeSatiri,
} from '../../src/moduller/cuzdan/bilesenler/HareketListesi';
import {
  CuzdanHareketDetayKarti,
  type CuzdanHareketDetay,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanHareketDetayKarti';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { DIL_LOCALE_MAP } from '../../src/i18n/diller';
import { useCeviri } from '../../src/i18n/useCeviri';

type YonFiltre = 'tumu' | 'gonderilen' | 'alinan';

export default function HediyeGecmisiEkrani() {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const { user } = useAuth();

  const [kayitlar, setKayitlar] = useState<HediyeGecmisiKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yon, setYon] = useState<YonFiltre>('tumu');
  const [detay, setDetay] = useState<CuzdanHareketDetay | null>(null);

  const yukle = useCallback(async () => {
    if (!user?.id) {
      setKayitlar([]);
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    try {
      setKayitlar(await HediyeGecmisiniGetir(user.id, 200));
    } catch {
      setKayitlar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const gonderilen = useMemo(
    () => kayitlar.filter((k) => k.yon === 'gonderilen'),
    [kayitlar],
  );
  const alinan = useMemo(
    () => kayitlar.filter((k) => k.yon === 'alinan'),
    [kayitlar],
  );

  const filtrelenmis = useMemo(() => {
    if (yon === 'gonderilen') return gonderilen;
    if (yon === 'alinan') return alinan;
    return kayitlar;
  }, [alinan, gonderilen, kayitlar, yon]);

  const gruplar = useMemo(
    () => AyaGoreGrupla(filtrelenmis, (k) => k.created_at, locale),
    [filtrelenmis, locale],
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan-hediye-gecmisi">
        <EkranBasligi
          title={t('cuzdanHediye.baslik')}
          subtitle={t('cuzdanHediye.altBaslik')}
          fallbackHref="/(tabs)/wallet"
          bilgi="hediye"
          right={
            <Pressable
              onPress={() => router.push('/(tabs)/wallet' as any)}
              style={styles.ustAksiyon}
              hitSlop={8}
              accessibilityLabel={t('cuzdanY.cuzdanim')}
            >
              <Ionicons name="wallet-outline" size={20} color={RenkTokenlari.text} />
            </Pressable>
          }
        />

        {yukleniyor ? (
          <View style={styles.merkez}>
            <ActivityIndicator color={RenkTokenlari.accent} />
            <Text style={styles.merkezYazi}>{t('cuzdanHediye.yukleniyor')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.icerik}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ozetSatir}>
              <View style={styles.ozetHucre}>
                <View style={[styles.ozetIkon, { backgroundColor: `${RenkTokenlari.danger}22` }]}>
                  <Ionicons name="arrow-up-circle" size={14} color={RenkTokenlari.danger} />
                </View>
                <Text style={styles.ozetEtiket}>{t('cuzdanHediye.gonderilenAdet')}</Text>
                <Text style={styles.ozetDeger}>{gonderilen.length}</Text>
              </View>
              <View style={styles.ozetHucre}>
                <View style={[styles.ozetIkon, { backgroundColor: `${RenkTokenlari.mint}22` }]}>
                  <Ionicons name="arrow-down-circle" size={14} color={RenkTokenlari.mint} />
                </View>
                <Text style={styles.ozetEtiket}>{t('cuzdanHediye.alinanAdet')}</Text>
                <Text style={styles.ozetDeger}>{alinan.length}</Text>
              </View>
              <View style={styles.ozetHucre}>
                <View style={[styles.ozetIkon, { backgroundColor: `${RenkTokenlari.accent}22` }]}>
                  <Ionicons name="gift" size={14} color={RenkTokenlari.accent} />
                </View>
                <Text style={styles.ozetEtiket}>{t('cuzdanX.hediye')}</Text>
                <Text style={styles.ozetDeger}>{kayitlar.length}</Text>
              </View>
            </View>

            <View style={styles.segment}>
              {(
                [
                  { id: 'tumu' as const, label: t('cuzdanXExtra.filtreTumu') },
                  { id: 'gonderilen' as const, label: t('cuzdan.gonderilen') },
                  { id: 'alinan' as const, label: t('cuzdan.alinan') },
                ] as const
              ).map((f) => {
                const aktif = yon === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setYon(f.id)}
                    style={[styles.segmentOge, aktif && styles.segmentOgeAktif]}
                  >
                    <Text
                      style={[styles.segmentYazi, aktif && styles.segmentYaziAktif]}
                      numberOfLines={1}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.bilgiSatir}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={RenkTokenlari.textDim}
              />
              <Text style={styles.bilgiYazi}>{t('cuzdanHediye.bilgi')}</Text>
            </View>

            {gruplar.length === 0 ? (
              <Text style={styles.bos}>
                {kayitlar.length === 0 ? t('cuzdanX.hediyeYok') : t('cuzdanHediye.bos')}
              </Text>
            ) : (
              <View style={styles.gruplar}>
                {gruplar.map((grup) => (
                  <View key={grup.anahtar} style={styles.grup}>
                    <AyBaslikSatiri
                      etiket={grup.etiket}
                      birimler={[]}
                      locale={locale}
                    />
                    {grup.satirlar.map((h, i) => (
                      <HediyeSatiri
                        key={h.id}
                        kayit={h}
                        locale={locale}
                        index={i}
                        onPress={() => setDetay({ tur: 'hediye', veri: h })}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </ModulHataSiniri>

      <CuzdanHareketDetayKarti detay={detay} onKapat={() => setDetay(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icerik: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.xxl,
    gap: BoslukTokenlari.sm,
  },
  merkez: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.xl,
  },
  merkezYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  ustAksiyon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ozetSatir: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingTop: 2,
  },
  ozetHucre: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ozetIkon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ozetEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    fontWeight: '700',
  },
  ozetDeger: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '900',
    fontSize: 18,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    gap: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  segmentOge: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
  },
  segmentOgeAktif: { backgroundColor: RenkTokenlari.bgCard },
  segmentYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
    fontSize: 12.5,
  },
  segmentYaziAktif: { color: RenkTokenlari.text, fontWeight: '800' },
  bilgiSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  bilgiYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10.5,
    lineHeight: 15,
    flex: 1,
  },
  gruplar: { gap: 6 },
  grup: { gap: 6 },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    paddingVertical: BoslukTokenlari.xl,
  },
});
