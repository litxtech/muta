import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { AgBaglantiDurumunuGetir } from '../../src/moduller/ag-baglantisi/okuma/AgBaglantiDurumunuGetir';
import {
  GracefulDegradationKarariVer,
  type GracefulDegradationKarari,
} from '../../src/moduller/ag-baglantisi/GracefulDegradationKarariVer';
import { DusukCihazModuAktifMi } from '../../src/moduller/performans/DusukCihazModuAktifMi';
import { MutabakatSonuclariniGetir } from '../../src/moduller/mutabakat/okuma/MutabakatSonuclariniGetir';
import {
  SertifikasyonKontrolleriniGetir,
  SertifikasyonKontrolGuncelle,
  type SertifikasyonKontrolu,
} from '../../src/moduller/sertifikasyon/okuma/SertifikasyonKontrolleriniGetir';
import { PlatformSaglikOzetiniGetir } from '../../src/moduller/sertifikasyon/okuma/PlatformSaglikOzetiniGetir';
import { HediyeAnimasyonStresTestiCalistir } from '../../src/moduller/yuk-testi/HediyeAnimasyonStresTestiCalistir';
import { LiveKitBaglantiStresSimulasyonu } from '../../src/moduller/yuk-testi/LiveKitBaglantiStresSimulasyonu';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function SertifikasyonHubEkrani() {
  const { isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const hubOn = OzellikBayragiAktifMi('certification_hub_enabled');
  const stressOn = OzellikBayragiAktifMi('stress_tools_enabled');

  const [checks, setChecks] = useState<SertifikasyonKontrolu[]>([]);
  const [deg, setDeg] = useState<GracefulDegradationKarari | null>(null);
  const [agOzet, setAgOzet] = useState('—');
  const [mutabakat, setMutabakat] = useState<string>('—');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const ag = await AgBaglantiDurumunuGetir();
      setAgOzet(
        `${ag.tip} · bagli=${ag.bagli} · net=${ag.internetErisilebilir ?? '?'} · dusuk=${DusukCihazModuAktifMi()}`,
      );
      setDeg(GracefulDegradationKarariVer(ag));

      const [c, m, saglik] = await Promise.all([
        SertifikasyonKontrolleriniGetir().catch(() => []),
        MutabakatSonuclariniGetir(5).catch(() => []),
        PlatformSaglikOzetiniGetir().catch(() => null),
      ]);
      setChecks(c);
      setMutabakat(
        m.length === 0
          ? 'Henüz run yok (service_role mutabakat_paketi_calistir)'
          : m.map((r) => `${r.kind}:${r.status}`).join(' · '),
      );
      if (saglik?.kill_switches && Object.keys(saglik.kill_switches).length > 0) {
        await SertifikasyonKontrolGuncelle({
          code: 'sec_kill_switches',
          status: 'pass',
          details: { keys: Object.keys(saglik.kill_switches) },
        }).catch(() => undefined);
      }
      if (ag.bagli === false || ag.internetErisilebilir === false) {
        await SertifikasyonKontrolGuncelle({
          code: 'net_offline',
          status: 'pass',
          details: { observed: true },
        }).catch(() => undefined);
      }
      if (DusukCihazModuAktifMi()) {
        await SertifikasyonKontrolGuncelle({
          code: 'android_low_end',
          status: 'pass',
          details: { mode: true },
        }).catch(() => undefined);
      }
      const refreshed = await SertifikasyonKontrolleriniGetir().catch(() => c);
      setChecks(refreshed);
    } catch {
      /* migration 011 */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stresHediye = () => {
    islemiDene('oy_kullan', async () => {
      if (!stressOn && !hubOn) {
        Alert.alert('Kapalı', 'stress_tools_enabled veya certification_hub_enabled açın.');
        return;
      }
      setBusy(true);
      try {
        const r = await HediyeAnimasyonStresTestiCalistir(40);
        Alert.alert(
          r.ok ? 'Pass' : 'Fail',
          `eklenen=${r.eklenen} dusurulen=${r.dusuruldu} ${r.sureMs}ms`,
        );
        await load();
      } finally {
        setBusy(false);
      }
    });
  };

  const stresLivekit = () => {
    islemiDene('oy_kullan', async () => {
      if (!stressOn && !hubOn) {
        Alert.alert('Kapalı', 'stress_tools_enabled veya certification_hub_enabled açın.');
        return;
      }
      setBusy(true);
      try {
        const r = await LiveKitBaglantiStresSimulasyonu(5);
        Alert.alert(
          r.ok ? 'Pass' : 'Fail',
          `ok=${r.basarili} fail=${r.basarisiz} ${r.sureMs}ms${r.hata ? ` · ${r.hata}` : ''}`,
        );
        await load();
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="sertifikasyon">
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Sertifikasyon</Text>
          <Text style={styles.sub}>
            FAZ 10 · hub {hubOn ? 'on' : 'off'} · stress {stressOn ? 'on' : 'off'}
          </Text>

          <Text style={styles.section}>Ağ / degradation</Text>
          <Text style={styles.line}>{agOzet}</Text>
          <Text style={styles.line}>
            aktif={deg?.aktif ? 'evet' : 'hayır'} ·{' '}
            {deg?.sebep?.join(', ') || '—'} · anim=
            {deg?.agirAnimasyonIzinli ? 'ok' : 'kisit'} · cache=
            {deg?.yalnizcaOnbellek ? 'evet' : 'hayır'}
          </Text>

          <Text style={styles.section}>Mutabakat (son)</Text>
          <Text style={styles.line}>{mutabakat}</Text>

          <Text style={styles.section}>Checklist</Text>
          {checks.length === 0 ? (
            <Text style={styles.empty}>011 migration + certification_hub_enabled</Text>
          ) : (
            checks.map((c) => (
              <Text key={c.code} style={styles.line}>
                [{c.status}] {c.category} · {c.title}
              </Text>
            ))
          )}

          <Text style={styles.section}>Stres araçları</Text>
          <GradientButton
            title={busy ? 'Çalışıyor…' : 'Hediye animasyon stres'}
            onPress={stresHediye}
            disabled={busy}
          />
          <GradientButton
            title={busy ? 'Çalışıyor…' : 'LiveKit mock reconnect stres'}
            variant="ghost"
            onPress={stresLivekit}
            disabled={busy}
          />
          <GradientButton
            title="Security Center"
            variant="ghost"
            onPress={() => router.push('/guvenlik' as any)}
          />
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            Alert.alert('Tamam', 'Hesabın güncellendi.');
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  title: { ...TipografiTokenlari.h1, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, marginBottom: 8 },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: 12,
  },
  line: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  empty: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted, fontStyle: 'italic' },
});
