import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useCeviri } from '../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../src/i18n/useCeviri';
import { BosDurum } from '../../src/components/BosDurum';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { KlavyeScrollView } from '../../src/bilesenler/klavye/KlavyeScrollView';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  HostBagimsizAktifEt,
  HostBasvurusuOlustur,
} from '../../src/moduller/hostlar/islemler/HostBasvuruIslemleri';
import {
  HostBasvurularimiGetir,
  HostProfilimiGetir,
  type HostProfil,
} from '../../src/moduller/hostlar/okuma/HostProfiliniGetir';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type CevirFn = (key: CeviriAnahtari, opts?: Record<string, unknown>) => string;

function hostDurum(status: string, t: CevirFn) {
  const map: Record<string, CeviriAnahtari> = {
    pending: 'host.durumIncelemede',
    active: 'host.durumAktif',
    suspended: 'host.durumAskida',
    rejected: 'host.durumReddedildi',
  };
  const key = map[status];
  return key ? t(key) : status;
}

function basvuruYol(path: string, t: CevirFn) {
  const map: Record<string, CeviriAnahtari> = {
    independent: 'host.yolBagimsiz',
    join_agency: 'host.yolAjans',
  };
  const key = map[path];
  return key ? t(key) : path;
}

function basvuruDurum(status: string, t: CevirFn) {
  const map: Record<string, CeviriAnahtari> = {
    pending: 'host.appBeklemede',
    agency_review: 'host.appAjans',
    platform_review: 'host.appPlatform',
    approved: 'host.appOnaylandi',
    rejected: 'host.appReddedildi',
  };
  const key = map[status];
  return key ? t(key) : status;
}

export default function HostEkrani() {
  const { t } = useCeviri();
  const { isGuest, refreshProfile, refreshWallet, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [invite, setInvite] = useState('');
  const [host, setHost] = useState<HostProfil | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setHost(await HostProfilimiGetir());
      setApps(await HostBasvurularimiGetir());
    } catch {
      setHost(null);
      setApps([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const bagimsiz = () => {
    islemiDene('canli_ac', async () => {
      setLoading(true);
      const a = await HostBasvurusuOlustur({ path: 'independent' });
      if (!a.ok) {
        setLoading(false);
        Alert.alert(t('host.alertBasvuru'), a.hata);
        return;
      }
      const b = await HostBagimsizAktifEt();
      setLoading(false);
      if (!b.ok) {
        Alert.alert(t('host.alertOnay'), b.hata);
        await load();
        return;
      }
      await refreshProfile();
      Alert.alert(t('host.alertAktifBaslik'), t('host.alertAktifBody'));
      await load();
    });
  };

  const ajansaKatil = () => {
    islemiDene('canli_ac', async () => {
      if (!invite.trim()) {
        Alert.alert(t('host.alertDavetGerekli'));
        return;
      }
      setLoading(true);
      const sonuc = await HostBasvurusuOlustur({
        path: 'join_agency',
        inviteCode: invite.trim(),
      });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert(t('host.alertBasvuru'), sonuc.hata);
        return;
      }
      Alert.alert(t('host.alertGonderildiBaslik'), t('host.alertGonderildiBody'), [
        {
          text: t('host.paneleGit'),
          onPress: () => router.push('/ajans/uye' as any),
        },
      ]);
      await load();
    });
  };

  const hostMu = Boolean(profile?.is_host);
  const durumMetni = host
    ? hostDurum(host.status, t)
    : hostMu
      ? t('host.durumAktif')
      : t('host.henuzDegil');

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="hostlar">
        <EkranBasligi title={t('host.baslik')} subtitle={t('host.alt')} />
        <KlavyeScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <KlavyeKapatan style={styles.formWrap}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('host.durumun')}</Text>
            <Text style={styles.statusLine}>
              {hostMu ? t('host.hesapAktif') : t('host.hesapYok')}
            </Text>
            <Text style={styles.cardMeta}>
              {t('host.profilDurum', { durum: durumMetni })}
            </Text>
            {host?.agency_id ? (
              <GradientButton
                title={t('host.ajansPaneli')}
                variant="ghost"
                onPress={() => router.push('/ajans/uye' as any)}
              />
            ) : null}
            {host ? (
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {Math.floor(host.total_live_seconds / 3600)}
                  </Text>
                  <Text style={styles.statLabel}>{t('host.saatCanli')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{host.gift_income_diamonds}</Text>
                  <Text style={styles.statLabel}>{t('host.elmas')}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{host.pk_wins}</Text>
                  <Text style={styles.statLabel}>{t('host.pkGalibiyet')}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <GradientButton
            title={t('host.bagimsizOl')}
            onPress={bagimsiz}
            loading={loading}
          />

          <TextField
            label={t('host.davetKodu')}
            value={invite}
            onChangeText={setInvite}
            autoCapitalize="characters"
            placeholder={t('host.phDavet')}
          />
          <GradientButton
            title={t('host.ajansaKatil')}
            variant="ghost"
            onPress={ajansaKatil}
          />

          <Text style={styles.section}>{t('host.basvurular')}</Text>
          {apps.length === 0 ? (
            <BosDurum
              icon="document-text-outline"
              title={t('host.bosBaslik')}
              body={t('host.bosBody')}
            />
          ) : (
            apps.map((a) => (
              <View key={a.id} style={styles.appCard}>
                <Text style={styles.appTitle}>{basvuruYol(a.path, t)}</Text>
                <Text style={styles.appMeta}>{basvuruDurum(a.status, t)}</Text>
              </View>
            ))
          )}
          </KlavyeKapatan>
        </KlavyeScrollView>
        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxl,
  },
  formWrap: {
    flexGrow: 1,
    gap: BoslukTokenlari.md,
  },
  card: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  statusLine: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  stats: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
    gap: 2,
  },
  statValue: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  statLabel: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.sm,
  },
  appCard: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.xs,
  },
  appTitle: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  appMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
