import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/contexts/AuthContext';
import { CoinPaketleriniGetir } from '../../src/moduller/cuzdan/okuma/CoinPaketleriniGetir';
import { CuzdanLedgeriniGetir, type LedgerSatiri } from '../../src/moduller/cuzdan/okuma/CuzdanLedgeriniGetir';
import { CoinSatinAlOnayla } from '../../src/moduller/iap/islemler/CoinSatinAlOnayla';
import { KillSwitchAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { CekimTalebiOlustur, CekimTaleplerimiGetir } from '../../src/moduller/cuzdan/cekim/CekimTalebiOlustur';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import type { CoinPackage } from '../../src/types/models';
import { colors, radii, typography } from '../../src/theme/colors';

const FALLBACK_PACKAGES: CoinPackage[] = [
  {
    id: '1',
    sku: 'coins_60',
    title: 'Starter',
    coins: 60,
    bonus_coins: 0,
    price_usd: 0.99,
    badge: null,
  },
  {
    id: '2',
    sku: 'coins_300',
    title: 'Popular',
    coins: 300,
    bonus_coins: 30,
    price_usd: 4.99,
    badge: 'HOT',
  },
  {
    id: '3',
    sku: 'coins_1280',
    title: 'VIP',
    coins: 1280,
    bonus_coins: 220,
    price_usd: 19.99,
    badge: 'BEST',
  },
  {
    id: '4',
    sku: 'coins_6480',
    title: 'Legend',
    coins: 6480,
    bonus_coins: 1600,
    price_usd: 99.99,
    badge: 'MAX',
  },
];

type CekimTalebi = {
  id: string;
  diamonds: number;
  status: string;
  method: string;
  created_at: string;
};

export default function WalletScreen() {
  const { wallet, refreshWallet, isGuest, refreshProfile } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [packages, setPackages] = useState<CoinPackage[]>(FALLBACK_PACKAGES);
  const [ledger, setLedger] = useState<LedgerSatiri[]>([]);
  const [withdrawals, setWithdrawals] = useState<CekimTalebi[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const yenileCekim = useCallback(() => {
    CekimTaleplerimiGetir()
      .then((rows) => setWithdrawals(rows as CekimTalebi[]))
      .catch(() => setWithdrawals([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshWallet();
      void KillSwitchAktifMiSunucu('kill_coin_purchase').then(setPurchaseLocked);
      CoinPaketleriniGetir()
        .then((data) => {
          if (data.length) setPackages(data);
        })
        .catch(() => undefined);
      CuzdanLedgeriniGetir(12)
        .then(setLedger)
        .catch(() => setLedger([]));
      yenileCekim();
    }, [refreshWallet, yenileCekim]),
  );

  const onBuy = (pkg: CoinPackage) => {
    islemiDene('coin_satinal', () => {
      if (purchaseLocked) {
        Alert.alert('Kapalı', 'Coin satın alma geçici olarak durduruldu (kill switch).');
        return;
      }
      Alert.alert(
        'Coin yükle',
        `${pkg.title}: ${pkg.coins + pkg.bonus_coins} coin\n\nGeliştirme: sandbox onay (IAP Edge Function sonra).`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Onayla (dev)',
            onPress: async () => {
              const sonuc = await CoinSatinAlOnayla({
                packageId: pkg.id,
                store: 'manual',
                amountUsd: pkg.price_usd,
              });
              if (!sonuc.ok) {
                Alert.alert('Satın alma başarısız', sonuc.hata);
                return;
              }
              await refreshWallet();
              const rows = await CuzdanLedgeriniGetir(12).catch(() => []);
              setLedger(rows);
              Alert.alert('Başarılı', `+${sonuc.coinsAdded} coin yüklendi.`);
            },
          },
        ],
      );
    });
  };

  const onWithdraw = () => {
    islemiDene('cekim', () => {
      const diamonds = Number.parseInt(withdrawAmount.replace(/\D/g, ''), 10);
      if (!Number.isFinite(diamonds) || diamonds <= 0) {
        Alert.alert('Tutar', 'Geçerli bir elmas miktarı gir.');
        return;
      }
      if ((wallet?.diamonds ?? 0) < diamonds) {
        Alert.alert('Yetersiz', 'Elmas bakiyesi yetersiz.');
        return;
      }
      Alert.alert('Çekim talebi', `${diamonds} elmas çekilsin mi?`, [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Talep et',
          onPress: async () => {
            setWithdrawBusy(true);
            const sonuc = await CekimTalebiOlustur({
              diamonds,
              method: 'bank',
            });
            setWithdrawBusy(false);
            if (!sonuc.ok) {
              Alert.alert(
                'Çekim reddedildi',
                sonuc.hata ??
                  'withdrawals_enabled / kill_withdrawal veya migration kontrol et.',
              );
              return;
            }
            setWithdrawAmount('');
            await refreshWallet();
            yenileCekim();
            const rows = await CuzdanLedgeriniGetir(12).catch(() => []);
            setLedger(rows);
            Alert.alert('Talep alındı', 'Çekim incelemede (pending).');
          },
        },
      ]);
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan">
        <View style={styles.header}>
          <Text style={styles.title}>Cüzdan</Text>
          <Text style={styles.sub}>
            Coin harca · Elmas kazan
            {purchaseLocked ? ' · SATIN ALMA KAPALI' : ''}
          </Text>
        </View>

        <View style={styles.balances}>
          <LinearGradient colors={[...colors.gradientGold]} style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Coin</Text>
            <Text style={styles.balanceValue}>{wallet?.coins ?? 0}</Text>
            <Text style={styles.balanceHint}>Hediyeler için</Text>
          </LinearGradient>
          <LinearGradient colors={[...colors.gradientDiamond]} style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Elmas</Text>
            <Text style={styles.balanceValue}>{wallet?.diamonds ?? 0}</Text>
            <Text style={styles.balanceHint}>Host kazancı</Text>
          </LinearGradient>
        </View>

        <View style={styles.withdrawBox}>
          <Text style={styles.withdrawLabel}>Elmas çekimi</Text>
          <TextInput
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            keyboardType="number-pad"
            placeholder="Miktar"
            placeholderTextColor={colors.textMuted}
            style={styles.withdrawInput}
          />
          <Pressable
            onPress={onWithdraw}
            style={[styles.withdraw, withdrawBusy && { opacity: 0.6 }]}
            disabled={withdrawBusy}
          >
            <Text style={styles.withdrawText}>
              {withdrawBusy ? 'Gönderiliyor…' : 'Çekim talebi oluştur'}
            </Text>
          </Pressable>
          {withdrawals.length > 0 ? (
            <View style={styles.withdrawList}>
              {withdrawals.slice(0, 5).map((w) => (
                <Text key={w.id} style={styles.withdrawRow}>
                  {w.diamonds} · {w.status} · {w.method}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={styles.section}>Coin paketleri</Text>
        <FlatList
          data={packages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <View style={styles.ledgerBlock}>
              <Text style={styles.section}>Son hareketler</Text>
              {ledger.length === 0 ? (
                <Text style={styles.ledgerEmpty}>Ledger boş veya migration eksik.</Text>
              ) : (
                ledger.map((row) => (
                  <View key={row.id} style={styles.ledgerRow}>
                    <Text style={styles.ledgerReason}>{row.reason}</Text>
                    <Text
                      style={[
                        styles.ledgerDelta,
                        { color: row.delta >= 0 ? colors.mint : colors.danger },
                      ]}
                    >
                      {row.delta >= 0 ? '+' : ''}
                      {row.delta} {row.currency}
                    </Text>
                  </View>
                ))
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onBuy(item)} style={styles.pkg}>
              <View style={styles.pkgLeft}>
                <Text style={styles.pkgTitle}>{item.title}</Text>
                <Text style={styles.pkgCoins}>
                  {item.coins}
                  {item.bonus_coins ? ` +${item.bonus_coins} bonus` : ''} coin
                </Text>
              </View>
              <View style={styles.pkgRight}>
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                <Text style={styles.price}>${item.price_usd.toFixed(2)}</Text>
              </View>
            </Pressable>
          )}
        />
      </ModulHataSiniri>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={upgradeKapat}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted, marginBottom: 12 },
  balances: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  balanceCard: {
    flex: 1,
    borderRadius: radii.lg,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  balanceLabel: { ...typography.caption, color: '#12040C', opacity: 0.7 },
  balanceValue: { ...typography.title, color: '#12040C' },
  balanceHint: { ...typography.micro, color: '#12040C', opacity: 0.65 },
  withdrawBox: {
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  withdrawLabel: { ...typography.caption, color: colors.textMuted },
  withdrawInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.body,
  },
  withdraw: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  withdrawText: { ...typography.body, color: colors.mint, fontWeight: '700' },
  withdrawList: { gap: 4, marginTop: 4 },
  withdrawRow: { ...typography.micro, color: colors.textMuted },
  section: {
    ...typography.h2,
    color: colors.text,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 20, paddingBottom: 30, gap: 10 },
  pkg: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  pkgLeft: { gap: 4 },
  pkgTitle: { ...typography.h2, color: colors.text },
  pkgCoins: { ...typography.caption, color: colors.accent },
  pkgRight: { alignItems: 'flex-end', gap: 6 },
  badge: {
    backgroundColor: 'rgba(232, 64, 145, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { ...typography.micro, color: colors.primarySoft },
  price: { ...typography.h2, color: colors.text },
  ledgerBlock: { marginTop: 8, gap: 8 },
  ledgerEmpty: { ...typography.caption, color: colors.textMuted, paddingHorizontal: 4 },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ledgerReason: { ...typography.caption, color: colors.textMuted },
  ledgerDelta: { ...typography.caption, fontWeight: '700' },
});
