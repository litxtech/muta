import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminFinanceCoinAyarla,
  AdminFinanceCoinYonetimGetir,
} from '../../../../../src/moduller/admin/finance/AdminFinanceApi';
import { AdminKullaniciCoinIsle } from '../../../../../src/moduller/admin/kullanici/islemler/AdminKullaniciCoinIsle';
import {
  FinanceCoin,
  FinanceKpiKart,
  FinanceNav,
} from '../../../../../src/moduller/admin/finance/bilesenler/FinanceUi';
import { RenkTokenlari } from '../../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { MedyaUriGuvenli } from '../../../../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';

type Filtre = 'all' | 'platform' | 'purchase' | 'balance';

type Satir = {
  user_id: string;
  display_name: string;
  username: string | null;
  public_user_id: string | null;
  avatar_url: string | null;
  agency_name: string | null;
  current_coin: number;
  current_bonus_coin: number;
  current_game_coin: number;
  coin_purchased: number;
  coin_platform: number;
  coin_spent: number;
};

const FILTRELER: { key: Filtre; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'balance', label: 'Bakiyeli' },
  { key: 'purchase', label: 'Kullanıcı yükledi' },
  { key: 'platform', label: 'Platform yükledi' },
];

const HIZLI = [1_000, 5_000, 10_000, 50_000, 100_000] as const;

type CoinIslemi =
  | 'topup'
  | 'deduct'
  | 'reset'
  | 'set'
  | 'bonus_topup'
  | 'bonus_deduct';

type CoinOnayi = { islem: CoinIslemi; miktar: number };

type CoinSonucu = { tur: 'ok' | 'hata'; yazi: string };

function Avatar({ url, ad }: { url?: string | null; ad: string }) {
  const safe = MedyaUriGuvenli(url);
  const harf = (ad.trim() || '?').charAt(0).toLocaleUpperCase('tr-TR');
  if (safe) {
    return <Image source={{ uri: safe }} style={st.avatar} />;
  }
  return (
    <View style={[st.avatar, st.avatarBos]}>
      <Text style={st.avatarHarf}>{harf}</Text>
    </View>
  );
}

