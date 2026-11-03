import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import { AdminYayinciRapor } from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import { AdminFinanceReportCreate } from '../../../../../../src/moduller/admin/finance/AdminFinanceApi';
import {
  BatchDurumEtiketi,
  BilgiKutusu,
  Etiket,
  Kart,
  OnayliButon,
  Sayi,
  Tarih,
  TarihSaat,
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

function kanalAdi(k: string): string {
  switch (k) {
    case 'live':
      return 'Canlı yayın';
    case 'voice':
      return 'Sesli oda';
    case 'post':
      return 'Gönderi';
    case 'message':
      return 'Mesaj';
    case 'call':
      return 'Arama';
    default:
      return k;
  }
}

export default function YayinciFinansRaporEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [ay, setAy] = useState(ayBas(-1));
  const [veri, setVeri] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      setVeri(await AdminYayinciRapor(ay));
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setVeri(null);
    } finally {
      setYukleniyor(false);
    }
  }, [ay]);

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

  const kanallar: Record<string, number> = veri?.channels ?? {};
  const batches: any[] = veri?.batches ?? [];

  return (
    <Screen>
      <EkranBasligi title="Finans Raporu" subtitle="Aylık yayıncı mutabakatı" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TextInput
            style={[AdminStil.input, { flex: 1, minWidth: 160 }]}
            value={ay}
            onChangeText={setAy}
            placeholder="YYYY-MM-01"
            placeholderTextColor={RenkTokenlari.textDim}
            autoCapitalize="none"
          />
          <Pressable onPress={() => void yukle()} style={AdminStil.aksiyon}>
            <Text style={AdminStil.aksiyonYazi}>Getir</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0, -1, -2].map((off) => (
            <Pressable key={off} onPress={() => setAy(ayBas(off))} style={AdminStil.aksiyon}>
              <Text style={AdminStil.aksiyonYazi}>{ayBas(off).slice(0, 7)}</Text>
            </Pressable>
          ))}
        </View>

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !veri ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !veri ? (
          <Text style={AdminStil.bos}>Rapor verisi yok</Text>
        ) : (
          <>
            <Kart
              baslik={`${Tarih(veri.period_start)} – ${Tarih(veri.period_end)}`}
              alt={`Oluşturma ${TarihSaat(veri.generated_at)} · ${Sayi(veri.entry_count)} kazanç kaydı`}
            >
              <Text style={AdminStil.kartAlt}>
                {Sayi(veri.gift_count)} hediye · {Sayi(veri.eligible_gift_count)} uygun ·{' '}
                {Sayi(veri.ineligible_gift_count)} uygun değil · {Sayi(veri.coins)} coin
              </Text>
            </Kart>

            <View style={AdminStil.kpiGrid}>
              <FinanceKpiKart label="Hediye geliri" value={Usd(veri.gift_revenue_usd)} />
              <FinanceKpiKart
                label="Yayıncı payı"
                value={Usd(veri.creator_usd)}
                tone="positive"
              />
              <FinanceKpiKart label="Platform payı" value={Usd(veri.platform_usd)} />
              <FinanceKpiKart label="Ajans payı" value={Usd(veri.agency_usd)} hint="Yayıncı payından düşülmez" />
              <FinanceKpiKart
                label="İncelemede"
                value={Usd(veri.on_hold_usd)}
                tone="warning"
              />
              <FinanceKpiKart
                label="İade / chargeback"
                value={`${Sayi(veri.refunded_count)} / ${Sayi(veri.chargeback_count)}`}
                tone={veri.chargeback_count > 0 ? 'negative' : 'default'}
              />
            </View>

            <Text style={AdminStil.sectionLabel}>Kanal dağılımı</Text>
            {Object.keys(kanallar).length === 0 ? (
              <Text style={AdminStil.bos}>Bu dönemde uygun gelir yok</Text>
            ) : (
              Object.entries(kanallar).map(([k, v]) => (
                <View key={k} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{kanalAdi(k)}</Text>
                    <Text style={[AdminStil.kartBaslik, { color: RenkTokenlari.mint }]}>
                      {Usd(Number(v))}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Dönem ödeme listeleri ({batches.length})</Text>
            {batches.length === 0 ? (
              <Text style={AdminStil.bos}>Bu dönem için liste oluşturulmamış</Text>
            ) : (
              batches.map((b) => (
                <Kart
                  key={b.id}
                  onPress={() => router.push(`/admin/finance/yayinci/odemeler/${b.id}` as any)}
                >
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>
                      {Sayi(b.item_count)} kalem · {Usd(b.total_net_usd)}
                    </Text>
                    <Etiket metin={BatchDurumEtiketi(b.status)} renk={durumRengi(b.status)} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    Ödeme tarihi {Tarih(b.payout_date)} · brüt {Usd(b.total_amount_usd)}
                  </Text>
                </Kart>
              ))
            )}

            <BilgiKutusu
              baslik="Rapor arşivi"
              metin={`Yayıncı kazanç raporları finans raporları arşivinde PDF olarak saklanır. Gelir paylaşımı ${Yuzde(0.4)} yayıncı / ${Yuzde(0.6)} platform. Rapor oluşturma, dönem verilerini değiştirmez.`}
            />
            <OnayliButon
              etiket={`${ay.slice(0, 7)} için finans raporu oluştur`}
              onOnay={async () => {
                setMesaj(null);
                await AdminFinanceReportCreate('CREATOR_EARNINGS', { month: ay });
                setMesaj('Rapor isteği oluşturuldu. Raporlar ekranından indirebilirsiniz.');
              }}
            />
            {mesaj ? <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{mesaj}</Text> : null}
            <Pressable
              onPress={() => router.push('/admin/finance/reports' as any)}
              style={AdminStil.aksiyon}
            >
              <Text style={AdminStil.aksiyonYazi}>Rapor arşivini aç</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
