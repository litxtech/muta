import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useAuth, useWallet } from '../../src/contexts/AuthContext';
import {
  CuzdanLedgeriniGetir,
  LedgerBirimEtiketi,
  type LedgerSatiri,
} from '../../src/moduller/cuzdan/okuma/CuzdanLedgeriniGetir';
import {
  HediyeGecmisiniGetir,
  type HediyeGecmisiKaydi,
} from '../../src/moduller/hediyeler/okuma/HediyeGecmisiniGetir';
import {
  AyAnahtari,
  AyaGoreGrupla,
  AyBaslikSatiri,
  AyEtiketi,
  HareketSatiri,
} from '../../src/moduller/cuzdan/bilesenler/HareketListesi';
import {
  CuzdanHareketDetayKarti,
  type CuzdanHareketDetay,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanHareketDetayKarti';
import {
  BelgePaylasDugmesi,
  BelgePaylasimPaneli,
} from '../../src/moduller/belge-paylasim/bilesenler/BelgePaylasimPaneli';
import { HesapHareketleriBelgesiOlustur } from '../../src/moduller/belge-paylasim/HesapHareketleriBelgesi';
import type { HesapHareketleriBelgeGirdi } from '../../src/moduller/belge-paylasim/HesapHareketleriBelgesi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { DIL_LOCALE_MAP } from '../../src/i18n/diller';
import { useCeviri } from '../../src/i18n/useCeviri';

type YonFiltre = 'tumu' | 'giris' | 'cikis';

const LIMIT = 400;

export default function HesapHareketleriEkrani() {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const { user, profile } = useAuth();
  const { wallet } = useWallet();

  const [ledger, setLedger] = useState<LedgerSatiri[]>([]);
  const [hediyeler, setHediyeler] = useState<HediyeGecmisiKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);

  const [yon, setYon] = useState<YonFiltre>('tumu');
  const [birim, setBirim] = useState<string>('tumu');
  const [ay, setAy] = useState<string>('tumu');

  const [detay, setDetay] = useState<CuzdanHareketDetay | null>(null);
  const [belgeAcik, setBelgeAcik] = useState(false);
  const [belgeBusy, setBelgeBusy] = useState(false);
  const [excelGirdi, setExcelGirdi] = useState<HesapHareketleriBelgeGirdi | null>(
    null,
  );

  const yuklendiRef = useRef(false);

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      setHata(false);
      try {
        const satirlar = await CuzdanLedgeriniGetir(LIMIT);
        setLedger(satirlar);
        yuklendiRef.current = true;
      } catch {
        setHata(true);
        setLedger([]);
      } finally {
        setYukleniyor(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void yukle(yuklendiRef.current);
    }, [yukle]),
  );

  /** Birim çipleri — hareketlerde geçen para birimleri. */
  const birimler = useMemo(() => {
    const set = new Set<string>();
    for (const r of ledger) set.add(r.currency);
    return [...set];
  }, [ledger]);

  /** Ay çipleri — en yeniden eskiye. */
  const aylar = useMemo(() => {
    const harita = new Map<string, string>();
    for (const r of ledger) {
      const anahtar = AyAnahtari(r.created_at);
      if (anahtar && !harita.has(anahtar)) {
        harita.set(anahtar, AyEtiketi(r.created_at, locale));
      }
    }
    return [...harita.entries()].map(([anahtar, etiket]) => ({ anahtar, etiket }));
  }, [ledger, locale]);

  const filtrelenmis = useMemo(() => {
    return ledger.filter((r) => {
      if (birim !== 'tumu' && r.currency !== birim) return false;
      if (yon === 'giris' && r.delta < 0) return false;
      if (yon === 'cikis' && r.delta >= 0) return false;
      if (ay !== 'tumu' && AyAnahtari(r.created_at) !== ay) return false;
      return true;
    });
  }, [ledger, birim, yon, ay]);

  const gruplar = useMemo(
    () =>
      AyaGoreGrupla(
        filtrelenmis,
        (r) => r.created_at,
        locale,
        (r) => ({ birim: r.currency, deger: r.delta }),
      ),
    [filtrelenmis, locale],
  );

  const toplamlar = useMemo(() => {
    const harita = new Map<string, { giris: number; cikis: number }>();
    for (const r of filtrelenmis) {
      const t2 = harita.get(r.currency) ?? { giris: 0, cikis: 0 };
      if (r.delta >= 0) t2.giris += r.delta;
      else t2.cikis += Math.abs(r.delta);
      harita.set(r.currency, t2);
    }
    return [...harita.entries()].map(([birimAdi, v]) => ({ birim: birimAdi, ...v }));
  }, [filtrelenmis]);

  const belgeyiAc = useCallback(async () => {
    if (belgeBusy) return;
    setBelgeBusy(true);
    try {
      const [ledgerBuyuk, hediyeBuyuk] = await Promise.all([
        CuzdanLedgeriniGetir(Math.max(250, LIMIT)).catch(() => ledger),
        user?.id
          ? HediyeGecmisiniGetir(user.id, 200).catch(() => hediyeler)
          : Promise.resolve(hediyeler),
      ]);

      setHediyeler(hediyeBuyuk);

      setExcelGirdi({
        sahipAdi: profile?.display_name ?? profile?.username,
        hesapKodu: profile?.public_user_id ?? user?.id,
        coins: wallet?.coins ?? 0,
        diamonds: wallet?.diamonds ?? 0,
        ledger: ledgerBuyuk.filter((r) => {
          if (birim !== 'tumu' && r.currency !== birim) return false;
          if (yon === 'giris') return r.delta >= 0;
          if (yon === 'cikis') return r.delta < 0;
          return true;
        }),
        hediyeler: hediyeBuyuk,
      });
      setBelgeAcik(true);
    } finally {
      setBelgeBusy(false);
    }
  }, [
    belgeBusy,
    birim,
    hediyeler,
    ledger,
    profile?.display_name,
    profile?.public_user_id,
    profile?.username,
    user?.id,
    wallet?.coins,
    wallet?.diamonds,
    yon,
  ]);

  const hesapBelgesi = useMemo(() => {
    if (!excelGirdi) return null;
    return HesapHareketleriBelgesiOlustur(excelGirdi);
  }, [excelGirdi]);

  const seciliAyEtiketi =
    ay === 'tumu' ? t('cuzdanHareket.tumAylar') : (aylar.find((a) => a.anahtar === ay)?.etiket ?? ay);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan-hareketler">
        <EkranBasligi
          title={t('cuzdanHareket.baslik')}
          subtitle={t('cuzdanHareket.altBaslik')}
          fallbackHref="/(tabs)/wallet"
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
            <ActivityIndicator color={RenkTokenlari.primarySoft} />
            <Text style={styles.merkezYazi}>{t('cuzdanHareket.yukleniyor')}</Text>
          </View>
        ) : hata ? (
          <View style={styles.merkez}>
            <Ionicons
              name="alert-circle-outline"
              size={30}
              color={RenkTokenlari.textDim}
            />
            <Text style={styles.merkezYazi}>{t('cuzdanHareket.yuklenemedi')}</Text>
            <Pressable onPress={() => void yukle()} style={styles.tekrarDene}>
              <Text style={styles.tekrarDeneYazi}>{t('cuzdanHareket.yenidenDene')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.icerik}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.ustSatir}>
              <View style={styles.ustSol}>
                <Text style={styles.ustEtiket}>
                  {t('cuzdanHareket.adet', { adet: filtrelenmis.length })}
                </Text>
                <Text style={styles.ustAy} numberOfLines={1}>
                  {seciliAyEtiketi}
                </Text>
              </View>
              <BelgePaylasDugmesi
                onPress={() => void belgeyiAc()}
                label={belgeBusy ? t('cuzdanX.hazirlaniyor') : t('cuzdanXExtra.pdfExcel')}
              />
            </View>

            {toplamlar.length ? (
              <View style={styles.ozetKart}>
                {toplamlar.map((s) => (
                  <View key={s.birim} style={styles.ozetHucre}>
                    <Text style={styles.ozetBirim} numberOfLines={1}>
                      {LedgerBirimEtiketi(s.birim)}
                    </Text>
                    <View style={styles.ozetDegerSatir}>
                      {s.giris > 0 ? (
                        <Text style={[styles.ozetDeger, { color: RenkTokenlari.mint }]}>
                          +{s.giris.toLocaleString(locale)}
                        </Text>
                      ) : null}
                      {s.cikis > 0 ? (
                        <Text style={[styles.ozetDeger, { color: RenkTokenlari.danger }]}>
                          −{s.cikis.toLocaleString(locale)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.bilgiSatir}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={RenkTokenlari.textDim}
              />
              <Text style={styles.bilgiYazi}>{t('cuzdanHareket.bilgi')}</Text>
            </View>

            <View style={styles.segment}>
              {(
                [
                  { id: 'tumu' as const, label: t('cuzdanXExtra.filtreTumu') },
                  { id: 'giris' as const, label: t('cuzdanX.giris') },
                  { id: 'cikis' as const, label: t('cuzdanX.cikis') },
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

            {birimler.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cipSatir}
              >
                <Cip
                  label={t('cuzdanHareket.tumBirimler')}
                  aktif={birim === 'tumu'}
                  onPress={() => setBirim('tumu')}
                />
                {birimler.map((b) => (
                  <Cip
                    key={b}
                    label={LedgerBirimEtiketi(b)}
                    aktif={birim === b}
                    onPress={() => setBirim(b)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {aylar.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cipSatir}
              >
                <Cip
                  label={t('cuzdanHareket.tumAylar')}
                  aktif={ay === 'tumu'}
                  onPress={() => setAy('tumu')}
                />
                {aylar.map((a) => (
                  <Cip
                    key={a.anahtar}
                    label={a.etiket}
                    aktif={ay === a.anahtar}
                    onPress={() => setAy(a.anahtar)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {gruplar.length === 0 ? (
              <Text style={styles.bos}>
                {ledger.length === 0
                  ? t('cuzdanX.hareketYok')
                  : t('cuzdanHareket.bos')}
              </Text>
            ) : (
              <View style={styles.gruplar}>
                {gruplar.map((grup) => (
                  <View key={grup.anahtar} style={styles.grup}>
                    <AyBaslikSatiri
                      etiket={grup.etiket}
                      birimler={grup.birimler}
                      locale={locale}
                    />
                    {grup.satirlar.map((row) => (
                      <HareketSatiri
                        key={row.id}
                        row={row}
                        locale={locale}
                        onPress={() => setDetay({ tur: 'ledger', veri: row })}
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
      <BelgePaylasimPaneli
        visible={belgeAcik}
        onKapat={() => setBelgeAcik(false)}
        icerik={hesapBelgesi}
        excelGirdi={excelGirdi}
      />
    </Screen>
  );
}

function Cip({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.cip, aktif && styles.cipAktif]}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
    >
      <Text style={[styles.cipYazi, aktif && styles.cipYaziAktif]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
    textAlign: 'center',
  },
  tekrarDene: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  tekrarDeneYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  ustAksiyon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingTop: 2,
  },
  ustSol: { flex: 1, minWidth: 0, gap: 2 },
  ustEtiket: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 15,
  },
  ustAy: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  ozetKart: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ozetHucre: { flexGrow: 1, minWidth: 96, gap: 3 },
  ozetBirim: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  ozetDegerSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ozetDeger: {
    ...TipografiTokenlari.caption,
    fontWeight: '900',
    fontSize: 14,
  },
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
  cipSatir: { gap: 6, paddingVertical: 2, paddingRight: 8 },
  cip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  cipAktif: {
    backgroundColor: RenkTokenlari.pressFill,
    borderColor: RenkTokenlari.primarySoft,
  },
  cipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
  },
  cipYaziAktif: { color: RenkTokenlari.text },
  gruplar: { gap: 6 },
  grup: { gap: 6 },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    paddingVertical: BoslukTokenlari.xl,
  },
});