export default function FinanceCoinYonetimEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('balance');
  const [ozet, setOzet] = useState<any>(null);
  const [items, setItems] = useState<Satir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState<Satir | null>(null);
  const [miktar, setMiktar] = useState('1000');
  const [hedef, setHedef] = useState('');
  const [busy, setBusy] = useState(false);
  /** Onay panelin içinde sorulur — web'de Alert'e bağlı kalmadan çalışır. */
  const [onay, setOnay] = useState<CoinOnayi | null>(null);
  const [sonuc, setSonuc] = useState<CoinSonucu | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const res = await AdminFinanceCoinYonetimGetir(50, 0, q.trim() || undefined, filtre);
      setOzet(res?.ozet ?? null);
      setItems((res?.items ?? []) as Satir[]);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, [q, filtre]);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  const isle = (
    islem: CoinIslemi,
    opts?: { miktar?: number },
  ) => {
    if (!secili || busy) return;
    const m = opts?.miktar ?? Number(miktar);
    if (islem !== 'reset' && islem !== 'set' && (!Number.isFinite(m) || m <= 0)) {
      setSonuc({ tur: 'hata', yazi: 'Geçerli miktar girin' });
      return;
    }
    if (islem === 'set') {
      const h = Number(hedef);
      if (!Number.isFinite(h) || h < 0) {
        setSonuc({ tur: 'hata', yazi: 'Hedef miktar 0 veya üzeri olmalı' });
        return;
      }
    }

    setSonuc(null);
    setOnay({ islem, miktar: m });
  };

  const onayMetni = (onayDegeri: CoinOnayi): string => {
    const { islem, miktar: m } = onayDegeri;
    const etiket =
      islem === 'bonus_topup'
        ? `+${FinanceCoin(m)} ödül coin yükle`
        : islem === 'bonus_deduct'
          ? `-${FinanceCoin(m)} ödül coin düşür`
          : islem === 'topup'
            ? `+${FinanceCoin(m)} yükle`
            : islem === 'deduct'
              ? `-${FinanceCoin(m)} düşür`
              : islem === 'reset'
                ? 'Bakiyeyi sıfırla'
                : `Bakiyeyi ${FinanceCoin(Number(hedef))} yap`;
    const bakiye = secili
      ? ` · coin ${FinanceCoin(secili.current_coin)} · ödül ${FinanceCoin(
          secili.current_bonus_coin,
        )}`
      : '';
    return `${secili?.display_name ?? 'Kullanıcı'} · ${etiket}${bakiye}`;
  };

  const uygula = async (onayDegeri: CoinOnayi) => {
    if (!secili || busy) return;
    const { islem, miktar: m } = onayDegeri;
    setOnay(null);
    setSonuc(null);
    setBusy(true);
    try {
      const bakiyeYaz = (coins: number, bonus: number, eksik = 0) => {
        setSonuc({
          tur: 'ok',
          yazi: `Tamam · coin ${FinanceCoin(coins)} · ödül ${FinanceCoin(bonus)}${
            eksik > 0 ? ` · ${FinanceCoin(eksik)} eksik` : ''
          }`,
        });
        setSecili((s) =>
          s ? { ...s, current_coin: coins, current_bonus_coin: bonus } : s,
        );
      };

      // Ödül coin işlemleri ayrı kovada yürür (bonus_coins).
      if (islem === 'bonus_topup' || islem === 'bonus_deduct') {
        const r = await AdminKullaniciCoinIsle({
          userRef: secili.user_id,
          islem: islem === 'bonus_topup' ? 'topup' : 'deduct',
          kova: 'bonus_coins',
          miktar: m,
          not: 'Finans Merkezi ödül coin',
        });
        if (!r.ok) throw new Error(r.hata);
        bakiyeYaz(r.coins, r.bonus_coins, r.shortfall);
        await yukle();
        return;
      }

      const r = await AdminFinanceCoinAyarla({
        userId: secili.user_id,
        islem,
        miktar: islem === 'set' ? Number(hedef) : islem === 'reset' ? undefined : m,
        not: 'Finans Merkezi coin yönetimi',
      });
      if (r?.ok === false) throw new Error('İşlem başarısız');
      const coinsAfter =
        typeof r?.coins === 'number' ? r.coins : Number(r?.balance_after ?? 0);
      const bonusAfter =
        typeof r?.bonus_coins === 'number'
          ? r.bonus_coins
          : secili.current_bonus_coin;
      bakiyeYaz(coinsAfter, bonusAfter, Number(r?.shortfall ?? 0));
      await yukle();
    } catch (e) {
      setSonuc({
        tur: 'hata',
        yazi: e instanceof Error && e.message ? e.message : 'İşlem başarısız',
      });
    } finally {
      // Hata olsa da düğmeler kilitli kalmasın.
      setBusy(false);
    }
  };

  if (!admin) return null;

  return (
    <Screen>
      <EkranBasligi
        title="Coin yönetimi"
        subtitle="Coin / ödül coin · bakiye gör · ekle / düşür / sıfırla"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
        keyboardShouldPersistTaps="handled"
      >
        <FinanceNav />

        <View style={AdminStil.kpiGrid}>
          <FinanceKpiKart
            label="Platform yükledi"
            value={FinanceCoin(ozet?.platform_yuklenen)}
            hint="Admin / bonus / ajans"
            tone="warning"
          />
          <FinanceKpiKart
            label="Kullanıcı yükledi"
            value={FinanceCoin(ozet?.kullanici_satin_alan)}
            hint="IAP · Stripe satış"
            tone="positive"
          />
          <FinanceKpiKart
            label="Cüzdan toplamı"
            value={FinanceCoin(ozet?.cuzdan_toplam)}
            hint="Satın alınan coin"
          />
          <FinanceKpiKart
            label="Ödül toplamı"
            value={FinanceCoin(ozet?.odul_toplam)}
            hint="Bonus / promosyon"
            tone="warning"
          />
          <FinanceKpiKart
            label="Oyun toplamı"
            value={FinanceCoin(ozet?.oyun_toplam)}
            hint="Oyun kazancı"
          />
          <FinanceKpiKart
            label="Bakiyeli kullanıcı"
            value={FinanceCoin(ozet?.bakiye_olan_kullanici)}
          />
        </View>

        <TextInput
          style={AdminStil.input}
          placeholder="Ara: isim · @kullanıcı · id"
          placeholderTextColor={RenkTokenlari.textDim}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => void yukle()}
          returnKeyType="search"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filtreRow}>
          {FILTRELER.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFiltre(f.key)}
              style={[st.filtre, filtre === f.key && st.filtreAktif]}
            >
              <Text style={[st.filtreYazi, filtre === f.key && st.filtreYaziAktif]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={AdminStil.aksiyon} onPress={() => void yukle()}>
          <Text style={AdminStil.aksiyonYazi}>Yenile</Text>
        </Pressable>

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}
        {yukleniyor && items.length === 0 ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : items.length === 0 ? (
          <Text style={AdminStil.bos}>Kayıt yok</Text>
        ) : (
          items.map((u) => (
            <Pressable
              key={u.user_id}
              style={st.kart}
              onPress={() => {
                setSecili(u);
                setHedef(String(u.current_coin ?? 0));
                setMiktar('1000');
              }}
            >
              <Avatar url={u.avatar_url} ad={u.display_name || u.username || '?'} />
              <View style={st.kartGovde}>
                <Text style={AdminStil.kartBaslik} numberOfLines={1}>
                  {u.display_name}
                  {u.username ? ` · @${u.username}` : ''}
                </Text>
                <Text style={AdminStil.kartAlt} numberOfLines={1}>
                  ID {u.public_user_id || u.user_id.slice(0, 8)}
                  {u.agency_name ? ` · ${u.agency_name}` : ''}
                </Text>
                <View style={st.etiketRow}>
                  <View style={[st.etiket, st.etiketBakiye]}>
                    <Text style={st.etiketYazi}>Coin {FinanceCoin(u.current_coin)}</Text>
                  </View>
                  <View style={[st.etiket, st.etiketBonus]}>
                    <Text style={st.etiketYazi}>Ödül {FinanceCoin(u.current_bonus_coin)}</Text>
                  </View>
                  <View style={[st.etiket, st.etiketUser]}>
                    <Text style={st.etiketYazi}>Kullanıcı {FinanceCoin(u.coin_purchased)}</Text>
                  </View>
                  <View style={[st.etiket, st.etiketPlat]}>
                    <Text style={st.etiketYazi}>Platform {FinanceCoin(u.coin_platform)}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={!!secili} transparent animationType="slide" onRequestClose={() => setSecili(null)}>
        <Pressable style={st.modalBg} onPress={() => !busy && setSecili(null)}>
          <Pressable style={st.modalKart} onPress={(e) => e.stopPropagation()}>
            {secili ? (
              <>
                <View style={st.modalBaslik}>
                  <Avatar url={secili.avatar_url} ad={secili.display_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={AdminStil.kartBaslik}>{secili.display_name}</Text>
                    <Text style={AdminStil.kartAlt}>
                      @{secili.username || '—'} · ID {secili.public_user_id || secili.user_id.slice(0, 8)}
                    </Text>
                    <Text style={AdminStil.kartAlt}>
                      Coin {FinanceCoin(secili.current_coin)} · Ödül{' '}
                      {FinanceCoin(secili.current_bonus_coin)} · Kullanıcı{' '}
                      {FinanceCoin(secili.coin_purchased)} · Platform{' '}
                      {FinanceCoin(secili.coin_platform)}
                    </Text>
                  </View>
                </View>

                <Text style={AdminStil.sectionLabel}>Miktar</Text>
                <TextInput
                  style={AdminStil.input}
                  keyboardType="number-pad"
                  value={miktar}
                  onChangeText={setMiktar}
                  placeholderTextColor={RenkTokenlari.textDim}
                />
                <View style={st.hizliRow}>
                  {HIZLI.map((n) => (
                    <Pressable key={n} style={st.hizli} onPress={() => setMiktar(String(n))}>
                      <Text style={st.hizliYazi}>{FinanceCoin(n)}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={st.aksiyonGrid}>
                  <Pressable
                    style={({ pressed }) => [
                      st.btn,
                      st.btnPoz,
                      pressed && !busy && st.btnBasili,
                      busy && st.btnPasif,
                    ]}
                    disabled={busy}
                    onPress={() => isle('bonus_topup')}
                  >
                    <Text style={st.btnYazi}>Ödül yükle</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      st.btn,
                      st.btnNeg,
                      pressed && !busy && st.btnBasili,
                      busy && st.btnPasif,
                    ]}
                    disabled={busy}
                    onPress={() => isle('deduct')}
                  >
                    <Text style={st.btnYazi}>Coin düşür</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    st.btn,
                    st.btnBonus,
                    pressed && !busy && st.btnBasili,
                    busy && st.btnPasif,
                  ]}
                  disabled={busy}
                  onPress={() => isle('bonus_deduct')}
                >
                  <Text style={st.btnYazi}>Ödül coin düşür</Text>
                </Pressable>

                <Text style={AdminStil.sectionLabel}>Hedef coin bakiyesi</Text>
                <TextInput
                  style={AdminStil.input}
                  keyboardType="number-pad"
                  value={hedef}
                  onChangeText={setHedef}
                  placeholder="Örn. 50000"
                  placeholderTextColor={RenkTokenlari.textDim}
                />
                <Text style={AdminStil.kartAlt}>
                  Hedefin üzerindeki fark ödül coinine yazılır; satın alınan coin
                  admin tarafından artırılmaz.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    st.btn,
                    st.btnNotr,
                    pressed && !busy && st.btnBasili,
                    busy && st.btnPasif,
                  ]}
                  disabled={busy}
                  onPress={() => isle('set')}
                >
                  <Text style={st.btnYazi}>Miktarı ayarla</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    st.btn,
                    st.btnTehlike,
                    pressed && !busy && st.btnBasili,
                    busy && st.btnPasif,
                  ]}
                  disabled={busy}
                  onPress={() => isle('reset')}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={RenkTokenlari.text} />
                  ) : (
                    <Text style={st.btnYazi}>Coinleri sıfırla</Text>
                  )}
                </Pressable>

                {onay ? (
                  <View style={st.onayKutu}>
                    <Text style={st.onayBaslik}>Onay</Text>
                    <Text style={st.onayMetin}>{onayMetni(onay)}?</Text>
                    <View style={st.onaySatir}>
                      <Pressable
                        style={({ pressed }) => [st.onayDugme, pressed && st.btnBasili]}
                        onPress={() => setOnay(null)}
                      >
                        <Text style={st.onayVazgecYazi}>Vazgeç</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          st.onayDugme,
                          st.onayUygula,
                          pressed && st.btnBasili,
                        ]}
                        onPress={() => void uygula(onay)}
                      >
                        <Text style={st.onayUygulaYazi}>Uygula</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {sonuc ? (
                  <Text
                    style={[
                      st.sonucYazi,
                      {
                        color:
                          sonuc.tur === 'hata'
                            ? RenkTokenlari.danger
                            : RenkTokenlari.mint,
                      },
                    ]}
                  >
                    {sonuc.yazi}
                  </Text>
                ) : null}

                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => {
                    setSecili(null);
                    router.push(`/admin/finance/users/${secili.user_id}` as any);
                  }}
                >
                  <Text style={AdminStil.aksiyonYazi}>Finans profilini aç</Text>
                </Pressable>
                <Pressable onPress={() => !busy && setSecili(null)}>
                  <Text style={[AdminStil.kartAlt, { textAlign: 'center', marginTop: 8 }]}>
                    Kapat
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarBos: {
    backgroundColor: RenkTokenlari.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  avatarHarf: {
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    fontSize: 18,
  },
  filtreRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filtre: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  filtreAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  filtreYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  filtreYaziAktif: {
    color: RenkTokenlari.text,
  },
  kart: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
  },
  kartGovde: {
    flex: 1,
    gap: 4,
  },
  etiketRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  etiket: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  etiketBakiye: {
    backgroundColor: 'rgba(200,200,220,0.12)',
  },
  etiketUser: {
    backgroundColor: 'rgba(107,207,176,0.15)',
  },
  etiketBonus: {
    backgroundColor: `rgba(232,184,75,0.16)`,
  },
  etiketPlat: {
    backgroundColor: 'rgba(232,64,145,0.12)',
  },
  etiketYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '600',
    fontSize: 10,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKart: {
    backgroundColor: RenkTokenlari.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    maxHeight: '88%',
  },
  modalBaslik: {
    flexDirection: 'row',
    gap: BoslukTokenlari.md,
    alignItems: 'center',
    marginBottom: 8,
  },
  hizliRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hizli: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  hizliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  aksiyonGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.md,
    alignItems: 'center',
  },
  btnPoz: {
    backgroundColor: 'rgba(107,207,176,0.25)',
  },
  btnNeg: {
    backgroundColor: 'rgba(232,75,106,0.22)',
  },
  btnBonus: {
    backgroundColor: 'rgba(232,184,75,0.22)',
  },
  btnNotr: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  btnTehlike: {
    backgroundColor: 'rgba(232,75,106,0.35)',
  },
  btnYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  btnBasili: { opacity: 0.75 },
  btnPasif: { opacity: 0.55 },
  onayKutu: {
    gap: 8,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.45)',
    backgroundColor: RenkTokenlari.bgCard,
    marginTop: 4,
  },
  onayBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  onayMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 19,
  },
  onaySatir: { flexDirection: 'row', gap: 8 },
  onayDugme: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  onayVazgecYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  onayUygula: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.primary,
  },
  onayUygulaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  sonucYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '700',
    marginTop: 2,
  },
});
