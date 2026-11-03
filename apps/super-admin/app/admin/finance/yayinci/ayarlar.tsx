import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminUlkeOdemeYontemiKaydet,
  AdminYayinciOdemeAyarlariGetir,
  AdminYayinciOdemeAyarlariGuncelle,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import type { YayinciOdemeAyar } from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BilgiKutusu,
  Etiket,
  Kart,
  OnayliButon,
  Tarih,
  TarihSaat,
  Usd,
  YayinciNav,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

const YONTEMLER = [
  ['bank_transfer', 'Banka transferi'],
  ['local_transfer', 'Yerel transfer'],
  ['wallet_transfer', 'Cüzdan transferi'],
] as const;

export default function YayinciOdemeAyarlariEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [ayar, setAyar] = useState<YayinciOdemeAyar | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const [pay, setPay] = useState('40');
  const [min, setMin] = useState('25');
  const [gun, setGun] = useState('15');
  const [ucret, setUcret] = useState('0');
  const [oto, setOto] = useState(false);

  const [ulke, setUlke] = useState('TR');
  const [yontem, setYontem] = useState<'bank_transfer' | 'local_transfer' | 'wallet_transfer'>(
    'bank_transfer',
  );
  const [saglayici, setSaglayici] = useState('');
  const [paraBirimi, setParaBirimi] = useState('USD');
  const [ulkeMin, setUlkeMin] = useState('25');
  const [etkin, setEtkin] = useState(false);
  const [ulkeOto, setUlkeOto] = useState(false);
  const [kyc, setKyc] = useState(true);
  const [vergi, setVergi] = useState(true);
  const [ulkeNotu, setUlkeNotu] = useState('');

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      setAyar(await AdminYayinciOdemeAyarlariGetir());
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    if (!ayar) return;
    setPay(String(Math.round(Number(ayar.creator_share) * 100)));
    setMin(String(ayar.payout_min_usd ?? 25));
    setGun(String(ayar.payout_day ?? 15));
    setUcret(String(ayar.payout_transfer_fee_usd ?? 0));
    setOto(Boolean(ayar.payout_auto_transfer_enabled));
  }, [ayar]);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  if (!admin) return null;

  const ulkeler: any[] = ayar?.countries ?? [];
  const tatiller: any[] = ayar?.holidays ?? [];

  return (
    <Screen>
      <EkranBasligi title="Ödeme Ayarları" subtitle="Oranlar · eşik · ülke kanalları" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <BilgiKutusu
          baslik="Geçmişe dönük etki yok"
          metin="Oran, eşik ve ödeme günü değişiklikleri yalnızca bundan sonraki dönemlere uygulanır. Kapanmış dönemler ve mevcut ödeme listeleri bu değişikliklerden etkilenmez. Her değişiklik finans denetim kaydına yazılır."
        />

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !ayar ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !ayar ? (
          <Text style={AdminStil.bos}>Ayarlar yüklenemedi</Text>
        ) : (
          <>
            <Kart
              baslik="Gelir paylaşımı ve ödeme kuralları"
              alt={`Son güncelleme ${TarihSaat(ayar.updated_at)} · coin başına gelir ${Usd(
                ayar.revenue_usd_per_coin,
              )} (salt okunur)`}
            >
              <Text style={AdminStil.kartAlt}>Yayıncı payı (%)</Text>
              <TextInput
                style={AdminStil.input}
                value={pay}
                onChangeText={setPay}
                keyboardType="decimal-pad"
                placeholder="40"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <Text style={AdminStil.kartAlt}>Platform payı otomatik: %{100 - Number(pay || 0)}</Text>

              <Text style={AdminStil.kartAlt}>Minimum ödeme (USD)</Text>
              <TextInput
                style={AdminStil.input}
                value={min}
                onChangeText={setMin}
                keyboardType="decimal-pad"
                placeholder="25"
                placeholderTextColor={RenkTokenlari.textDim}
              />

              <Text style={AdminStil.kartAlt}>Aylık ödeme günü (1–28)</Text>
              <TextInput
                style={AdminStil.input}
                value={gun}
                onChangeText={setGun}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={RenkTokenlari.textDim}
              />

              <Text style={AdminStil.kartAlt}>Transfer kesintisi (USD)</Text>
              <TextInput
                style={AdminStil.input}
                value={ucret}
                onChangeText={setUcret}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={RenkTokenlari.textDim}
              />

              <View style={AdminStil.satir}>
                <View style={{ flex: 1 }}>
                  <Text style={AdminStil.kartBaslik}>Otomatik transfer</Text>
                  <Text style={AdminStil.kartAlt}>
                    Sağlayıcı ve hukuki kontroller tamamlanmadan açılmamalıdır. Açıkken bile en az bir
                    ülke kanalı sağlayıcı + otomatik ödeme ile tanımlı olmalıdır.
                  </Text>
                </View>
                <Switch value={oto} onValueChange={setOto} />
              </View>

              <OnayliButon
                etiket="Ayarları kaydet"
                onOnay={async () => {
                  const share = Number(pay.replace(',', '.')) / 100;
                  const minUsd = Number(min.replace(',', '.'));
                  const day = Math.round(Number(gun));
                  const fee = Number(ucret.replace(',', '.'));
                  if (!(share > 0 && share < 1)) throw new Error('Yayıncı payı %1–%99 arasında olmalı');
                  if (!(minUsd > 0)) throw new Error('Minimum ödeme 0’dan büyük olmalı');
                  if (!(day >= 1 && day <= 28)) throw new Error('Ödeme günü 1–28 arasında olmalı');
                  if (!(fee >= 0 && fee < minUsd)) throw new Error('Kesinti geçersiz');
                  setMesaj(null);
                  const yeni = await AdminYayinciOdemeAyarlariGuncelle({
                    creator_share: share,
                    payout_min_usd: minUsd,
                    payout_day: day,
                    payout_transfer_fee_usd: fee,
                    payout_auto_transfer_enabled: oto,
                  });
                  setAyar(yeni as YayinciOdemeAyar);
                  setMesaj('Ayarlar güncellendi ve denetim kaydına yazıldı.');
                }}
              />
              {mesaj ? (
                <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{mesaj}</Text>
              ) : null}
            </Kart>

            <Text style={AdminStil.sectionLabel}>Ülke ödeme yöntemleri ({ulkeler.length})</Text>
            {ulkeler.length === 0 ? (
              <Text style={AdminStil.bos}>Tanımlı ülke yöntemi yok</Text>
            ) : (
              ulkeler.map((c) => (
                <View key={c.id ?? `${c.country_code}-${c.method}`} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>
                      {c.country_code} · {c.method}
                    </Text>
                    <Etiket
                      metin={c.is_enabled ? 'Etkin' : 'Kapalı'}
                      renk={c.is_enabled ? RenkTokenlari.mint : RenkTokenlari.textMuted}
                    />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    Sağlayıcı {c.provider || '—'} · {c.currency} · min {Usd(c.min_payout_usd)} ·
                    otomatik {c.auto_payout ? 'evet' : 'hayır'}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    KYC {c.requires_kyc ? 'gerekli' : 'gerekmez'} · vergi{' '}
                    {c.requires_tax_info ? 'gerekli' : 'gerekmez'}
                    {c.note ? ` · ${c.note}` : ''}
                  </Text>
                </View>
              ))
            )}

            <Kart
              baslik="Ülke kanalı ekle / güncelle"
              alt="Bir ülkede doğrulanmış kanal yoksa o ülke için otomatik ödeme açılmaz. Sağlayıcı sözleşmesi olmadan etkinleştirmeyin."
            >
              <TextInput
                style={AdminStil.input}
                value={ulke}
                onChangeText={(v) => setUlke(v.toUpperCase().slice(0, 2))}
                placeholder="Ülke kodu (TR, PH, CO, VE, EG)"
                placeholderTextColor={RenkTokenlari.textDim}
                autoCapitalize="characters"
              />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {YONTEMLER.map(([k, l]) => (
                  <Pressable
                    key={k}
                    onPress={() => setYontem(k)}
                    style={[AdminStil.aksiyon, yontem === k && { borderColor: RenkTokenlari.borderAccent }]}
                  >
                    <Text style={AdminStil.aksiyonYazi}>{l}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={AdminStil.input}
                value={saglayici}
                onChangeText={setSaglayici}
                placeholder="Ödeme sağlayıcısı (opsiyonel)"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <TextInput
                style={AdminStil.input}
                value={paraBirimi}
                onChangeText={(v) => setParaBirimi(v.toUpperCase().slice(0, 3))}
                placeholder="Para birimi (USD, TRY, PHP...)"
                placeholderTextColor={RenkTokenlari.textDim}
                autoCapitalize="characters"
              />
              <TextInput
                style={AdminStil.input}
                value={ulkeMin}
                onChangeText={setUlkeMin}
                placeholder="Ülke minimum ödeme (USD)"
                placeholderTextColor={RenkTokenlari.textDim}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={AdminStil.input}
                value={ulkeNotu}
                onChangeText={setUlkeNotu}
                placeholder="Not"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartAlt}>Kanal etkin</Text>
                <Switch value={etkin} onValueChange={setEtkin} />
              </View>
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartAlt}>Otomatik ödeme</Text>
                <Switch value={ulkeOto} onValueChange={setUlkeOto} />
              </View>
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartAlt}>KYC gerekli</Text>
                <Switch value={kyc} onValueChange={setKyc} />
              </View>
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartAlt}>Vergi bilgisi gerekli</Text>
                <Switch value={vergi} onValueChange={setVergi} />
              </View>
              <OnayliButon
                etiket="Ülke kanalını kaydet"
                onOnay={async () => {
                  if (!/^[A-Z]{2}$/.test(ulke)) throw new Error('İki harfli ülke kodu girin');
                  const minUsd = Number(ulkeMin.replace(',', '.'));
                  if (!(minUsd > 0)) throw new Error('Minimum tutar geçersiz');
                  setMesaj(null);
                  await AdminUlkeOdemeYontemiKaydet(ulke, yontem, {
                    provider: saglayici,
                    currency: paraBirimi || 'USD',
                    min_payout_usd: minUsd,
                    is_enabled: etkin,
                    auto_payout: ulkeOto,
                    requires_kyc: kyc,
                    requires_tax_info: vergi,
                    note: ulkeNotu,
                  });
                  await yukle();
                  setMesaj(`${ulke} · ${yontem} kaydedildi.`);
                }}
              />
            </Kart>

            <Text style={AdminStil.sectionLabel}>Banka tatilleri ({tatiller.length})</Text>
            {tatiller.length === 0 ? (
              <Text style={AdminStil.bos}>Tanımlı tatil yok</Text>
            ) : (
              tatiller.map((h) => (
                <View key={h.id ?? `${h.country_code}-${h.holiday_date}`} style={AdminStil.kart}>
                  <Text style={AdminStil.kartAlt}>
                    {h.country_code || 'GLOBAL'} · {Tarih(h.holiday_date)} · {h.name || 'Tatil'}
                  </Text>
                </View>
              ))
            )}
            <Text style={AdminStil.kartAlt}>
              Ödeme günü tatile denk gelirse ödeme sonraki ilk iş gününde başlatılır.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
