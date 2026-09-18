import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
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

const HOST_DURUM: Record<string, string> = {
  pending: 'İncelemede',
  active: 'Aktif',
  suspended: 'Askıda',
  rejected: 'Reddedildi',
};

const BASVURU_YOL: Record<string, string> = {
  independent: 'Bağımsız',
  join_agency: 'Ajansa katılım',
};

const BASVURU_DURUM: Record<string, string> = {
  pending: 'Beklemede',
  agency_review: 'Ajans incelemesi',
  platform_review: 'Platform incelemesi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

export default function HostEkrani() {
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
        Alert.alert('Başvuru', a.hata);
        return;
      }
      const b = await HostBagimsizAktifEt();
      setLoading(false);
      if (!b.ok) {
        Alert.alert(
          'Onay',
          `${b.hata}\n\nProd'da platform review gerekir. Dev için host_bagimsiz_aktif_et.`,
        );
        await load();
        return;
      }
      await refreshProfile();
      Alert.alert('Ev sahibi aktif', 'Bağımsız ev sahibi olarak işaretlendin.');
      await load();
    });
  };

  const ajansaKatil = () => {
    islemiDene('canli_ac', async () => {
      if (!invite.trim()) {
        Alert.alert('Davet kodu gerekli');
        return;
      }
      setLoading(true);
      const sonuc = await HostBasvurusuOlustur({
        path: 'join_agency',
        inviteCode: invite.trim(),
      });
      setLoading(false);
      if (!sonuc.ok) {
        Alert.alert('Başvuru', sonuc.hata);
        return;
      }
      Alert.alert(
        'Başvuru gönderildi',
        'Ajans onaylayınca profilinde ajansın görünür ve üye panelin açılır.',
        [
          {
            text: 'Panele git',
            onPress: () => router.push('/ajans/uye' as any),
          },
        ],
      );
      await load();
    });
  };

  const hostMu = Boolean(profile?.is_host);
  const durumMetni = host
    ? HOST_DURUM[host.status] ?? host.status
    : hostMu
      ? 'Aktif'
      : 'Henüz ev sahibi değilsin';

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="hostlar">
        <EkranBasligi
          title="Ev sahibi ol"
          subtitle="Bağımsız veya ajans yoluyla başvur"
        />
        <KlavyeScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <KlavyeKapatan style={styles.formWrap}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Durumun</Text>
            <Text style={styles.statusLine}>
              {hostMu ? 'Ev sahibi hesabı aktif' : 'Ev sahibi hesabı yok'}
            </Text>
            <Text style={styles.cardMeta}>Profil: {durumMetni}</Text>
            {host?.agency_id ? (
              <GradientButton
                title="Ajans paneli"
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
                  <Text style={styles.statLabel}>Saat canlı</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{host.gift_income_diamonds}</Text>
                  <Text style={styles.statLabel}>Elmas</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{host.pk_wins}</Text>
                  <Text style={styles.statLabel}>PK galibiyeti</Text>
                </View>
              </View>
            ) : null}
          </View>

          <GradientButton
            title="Bağımsız host ol"
            onPress={bagimsiz}
            loading={loading}
          />

          <TextField
            label="Ajans davet kodu"
            value={invite}
            onChangeText={setInvite}
            autoCapitalize="characters"
            placeholder="ABCD1234"
          />
          <GradientButton title="Ajansa katıl" variant="ghost" onPress={ajansaKatil} />

          <Text style={styles.section}>Başvurular</Text>
          {apps.length === 0 ? (
            <BosDurum
              icon="document-text-outline"
              title="Başvuru yok"
              body="Yeni bir başvuru oluşturduğunda burada görünür."
            />
          ) : (
            apps.map((a) => (
              <View key={a.id} style={styles.appCard}>
                <Text style={styles.appTitle}>
                  {BASVURU_YOL[a.path] ?? a.path}
                </Text>
                <Text style={styles.appMeta}>
                  {BASVURU_DURUM[a.status] ?? a.status}
                </Text>
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
