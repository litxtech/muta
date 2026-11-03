import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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
  AdminYayinciDonemKapat,
  AdminYayinciFinansOzetGetir,
  AdminYayinciKazancAylik,
  AdminYayinciKazancGunluk,
  AdminYayinciListesi,
  AdminYayinciOdemeListesiHazirla,
  AdminYayinciOnaySayilari,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import type {
  YayinciFinansOzet,
  YayinciOnaySayilari,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BilgiKutusu,
  Etiket,
  Kart,
  OnayliButon,
  Sayi,
  Tarih,
  Usd,
  YayinciNav,
  Yuzde,
  durumRengi,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { FinanceKpiKart } from '../../../../../../src/moduller/admin/finance/bilesenler/FinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

function ayBas(offset = 0): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 10);
}

export default function YayinciFinansOzetEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [ozet, setOzet] = useState<YayinciFinansOzet | null>(null);
  const [onay, setOnay] = useState<YayinciOnaySayilari | null>(null);
  const [yayincilar, setYayincilar] = useState<any[]>([]);
  const [gunluk, setGunluk] = useState<any[]>([]);
  const [aylik, setAylik] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [ay, setAy] = useState(ayBas(-1));
  const [donemNotu, setDonemNotu] = useState('');
  const [islemMesaji, setIslemMesaji] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const [o, y, g, a, onaySayilari] = await Promise.all([
        AdminYayinciFinansOzetGetir(),
        AdminYayinciListesi(30, 0),
        AdminYayinciKazancGunluk(),
        AdminYayinciKazancAylik(12),
        AdminYayinciOnaySayilari().catch(() => null),
      ]);
      setOzet(o);
      setYayincilar(y);
      setGunluk(g.slice(0, 14));
      setAylik(a);
      setOnay(onaySayilari);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setYukleniyor(false);
    }
  }, []);

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

  const o = ozet;

  return (
    <Screen>
      <EkranBasligi title="Yayıncı Kazançları" subtitle="Creator finance · USD · aylık ödeme" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <View style={AdminStil.hero}>
          <Text style={AdminStil.heroEyebrow}>TAMUSO · CREATOR FINANCE</Text>
          <Text style={AdminStil.heroTitle}>Yayıncı kazanç merkezi</Text>
          <Text style={AdminStil.heroAlt}>
            Tüm tutarlar sunucudaki defterden gelir. Gelir paylaşımı {Yuzde(o?.creator_share)} yayıncı /{' '}
            {Yuzde(o?.platform_share)} platform. Minimum ödeme {Usd(o?.payout_min_usd)} · ödeme günü her ayın{' '}
            {o?.payout_day ?? 15}'i.
          </Text>
          {o?.next_payout_date ? (
            <Text style={{ color: RenkTokenlari.textMuted, fontSize: 12 }}>
              Sonraki ödeme: {Tarih(o.next_payout_date)} · Dönem: {Tarih(o.current_period_start)} –{' '}
              {Tarih(o.current_period_end)}
            </Text>
          ) : null}
        </View>

        <BilgiKutusu
          baslik="Manuel ödeme akışı"
          metin="Sistem gerçek banka transferi başlatmaz. Ödeme listesi onaylandıktan sonra her kalem, gerçek banka/ödeme sağlayıcı referansı girilerek 'Gönderildi' ve ardından 'Ödendi' olarak işaretlenir. Otomatik transfer, sağlayıcı ve hukuki kontroller tamamlanana kadar kapalıdır."
        />

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !ozet ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : (
          <>
            <Text style={AdminStil.sectionLabel}>Ana göstergeler</Text>
            <View style={AdminStil.kpiGrid}>
              <FinanceKpiKart
                label="Uygun hediye geliri"
                value={Usd(o?.total_gift_revenue_usd)}
                hint="Doğrulanmış dağıtılabilir gelir"
              />
              <FinanceKpiKart
                label="Yayıncı kazancı"
                value={Usd(o?.creator_earnings_usd)}
                tone="positive"
                hint={`Platform payı ${Usd(o?.platform_share_usd)}`}
              />
              <FinanceKpiKart
                label="Bekleyen kazanç"
                value={Usd(o?.pending_usd)}
                tone="warning"
                onPress={() => router.push('/admin/finance/yayinci/bekleyen' as any)}
              />
              <FinanceKpiKart
                label="Onay bekleyen ödeme"
                value={Sayi(onay?.onay_bekleyen_toplam ?? 0)}
                tone={(onay?.onay_bekleyen_toplam ?? 0) > 0 ? 'warning' : 'default'}
                hint={`${Sayi(onay?.profil ?? 0)} profil · ${Sayi(onay?.belge ?? 0)} belge · ${Sayi(
                  onay?.hesap ?? 0,
                )} hesap`}
                onPress={() => router.push('/admin/finance/yayinci/onaylar' as any)}
              />
              <FinanceKpiKart
                label="Ödemeye hazır"
                value={Usd(o?.available_usd)}
                tone="positive"
                hint="Dönem kapanışını bekliyor"
              />
              <FinanceKpiKart
                label="İncelemede"
                value={Usd(o?.on_hold_usd)}
                tone="warning"
                onPress={() => router.push('/admin/finance/yayinci/iade-itiraz' as any)}
              />
              <FinanceKpiKart
                label="Ödeme işleminde"
                value={Usd(o?.in_payout_usd)}
                onPress={() => router.push('/admin/finance/yayinci/odemeler' as any)}
              />
              <FinanceKpiKart
                label="Ödenmiş tutar"
                value={Usd(o?.paid_usd)}
                tone="positive"
                onPress={() => router.push('/admin/finance/yayinci/odemeler' as any)}
              />
              <FinanceKpiKart
                label="Bu ay yayıncı payı"
                value={Usd(o?.this_month_creator_usd)}
                hint={`${Sayi(o?.this_month_gift_count)} uygun hediye`}
              />
              <FinanceKpiKart
                label="Ödeme bekleyen yayıncı"
                value={Sayi(o?.creators_waiting)}
                tone="warning"
                hint={`${Sayi(o?.creators_above_min)} yayıncı minimum eşiği geçti`}
              />
              <FinanceKpiKart
                label="Açık risk / itiraz"
                value={`${Sayi(o?.open_risk_flags)} / ${Sayi(o?.open_disputes)}`}
                tone={(o?.open_risk_flags ?? 0) + (o?.open_disputes ?? 0) > 0 ? 'negative' : 'default'}
                hint={`Onay bekleyen liste: ${Sayi(o?.pending_batches)}`}
                onPress={() => router.push('/admin/finance/yayinci/iade-itiraz' as any)}
              />
            </View>

            <Text style={AdminStil.sectionLabel}>Dönem işlemleri</Text>
            <Kart
              baslik="Aylık kapanış ve ödeme listesi"
              alt="Dönem kapanışı geçmiş kayıtları değiştirmez; yalnızca dönem özetini kilitler. Ödeme listesi minimum eşiği, KYC ve risk kontrollerini sunucuda uygular."
            >
              <TextInput
                style={AdminStil.input}
                value={ay}
                onChangeText={setAy}
                placeholder="YYYY-MM-01"
                placeholderTextColor={RenkTokenlari.textDim}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[0, -1, -2].map((off) => (
                  <Etiket
                    key={off}
                    metin={ayBas(off).slice(0, 7)}
                    renk={ay === ayBas(off) ? RenkTokenlari.primarySoft : undefined}
                  />
                ))}
              </View>
              <TextInput
                style={AdminStil.input}
                value={donemNotu}
                onChangeText={setDonemNotu}
                placeholder="İşlem notu (denetim kaydına yazılır)"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <OnayliButon
                  etiket="Dönemi kapat"
                  onOnay={async () => {
                    setIslemMesaji(null);
                    await AdminYayinciDonemKapat(ay);
                    setIslemMesaji(`${ay.slice(0, 7)} dönemi kapatıldı.`);
                    await yukle();
                  }}
                />
                <OnayliButon
                  etiket="Ödeme listesi hazırla"
                  onOnay={async () => {
                    setIslemMesaji(null);
                    await AdminYayinciOdemeListesiHazirla(ay, donemNotu);
                    setIslemMesaji(
                      `${ay.slice(0, 7)} için ödeme listesi oluşturuldu. Onay bekleyen ödemeler ekranından inceleyin.`,
                    );
                    await yukle();
                  }}
                />
              </View>
              {islemMesaji ? (
                <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{islemMesaji}</Text>
              ) : null}
            </Kart>

            <Text style={AdminStil.sectionLabel}>Yayıncılar · kazanç sıralaması</Text>
            {yayincilar.length === 0 ? (
              <Text style={AdminStil.bos}>Henüz kazanç kaydı olan yayıncı yok</Text>
            ) : (
              yayincilar.map((y) => (
                <Kart
                  key={y.user_id}
                  onPress={() => router.push(`/admin/finance/yayinci/${y.user_id}` as any)}
                >
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{y.display_name || y.username || '—'}</Text>
                    <Etiket
                      metin={y.min_reached ? 'Minimum geçildi' : 'Eşik altı'}
                      renk={y.min_reached ? RenkTokenlari.mint : RenkTokenlari.accent}
                    />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {y.country_code || '—'} · program {y.program_status} · KYC {y.kyc_status} · hesap{' '}
                    {y.payout_account_status} · vergi {y.tax_status}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Ödemeye hazır {Usd(y.available_usd)} · bekleyen {Usd(y.pending_usd)} · incelemede{' '}
                    {Usd(y.on_hold_usd)} · ödenmiş {Usd(y.paid_usd)}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Toplam uygun gelir {Usd(y.lifetime_gross_usd)} · yayıncı payı{' '}
                    {Usd(y.lifetime_creator_usd)}
                    {y.open_flags > 0 ? ` · ${y.open_flags} açık risk` : ''}
                  </Text>
                </Kart>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Günlük kazançlar</Text>
            {gunluk.length === 0 ? (
              <Text style={AdminStil.bos}>Kayıt yok</Text>
            ) : (
              gunluk.map((g) => (
                <View key={String(g.day)} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{Tarih(g.day)}</Text>
                    <Text style={[AdminStil.kartBaslik, { color: RenkTokenlari.mint }]}>
                      {Usd(g.creator_usd)}
                    </Text>
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {Sayi(g.gift_count)} hediye · {Sayi(g.coins)} coin · gelir {Usd(g.gift_revenue_usd)} ·
                    platform {Usd(g.platform_usd)} · {Sayi(g.eligible_creator_count)} yayıncı
                  </Text>
                </View>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Aylık kazançlar</Text>
            {aylik.length === 0 ? (
              <Text style={AdminStil.bos}>Kayıt yok</Text>
            ) : (
              aylik.map((a) => (
                <View key={String(a.month_start)} style={AdminStil.kart}>
                  <Text style={AdminStil.kartBaslik}>{Tarih(a.month_start)}</Text>
                  <Text style={AdminStil.kartAlt}>
                    {Sayi(a.gift_count)} hediye · {Sayi(a.creator_count)} yayıncı · gelir{' '}
                    {Usd(a.gift_revenue_usd)}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Yayıncı {Usd(a.creator_usd)} · platform {Usd(a.platform_usd)}
                  </Text>
                </View>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Durum renkleri</Text>
            <Text style={[AdminStil.kartAlt, { color: durumRengi('paid') }]}>
              Ödendi / tamamlandı · yeşil
            </Text>
            <Text style={[AdminStil.kartAlt, { color: durumRengi('pending') }]}>
              Bekleyen / incelemede · amber
            </Text>
            <Text style={[AdminStil.kartAlt, { color: durumRengi('cancelled') }]}>
              İptal / red · kırmızı
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
