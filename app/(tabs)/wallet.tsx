import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { KlavyeKapatan } from '../../src/components/KlavyeKapatan';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { CoinPaketleriniGetir } from '../../src/moduller/cuzdan/okuma/CoinPaketleriniGetir';
import { COIN_PAKET_FALLBACK } from '../../src/moduller/cuzdan/katalog/CoinPaketFallback';
import {
  CoinPaketMagaza,
  PaketFiyatTry,
} from '../../src/moduller/cuzdan/bilesenler/CoinPaketMagaza';
import { CanliHediyeSimgesi } from '../../src/moduller/cuzdan/bilesenler/CanliCoinSimgesi';
import {
  CuzdanLedgeriniGetir,
  LedgerSebepEtiketi,
  type LedgerSatiri,
} from '../../src/moduller/cuzdan/okuma/CuzdanLedgeriniGetir';
import { CoinPaketiSatinAl } from '../../src/moduller/iap/islemler/CoinPaketiSatinAl';
import { KillSwitchAktifMiSunucu } from '../../src/moduller/ozellik-bayraklari/okuma/KillSwitchAktifMiSunucu';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  CekimTalebiOlustur,
  CekimTaleplerimiGetir,
} from '../../src/moduller/cuzdan/cekim/CekimTalebiOlustur';
import { CEKIM_ODEME_BILGISI } from '../../src/moduller/cuzdan/cekim/CekimOdemeBilgisi';
import { BankaHesabiGetir } from '../../src/moduller/kullanici-profili/islemler/BankaHesabi';
import type { BankaHesabi } from '../../src/moduller/kullanici-profili/islemler/BankaHesabi';
import {
  HediyeGecmisiniGetir,
  type HediyeGecmisiKaydi,
} from '../../src/moduller/hediyeler/okuma/HediyeGecmisiniGetir';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { CuzdanBankaKarti } from '../../src/moduller/cuzdan/bilesenler/CuzdanBankaKarti';
import {
  CuzdanHareketDetayKarti,
  type CuzdanHareketDetay,
} from '../../src/moduller/cuzdan/bilesenler/CuzdanHareketDetayKarti';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import type { CoinPackage } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type CekimTalebi = {
  id: string;
  diamonds: number;
  status: string;
  method: string;
  created_at: string;
};

const CEKIM_DURUM: Record<string, string> = {
  pending: 'İncelemede',
  under_review: 'İncelemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  paid: 'Ödendi',
  frozen: 'Donduruldu',
};

function LedgerBirimEtiketi(currency: string): string {
  if (currency === 'diamonds' || currency === 'diamond') return 'elmas';
  return 'coin';
}

type Sekme = 'hareket' | 'hediye' | 'yukle' | 'cekim';

