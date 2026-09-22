import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/components/Screen';
import { ModulHataSiniri } from '../../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { AjansAtmosfer } from '../../../src/moduller/ajanslar/bilesenler/AjansAtmosfer';
import { AjansBolumRayi } from '../../../src/moduller/ajanslar/bilesenler/AjansBolumRayi';
import {
  AjansBolumBaslik,
  AjansHint,
  AjansHeroKapak,
  AjansKart,
  AjansKpiHucre,
  AjansListeSatir,
} from '../../../src/moduller/ajanslar/bilesenler/AjansYonetimPrimitifleri';
import {
  ajansHref,
  useAjansRouteId,
} from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansBugunOzetGetir,
  AjansDashboardKpiGetir,
  AjansIzinlerim,
  AjansIzinVar,
  AjansSeviyeProgressGetir,
  AjansUyariMotoruGetir,
  saniyeSaatMetni,
  type AjansBugunOzet,
  type AjansDashboardKpi,
  type AjansIzinler,
  type AjansUyari,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../../../src/tasarim-sistemi/tema/useTemayaAboneOl';

function seviyeEtiket(code: string | null | undefined) {
  return (code ?? 'bronze').toUpperCase();
}

export default function AjansKontrolMerkeziEkrani() {
  useTemayaAboneOl();
  const id = useAjansRouteId();
  const [kpi, setKpi] = useState<AjansDashboardKpi | null>(null);
  const [bugun, setBugun] = useState<AjansBugunOzet | null>(null);
  const [uyarilar, setUyarilar] = useState<AjansUyari[]>([]);
  const [izinler, setIzinler] = useState<AjansIzinler | null>(null);
  const [seviye, setSeviye] = useState<Record<string, unknown> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [kpiAcik, setKpiAcik] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const iz = await AjansIzinlerim(id);
      setIzinler(iz);
      const [k, b, u, s] = await Promise.all([
        AjansDashboardKpiGetir(id),
        AjansBugunOzetGetir(id),
        AjansUyariMotoruGetir(id).catch(() => []),
        AjansSeviyeProgressGetir(id).catch(() => null),
      ]);
      setKpi(k);
      setBugun(b);
      setUyarilar(u);
      setSeviye(s);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setKpi(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const a = kpi?.agency;

  const anaKpi = kpi
    ? [
        { l: 'Üyeler', v: String(kpi.uyeler), emph: true },
        { l: 'Çevrimiçi', v: String(kpi.cevrimici), emph: true },
        { l: 'Canlı', v: String(kpi.canli_yayinda), emph: true },
        { l: 'Ses odası', v: String(kpi.ses_odasinda), emph: true },
      ]
    : [];

  const ekstraKpi = kpi
    ? [
        { l: 'Bekleyen', v: String(kpi.bekleyen_basvuru) },
        { l: 'Bu ay yayın', v: saniyeSaatMetni(kpi.bu_ay_yayin_saniye) },
        { l: 'Bu ay ses', v: saniyeSaatMetni(kpi.bu_ay_ses_saniye) },
        {
          l: 'Aktivite',
          v: saniyeSaatMetni(kpi.bu_ay_platform_aktivite_saniye),
        },
      ]
    : [];

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajans-kontrol" varyant="ekran" fallbackHref="/ajans/yonetim">
        <View style={styles.root}>
          <AjansAtmosfer />
          {yukleniyor && !kpi ? (
            <ActivityIndicator
              color={RenkTokenlari.primarySoft}
              style={{ marginTop: 80 }}
            />
          ) : hata && !kpi ? (
            <Text style={styles.hata}>{hata}</Text>
          ) : kpi && a ? (
            <ScrollView
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={yukleniyor}
                  onRefresh={() => void yukle()}
                  tintColor={RenkTokenlari.primarySoft}
                />
              }
            >
              <Pressable
                style={styles.geri}
                onPress={() => router.push('/ajans/yonetim' as any)}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={20} color={RenkTokenlari.text} />
                <Text style={styles.geriYazi}>Ajanslarım</Text>
              </Pressable>

              <AjansHeroKapak
                name={a.name}
                subtitle={a.username ? `@${a.username}` : a.agency_public_id}
                logoUrl={a.logo_url}
                bannerUrl={a.banner_url}
                levelLabel={seviyeEtiket(a.level_code)}
                verified={!!a.is_verified}
                meta={`ID ${a.agency_public_id} · ${kpi.uyeler} üye`}
                actionLabel={
                  AjansIzinVar(izinler, 'agency.manage_settings')
                    ? 'Ajansı yönet'
                    : undefined
                }
                onAction={
                  AjansIzinVar(izinler, 'agency.manage_settings')
                    ? () => router.push(ajansHref(id, 'ayarlar') as any)
                    : undefined
                }
              />

              <AjansBolumRayi agencyId={id} aktif="ozet" />

              {seviye ? (
                <AjansKart>
                  <View style={styles.seviyeBas}>
                    <Text style={styles.seviyeBaslik}>
                      {seviyeEtiket(String(seviye.current ?? a.level_code))}
                      {seviye.next
                        ? ` → ${seviyeEtiket(String(seviye.next))}`
                        : ' · Max'}
                    </Text>
                    <Text style={styles.seviyePct}>
                      %{Number(seviye.progress_pct) || 0}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Number(seviye.progress_pct) || 0)}%`,
                        },
                      ]}
                    />
                  </View>
                  {Array.isArray(seviye.eksikler) && seviye.eksikler.length ? (
                    <AjansHint>
                      {`Eksik: ${(seviye.eksikler as string[]).join(', ')}`}
                    </AjansHint>
                  ) : null}
                </AjansKart>
              ) : null}

              <AjansBolumBaslik>Anlık durum</AjansBolumBaslik>
              <View style={styles.kpiGrid}>
                {anaKpi.map((x) => (
                  <AjansKpiHucre
                    key={x.l}
                    label={x.l}
                    value={x.v}
                    emphasize={x.emph}
                  />
                ))}
              </View>
              {kpiAcik ? (
                <View style={styles.kpiGrid}>
                  {ekstraKpi.map((x) => (
                    <AjansKpiHucre key={x.l} label={x.l} value={x.v} />
                  ))}
                </View>
              ) : null}
              <Pressable onPress={() => setKpiAcik((v) => !v)} style={styles.daha}>
                <Text style={styles.dahaYazi}>
                  {kpiAcik ? 'Daha az' : 'Daha fazla metrik'}
                </Text>
                <Ionicons
                  name={kpiAcik ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={RenkTokenlari.primarySoft}
                />
              </Pressable>

              <AjansBolumBaslik>Bugün</AjansBolumBaslik>
              <AjansKart>
                {(bugun?.maddeler ?? []).length === 0 ? (
                  <AjansHint>Henüz veri yok</AjansHint>
                ) : (
                  (bugun?.maddeler ?? []).map((m) => (
                    <AjansListeSatir
                      key={m.key}
                      title={m.label}
                      subtitle={`${m.count} kayıt`}
                      leading={
                        <View style={styles.bugunSayi}>
                          <Text style={styles.bugunSayiYazi}>{m.count}</Text>
                        </View>
                      }
                      onPress={() => router.push(ajansHref(id, m.href) as any)}
                    />
                  ))
                )}
              </AjansKart>

              <AjansBolumBaslik>Dikkat</AjansBolumBaslik>
              <AjansKart accent={uyarilar.length > 0}>
                {uyarilar.length === 0 ? (
                  <AjansHint>Uyarı yok — her şey yolunda</AjansHint>
                ) : (
                  uyarilar.slice(0, 8).map((u, i) => (
                    <AjansListeSatir
                      key={`${u.code}-${i}`}
                      title={u.title}
                      subtitle={u.body}
                      onPress={
                        u.href
                          ? () => router.push(ajansHref(id, u.href) as any)
                          : undefined
                      }
                    />
                  ))
                )}
              </AjansKart>

              <AjansBolumBaslik>Hızlı işlem</AjansBolumBaslik>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hizliRail}
              >
                {[
                  { t: 'Davet', p: 'davetler', i: 'person-add-outline' as const },
                  { t: 'Duyuru', p: 'duyurular', i: 'megaphone-outline' as const },
                  { t: 'Etkinlik', p: 'etkinlikler', i: 'calendar-outline' as const },
                  { t: 'Coin', p: 'islemler', i: 'diamond-outline' as const },
                  { t: 'Canlı', p: 'canli', i: 'radio-outline' as const },
                  { t: 'Ayarlar', p: 'ayarlar', i: 'settings-outline' as const },
                ].map((h) => (
                  <Pressable
                    key={h.t}
                    style={styles.hizliKart}
                    onPress={() => router.push(ajansHref(id, h.p) as any)}
                  >
                    <View style={styles.hizliIcon}>
                      <Ionicons name={h.i} size={18} color={RenkTokenlari.primarySoft} />
                    </View>
                    <Text style={styles.hizliYazi}>{h.t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </ScrollView>
          ) : (
            <Text style={styles.hata}>Ajans bulunamadı</Text>
          )}
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  geri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: -4,
  },
  geriYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  seviyeBas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seviyeBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  seviyePct: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: RenkTokenlari.primarySoft,
    borderRadius: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  daha: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dahaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
  bugunSayi: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugunSayiYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  hizliRail: {
    gap: 10,
    paddingVertical: 2,
  },
  hizliKart: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  hizliIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hizliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  hata: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: BoslukTokenlari.lg,
  },
});
