import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../../src/moduller/admin/bilesenler/AdminStil';
import { AdminYayinciOdemeListeleri } from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BatchDurumEtiketi,
  BilgiKutusu,
  Etiket,
  Kart,
  Sayi,
  Tarih,
  TarihSaat,
  Usd,
  YayinciNav,
  durumRengi,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

export default function YayinciOdemelerEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [batches, setBatches] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      setBatches(await AdminYayinciOdemeListeleri());
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setBatches([]);
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

  const onayBekleyen = batches.filter((b) => b.status === 'pending_approval');
  const islemde = batches.filter((b) => b.status === 'approved' || b.status === 'processing');
  const tamamlanan = batches.filter((b) => b.status === 'completed');
  const diger = batches.filter(
    (b) => !['pending_approval', 'approved', 'processing', 'completed'].includes(b.status),
  );

  function Liste({ baslik, items, alt }: { baslik: string; items: any[]; alt?: string }) {
    return (
      <>
        <Text style={AdminStil.sectionLabel}>
          {baslik} ({items.length})
        </Text>
        {alt ? <Text style={AdminStil.kartAlt}>{alt}</Text> : null}
        {items.length === 0 ? (
          <Text style={AdminStil.bos}>Kayıt yok</Text>
        ) : (
          items.map((b) => (
            <Kart
              key={b.id}
              onPress={() => router.push(`/admin/finance/yayinci/odemeler/${b.id}` as any)}
            >
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartBaslik}>
                  {Tarih(b.period_month)} dönemi
                </Text>
                <Etiket metin={BatchDurumEtiketi(b.status)} renk={durumRengi(b.status)} />
              </View>
              <Text style={AdminStil.kartAlt}>
                Ödeme tarihi {Tarih(b.payout_date)} · {Sayi(b.item_count)} kalem · brüt{' '}
                {Usd(b.total_amount_usd)} · kesinti {Usd(b.total_fee_usd)} · net {Usd(b.total_net_usd)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                {b.skipped_count > 0 ? `${Sayi(b.skipped_count)} atlandı · ` : ''}
                oluşturma {TarihSaat(b.created_at)}
                {b.approved_at ? ` · onay ${TarihSaat(b.approved_at)}` : ''}
              </Text>
              {b.note ? <Text style={AdminStil.kartAlt}>Not: {b.note}</Text> : null}
            </Kart>
          ))
        )}
      </>
    );
  }

  return (
    <Screen>
      <EkranBasligi title="Ödeme Listeleri" subtitle="Onay · gönderim · tamamlanan" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <BilgiKutusu
          baslik="Çift ödeme koruması"
          metin="Aynı dönem için aynı anda birden fazla aktif liste oluşturulamaz. Bir kalem 'Ödendi' olarak işaretlenmeden aynı kazanç başka bir listeye alınamaz. Gerçek transferi yapmadan 'Gönderildi' işaretlemeyin."
          tehlike
        />

        <View style={AdminStil.aksiyonSatir}>
          <Pressable
            onPress={() => router.push('/admin/finance/yayinci' as any)}
            style={AdminStil.aksiyon}
          >
            <Text style={AdminStil.aksiyonYazi}>Dönem kapat / liste hazırla</Text>
          </Pressable>
        </View>

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && batches.length === 0 ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : (
          <>
            <Liste
              baslik="Onay bekleyen ödemeler"
              items={onayBekleyen}
              alt="Ana yönetici onayı olmadan hiçbir kalem gönderilemez."
            />
            <Liste baslik="İşlemde" items={islemde} />
            <Liste baslik="Tamamlanan ödemeler" items={tamamlanan} />
            <Liste baslik="Diğer / iptal" items={diger} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