function formatTarih(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function WalletScreen() {
  const { wallet, refreshWallet, adjustWallet, isGuest, refreshProfile, user, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [packages, setPackages] = useState<CoinPackage[]>(COIN_PAKET_FALLBACK);
  const [ledger, setLedger] = useState<LedgerSatiri[]>([]);
  const [hediyeler, setHediyeler] = useState<HediyeGecmisiKaydi[]>([]);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [withdrawals, setWithdrawals] = useState<CekimTalebi[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [purchaseLocked, setPurchaseLocked] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [banka, setBanka] = useState<BankaHesabi | null>(null);
  const [sekme, setSekme] = useState<Sekme>('hareket');
  const [detay, setDetay] = useState<CuzdanHareketDetay | null>(null);

  const yenileHepsi = useCallback(async () => {
    await refreshWallet();
    void KillSwitchAktifMiSunucu('kill_coin_purchase').then(setPurchaseLocked);
    CoinPaketleriniGetir()
      .then((data) => {
        if (data.length) setPackages(data);
      })
      .catch(() => undefined);
    CuzdanLedgeriniGetir(40)
      .then(setLedger)
      .catch(() => setLedger([]));
    CekimTaleplerimiGetir()
      .then((rows) => setWithdrawals(rows as CekimTalebi[]))
      .catch(() => setWithdrawals([]));
    BankaHesabiGetir()
      .then(setBanka)
      .catch(() => setBanka(null));
    if (user?.id) {
      HediyeGecmisiniGetir(user.id, 40)
        .then(setHediyeler)
        .catch(() => setHediyeler([]));
      ProfilIstatistikleriniGetir(user.id)
        .then(setStats)
        .catch(() => setStats(null));
    }
  }, [refreshWallet, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void yenileHepsi();
    }, [yenileHepsi]),
  );

  const yuklemeler = useMemo(
    () => ledger.filter((r) => r.delta > 0 && (r.currency === 'coin' || r.currency === 'coins')),
    [ledger],
  );
  const gonderilen = useMemo(
    () => hediyeler.filter((h) => h.yon === 'gonderilen'),
    [hediyeler],
  );
  const alinan = useMemo(
    () => hediyeler.filter((h) => h.yon === 'alinan'),
    [hediyeler],
  );

  const onBuy = (pkg: CoinPackage) => {
    islemiDene('coin_satinal', () => {
      if (purchaseLocked) {
        Alert.alert('Kapalı', 'Coin satın alma geçici olarak durduruldu.');
        return;
      }
      const toplam = pkg.coins + pkg.bonus_coins;
      const fiyatTry = PaketFiyatTry(pkg);
      const kanal =
        Platform.OS === 'ios' || Platform.OS === 'android'
          ? 'App Store / Play'
          : 'Stripe';
      Alert.alert(
        'Coin yükle',
        `${pkg.title}\n${toplam.toLocaleString('tr-TR')} coin\n${fiyatTry.toLocaleString('tr-TR')} ₺\nÖdeme: ${kanal}`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Satın al',
            onPress: async () => {
              const sonuc = await CoinPaketiSatinAl(pkg);
              if (!sonuc.ok) {
                Alert.alert('Satın alma', sonuc.hata);
                return;
              }
              if (sonuc.method === 'stripe' && sonuc.url) {
                await Linking.openURL(sonuc.url);
                return;
              }
              if (sonuc.coinsAdded != null && sonuc.coinsAdded > 0) {
                adjustWallet({ coins: sonuc.coinsAdded });
              }
              await yenileHepsi();
              Alert.alert(
                'Başarılı',
                sonuc.coinsAdded != null
                  ? `+${sonuc.coinsAdded} coin`
                  : 'Ödeme tamam',
              );
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
      if (!banka?.iban) {
        Alert.alert('Banka bilgisi', 'Önce IBAN ve banka adını kaydet.', [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Profili düzenle',
            onPress: () => router.push('/profil-duzenle' as any),
          },
        ]);
        return;
      }
      Alert.alert(
        'Çekim talebi',
        `${diamonds} elmas → ${banka.bank_name}\n${banka.iban}\n\n${CEKIM_ODEME_BILGISI}`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Talep et',
            onPress: async () => {
              setWithdrawBusy(true);
              const sonuc = await CekimTalebiOlustur({
                diamonds,
                method: 'bank',
                details: {
                  account_holder: banka.account_holder,
                  bank_name: banka.bank_name,
                  iban: banka.iban,
                },
              });
              setWithdrawBusy(false);
              if (!sonuc.ok) {
                Alert.alert('Çekim', sonuc.hata ?? 'Reddedildi');
                return;
              }
              setWithdrawAmount('');
              adjustWallet({ diamonds: -diamonds });
              await yenileHepsi();
              Alert.alert(
                'Talep alındı',
                `İncelemede.\n\n${CEKIM_ODEME_BILGISI}`,
              );
            },
          },
        ],
      );
    });
  };

  const sekmeler: { id: Sekme; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'hareket', label: 'Hareket', icon: 'swap-vertical' },
    { id: 'hediye', label: 'Hediye', icon: 'gift-outline' },
    { id: 'yukle', label: 'Yükle', icon: 'card-outline' },
    { id: 'cekim', label: 'Çekim', icon: 'cash-outline' },
  ];

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="cuzdan">
        <View style={styles.baslikBar}>
          <Pressable
            onPress={() => router.navigate('/(tabs)/profile')}
            style={styles.geri}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={RenkTokenlari.text} />
          </Pressable>
          <View style={styles.baslikCopy}>
            <Text style={styles.baslikFisilti}>HESABIM</Text>
            <Text style={styles.baslik}>Cüzdan</Text>
          </View>
          <View style={styles.geri} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <KlavyeKapatan>
            <CuzdanBankaKarti
              coins={wallet?.coins ?? 0}
              diamonds={wallet?.diamonds ?? 0}
              hesapKodu={profile?.public_user_id ?? user?.id}
              sahipAdi={profile?.display_name ?? profile?.username}
              yuklenen={stats?.total_topup_coin ?? 0}
              harcanan={stats?.total_spent_coin ?? 0}
            />

            {purchaseLocked ? (
              <Text style={styles.lockHint}>Satın alma geçici olarak kapalı</Text>
            ) : null}

            <View style={styles.summaryRow}>
              <OzetKutu
                icon="arrow-up-circle"
                tint={RenkTokenlari.danger}
                label="Gönderilen"
                value={String(stats?.total_gifts_sent ?? gonderilen.length)}
              />
              <OzetKutu
                icon="arrow-down-circle"
                tint={RenkTokenlari.mint}
                label="Alınan"
                value={String(stats?.total_gifts_received ?? alinan.length)}
              />
              <OzetKutu
                icon="trending-up"
                tint={RenkTokenlari.accent}
                label="Yükleme"
                value={String(yuklemeler.length)}
              />
            </View>

            <View style={styles.tabs}>
              {sekmeler.map((s) => {
                const aktif = sekme === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSekme(s.id)}
                    style={[styles.tab, aktif && styles.tabActive]}
                  >
                    <Ionicons
                      name={s.icon}
                      size={15}
                      color={aktif ? RenkTokenlari.text : RenkTokenlari.textDim}
                    />
                    <Text
                      style={[styles.tabText, aktif && styles.tabTextActive]}
                      numberOfLines={1}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {sekme === 'hareket' ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Hesap hareketleri</Text>
                <Text style={styles.panelSub}>Detay için satıra dokun</Text>
                {ledger.length === 0 ? (
                  <Empty text="Henüz hareket yok" />
                ) : (
                  ledger.map((row) => (
                    <Pressable
                      key={row.id}
                      onPress={() => setDetay({ tur: 'ledger', veri: row })}
                      style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                    >
                      <View
                        style={[
                          styles.lineIcon,
                          {
                            backgroundColor:
                              row.delta >= 0
                                ? 'rgba(61,207,176,0.14)'
                                : 'rgba(232,75,106,0.14)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={row.delta >= 0 ? 'add' : 'remove'}
                          size={14}
                          color={
                            row.delta >= 0 ? RenkTokenlari.mint : RenkTokenlari.danger
                          }
                        />
                      </View>
                      <View style={styles.lineCopy}>
                        <Text style={styles.lineTitle} numberOfLines={1}>
                          {LedgerSebepEtiketi(row.reason)}
                        </Text>
                        <Text style={styles.lineMeta}>
                          {formatTarih(row.created_at)}
                          {row.ref_type ? ` · ${row.ref_type}` : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.lineDelta,
                          {
                            color:
                              row.delta >= 0
                                ? RenkTokenlari.mint
                                : RenkTokenlari.danger,
                          },
                        ]}
                      >
                        {row.delta >= 0 ? '+' : ''}
                        {row.delta.toLocaleString('tr-TR')}{' '}
                        {LedgerBirimEtiketi(row.currency)}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={RenkTokenlari.textDim}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {sekme === 'hediye' ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Hediye geçmişi</Text>
                <Text style={styles.panelSub}>Canlı simgeler · detay için dokun</Text>
                {hediyeler.length === 0 ? (
                  <Empty text="Henüz hediye yok" />
                ) : (
                  hediyeler.map((h, i) => {
                    const kim =
                      h.karsi_profil?.display_name ??
                      h.karsi_profil?.username ??
                      'Kullanıcı';
                    const gonderildi = h.yon === 'gonderilen';
                    return (
                      <Pressable
                        key={h.id}
                        onPress={() => setDetay({ tur: 'hediye', veri: h })}
                        style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                      >
                        <View style={styles.hediyeIkon}>
                          <CanliHediyeSimgesi
                            emoji={h.gift?.emoji ?? '🎁'}
                            size={22}
                            delayMs={(i % 6) * 80}
                          />
                        </View>
                        <View style={styles.lineCopy}>
                          <Text style={styles.lineTitle} numberOfLines={1}>
                            {h.gift?.name ?? 'Hediye'}
                            {h.quantity > 1 ? ` ×${h.quantity}` : ''}
                          </Text>
                          <Text style={styles.lineMeta} numberOfLines={2}>
                            {gonderildi ? `→ ${kim}` : `← ${kim}`}
                            {h.oda?.title ? ` · ${h.oda.title}` : ''}
                            {` · ${formatTarih(h.created_at)}`}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.lineDelta,
                            {
                              color: gonderildi
                                ? RenkTokenlari.danger
                                : RenkTokenlari.mint,
                            },
                          ]}
                        >
                          {gonderildi ? `-${h.coins_spent}` : `+${h.diamonds_earned}`}
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={RenkTokenlari.textDim}
                        />
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {sekme === 'yukle' ? (
              <View style={styles.panel}>
                <CoinPaketMagaza
                  packages={packages}
                  locked={purchaseLocked}
                  onBuy={onBuy}
                />
              </View>
            ) : null}

            {sekme === 'cekim' ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Elmas çekimi</Text>
                <View style={styles.odemeBilgiKart}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={RenkTokenlari.accent}
                  />
                  <Text style={styles.odemeBilgiYazi}>{CEKIM_ODEME_BILGISI}</Text>
                </View>
                {banka?.iban ? (
                  <View style={styles.ibanKart}>
                    <Text style={styles.ibanEtiket}>Kayıtlı hesap</Text>
                    <Text style={styles.ibanAd}>{banka.account_holder}</Text>
                    <Text style={styles.ibanBanka}>{banka.bank_name}</Text>
                    <Text style={styles.ibanNo}>{banka.iban}</Text>
                  </View>
                ) : (
                  <Pressable onPress={() => router.push('/profil-duzenle' as any)}>
                    <Text style={styles.panelHintWarn}>
                      IBAN kayıtlı değil — profil düzenlemeden ekle
                    </Text>
                  </Pressable>
                )}
                <TextField
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="number-pad"
                  placeholder="Miktar (elmas)"
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
                {withdrawals.length === 0 ? (
                  <Empty text="Çekim talebi yok" />
                ) : (
                  withdrawals.map((w) => (
                    <Pressable
                      key={w.id}
                      onPress={() =>
                        setDetay({
                          tur: 'cekim',
                          veri: w,
                          durumEtiket: CEKIM_DURUM[w.status] ?? w.status,
                        })
                      }
                      style={({ pressed }) => [styles.line, pressed && styles.linePressed]}
                    >
                      <View style={styles.lineCopy}>
                        <Text style={styles.lineTitle}>
                          {w.diamonds} elmas · {w.method}
                        </Text>
                        <Text style={styles.lineMeta}>{formatTarih(w.created_at)}</Text>
                      </View>
                      <Text style={styles.status}>
                        {CEKIM_DURUM[w.status] ?? w.status}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={RenkTokenlari.textDim}
                      />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
          </KlavyeKapatan>
        </ScrollView>
      </ModulHataSiniri>

      <CuzdanHareketDetayKarti detay={detay} onKapat={() => setDetay(null)} />

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

function OzetKutu({
  icon,
  tint,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summary}>
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={styles.summaryVal}>{value}</Text>
      <Text style={styles.summaryLbl}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

const styles = StyleSheet.create({
  baslikBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm,
  },
  geri: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslikCopy: { flex: 1, alignItems: 'center', gap: 2 },
  baslikFisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
    fontSize: 9,
  },
  baslik: { ...TipografiTokenlari.h1, color: RenkTokenlari.text },
  scroll: {
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
    gap: BoslukTokenlari.md,
  },
  lockHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.warning,
    textAlign: 'center',
    marginHorizontal: BoslukTokenlari.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.xl,
  },
  summary: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: 4,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  summaryVal: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  summaryLbl: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    textAlign: 'center',
  },
  tabs: {
    marginHorizontal: BoslukTokenlari.xl,
    flexDirection: 'row',
    padding: 4,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: YaricapTokenlari.sm,
  },
  tabActive: {
    backgroundColor: RenkTokenlari.surface,
  },
  tabText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  tabTextActive: { color: RenkTokenlari.text, fontWeight: '700' },
  panel: {
    marginHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  panelTitle: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  panelSub: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: 4,
  },
  panelHintWarn: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
  odemeBilgiKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.35)',
    backgroundColor: 'rgba(240, 180, 41, 0.08)',
    marginBottom: 4,
  },
  odemeBilgiYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  empty: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingVertical: BoslukTokenlari.lg,
    textAlign: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    marginBottom: 6,
  },
  linePressed: { opacity: 0.88 },
  lineIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hediyeIkon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  lineCopy: { flex: 1, gap: 2, minWidth: 0 },
  lineTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  lineMeta: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  lineDelta: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
    flexShrink: 0,
  },
  pkg: { marginBottom: 8 },
  pkgInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  pkgLeft: { gap: 2, flex: 1, minWidth: 0 },
  pkgTitle: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  pkgCoins: { ...TipografiTokenlari.caption, color: RenkTokenlari.accent },
  pkgRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge: {
    backgroundColor: 'rgba(232, 64, 145, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.pill,
  },
  badgeText: { ...TipografiTokenlari.micro, color: RenkTokenlari.primarySoft },
  price: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  ibanKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 2,
    marginBottom: 4,
  },
  ibanEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: 4,
  },
  ibanAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  ibanBanka: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  ibanNo: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  withdraw: {
    borderRadius: YaricapTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    alignItems: 'center',
    backgroundColor: 'rgba(61,207,176,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.35)',
  },
  withdrawText: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  status: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    flexShrink: 0,
  },
});
