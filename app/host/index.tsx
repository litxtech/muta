import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
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
      Alert.alert('Host aktif', 'Bağımsız host olarak işaretlendin.');
      await load();
    });
  };

  const ajansaKatil = () => {
    islemiDene('canli_ac', async () => {
      if (!invite.trim()) {
        Alert.alert('Invite code gerekli');
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
      Alert.alert('Alındı', 'Ajans incelemesi bekleniyor.');
      await load();
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="hostlar">
        <View style={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Geri</Text>
          </Pressable>
          <Text style={styles.title}>Become a Host</Text>
          <Text style={styles.sub}>
            Independent veya Join Agency · User → Agency Review → Platform Review → Host
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Durum</Text>
            <Text style={styles.cardMeta}>
              is_host: {profile?.is_host ? 'evet' : 'hayır'}
              {'\n'}
              host profile: {host ? `${host.status}` : 'yok'}
              {host?.agency_id ? `\najans: ${host.agency_id.slice(0, 8)}` : ''}
            </Text>
            {host ? (
              <Text style={styles.cardMeta}>
                live: {Math.floor(host.total_live_seconds / 3600)}s · diamonds{' '}
                {host.gift_income_diamonds} · pk wins {host.pk_wins}
              </Text>
            ) : null}
          </View>

          <GradientButton
            title="Bağımsız host ol (dev onay)"
            onPress={bagimsiz}
            loading={loading}
          />

          <TextField
            label="Ajans invite code"
            value={invite}
            onChangeText={setInvite}
            autoCapitalize="characters"
            placeholder="ABCD1234"
          />
          <GradientButton title="Ajansa katıl (başvuru)" variant="ghost" onPress={ajansaKatil} />

          <Text style={styles.section}>Başvurular</Text>
          {apps.length === 0 ? (
            <Text style={styles.empty}>Başvuru yok.</Text>
          ) : (
            apps.map((a) => (
              <Text key={a.id} style={styles.line}>
                {a.path} · {a.status}
              </Text>
            ))
          )}
        </View>
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
  content: { flex: 1, padding: 20, gap: 12 },
  back: { ...TipografiTokenlari.caption, color: RenkTokenlari.primarySoft },
  title: { ...TipografiTokenlari.title, color: RenkTokenlari.text },
  sub: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  cardTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  cardMeta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  section: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  empty: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  line: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
});
