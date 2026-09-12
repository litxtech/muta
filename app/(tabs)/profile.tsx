import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { PrestigeRozetSatiri } from '../../src/moduller/vip/bilesenler/PrestigeRozetSatiri';
import { colors, radii, typography } from '../../src/theme/colors';
import { env } from '../../src/lib/env';

export default function ProfileScreen() {
  const { profile, wallet, user, signOut, isGuest, refreshProfile, refreshWallet } =
    useAuth();
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      ProfilIstatistikleriniGetir(user.id)
        .then(setStats)
        .catch(() => setStats(null));
    }, [user?.id]),
  );

  const onSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={colors.textMuted} />
          </View>
          <Text style={styles.name}>
            {profile?.display_name ?? (isGuest ? 'Misafir' : 'Kullanıcı')}
          </Text>
          <Text style={styles.username}>@{profile?.username ?? 'misafir'}</Text>
          {profile?.public_user_id ? (
            <Text style={styles.publicId}>ID {profile.public_user_id}</Text>
          ) : null}
          {isGuest ? (
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>MISAFIR</Text>
            </View>
          ) : null}
          <PrestigeRozetSatiri
            vipLevel={stats?.vip_level ?? 0}
            gifterLevel={stats?.gifter_rank}
            charmLevel={stats?.charm_level ?? 1}
            rechargeLevel={stats?.recharge_rank}
          />
          <View style={styles.stats}>
            <Stat label="Takipçi" value={String(stats?.followers_count ?? 0)} />
            <Stat label="Takip" value={String(stats?.following_count ?? 0)} />
            <Stat label="Charm" value={String(stats?.charm_level ?? 1)} />
          </View>
          <View style={styles.stats}>
            <Stat label="VIP" value={String(stats?.vip_level ?? 0)} />
            <Stat label="Coin" value={String(wallet?.coins ?? 0)} />
            <Stat label="Elmas" value={String(wallet?.diamonds ?? 0)} />
          </View>
        </View>

        <View style={styles.card}>
          <Row icon="mail" label="E-posta" value={user?.email ?? (isGuest ? '—' : '-')} />
          <Row icon="finger-print" label="Public ID" value={profile?.public_user_id ?? '—'} />
          <Row
            icon="gift"
            label="Gönderilen hediye"
            value={String(stats?.total_gifts_sent ?? 0)}
          />
          <Row
            icon="heart"
            label="Alınan hediye"
            value={String(stats?.total_gifts_received ?? 0)}
          />
          <Row icon="shield-checkmark" label="Ortam" value={env.appEnv} />
        </View>

        {isGuest ? (
          <GradientButton title="Hesabı tamamla" onPress={() => setUpgradeAcik(true)} />
        ) : null}

        <GradientButton
          title="Aktif cihazlar"
          variant="ghost"
          onPress={() => router.push('/cihazlar' as any)}
        />

        {!isGuest ? (
          <GradientButton
            title="Şifre sıfırlama maili"
            variant="ghost"
            onPress={() => router.push('/(auth)/forgot-password')}
          />
        ) : null}

        <GradientButton
          title="Cüzdan"
          variant="ghost"
          onPress={() => {
            if (isGuest) {
              setUpgradeAcik(true);
              return;
            }
            router.push('/(tabs)/wallet');
          }}
        />

        <GradientButton
          title="Ajans"
          variant="ghost"
          onPress={() => router.push('/ajans' as any)}
        />

        <GradientButton
          title="Host paneli"
          variant="ghost"
          onPress={() => router.push('/host' as any)}
        />

        <GradientButton
          title="Şehirler"
          variant="ghost"
          onPress={() => router.push('/sehir' as any)}
        />

        <GradientButton
          title="Platform"
          variant="ghost"
          onPress={() => router.push('/platform' as any)}
        />

        <GradientButton
          title="Sertifikasyon"
          variant="ghost"
          onPress={() => router.push('/sertifikasyon' as any)}
        />

        <Pressable onPress={onSignOut} style={styles.logout}>
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </Pressable>
      </View>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={() => setUpgradeAcik(false)}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
          Alert.alert('Tamam', 'Hesabın güncellendi.');
        }}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={colors.primarySoft} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 14 },
  hero: { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: { ...typography.title, color: colors.text },
  username: { ...typography.body, color: colors.textMuted },
  publicId: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  guestBadge: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  guestBadgeText: { ...typography.micro, color: colors.accent },
  stats: { flexDirection: 'row', gap: 18, marginTop: 10 },
  stat: { alignItems: 'center', minWidth: 70 },
  statValue: { ...typography.h1, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: {
    ...typography.body,
    color: colors.text,
    maxWidth: '45%',
    textAlign: 'right',
  },
  logout: { marginTop: 'auto', alignItems: 'center', paddingVertical: 16 },
  logoutText: { ...typography.body, color: colors.danger, fontWeight: '700' },
});
