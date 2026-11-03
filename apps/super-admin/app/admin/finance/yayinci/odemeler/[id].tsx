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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminYayinciOdemeBatchIptal,
  AdminYayinciOdemeBatchOnayla,
  AdminYayinciOdemeListesiDetay,
  AdminYayinciOdemeOgeIsle,
} from '../../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BatchDurumEtiketi,
  BilgiKutusu,
  Etiket,
  Kart,
  OdemeTalimati,
  OgeDurumEtiketi,
  OnayliButon,
  Sayi,
  Tarih,
  TarihSaat,
  Usd,
  YayinciNav,
  durumRengi,
} from '../../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../../src/tasarim-sistemi/RenkTokenlari';

function KalemAksiyonlari({ item, onDone }: { item: any; onDone: () => Promise<void> }) {
  const [acik, setAcik] = useState(false);
  const [referans, setReferans] = useState('');
  const [not, setNot] = useState('');

  if (!acik) {
    return (
      <Pressable onPress={() => setAcik(true)} style={AdminStil.aksiyon}>
        <Text style={AdminStil.aksiyonYazi}>İşlem yap</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <TextInput
        style={AdminStil.input}
        value={referans}
        onChangeText={setReferans}
        placeholder="Banka / sağlayıcı işlem referansı"
        placeholderTextColor={RenkTokenlari.textDim}
        autoCapitalize="characters"
      />
      <TextInput
        style={AdminStil.input}
        value={not}
        onChangeText={setNot}
        placeholder="Not (başarısız işlemde zorunlu)"
        placeholderTextColor={RenkTokenlari.textDim}
      />
      <Text style={AdminStil.kartAlt}>
        Mevcut durum: {OgeDurumEtiketi(item.status)} · talep durumu: {item.request_status ?? '—'}
      </Text>
      <View style={AdminStil.aksiyonSatir}>
        <OnayliButon
          etiket="Gönderildi"
          onOnay={async () => {
            if (!referans.trim()) throw new Error('Referans zorunlu');
            await AdminYayinciOdemeOgeIsle(item.id, 'sent', referans, not);
            setAcik(false);
            await onDone();
          }}
        />
        <OnayliButon
          etiket="Ödendi"
          onOnay={async () => {
            if (!referans.trim()) throw new Error('Referans zorunlu');
            await AdminYayinciOdemeOgeIsle(item.id, 'completed', referans, not);
            setAcik(false);
            await onDone();
          }}
        />
        <OnayliButon
          etiket="Başarısız"
          tehlike
          onOnay={async () => {
            if (!not.trim()) throw new Error('Başarısızlık nedeni zorunlu');
            await AdminYayinciOdemeOgeIsle(item.id, 'failed', referans, not);
            setAcik(false);
            await onDone();
          }}
        />
        <Pressable onPress={() => setAcik(false)} style={AdminStil.aksiyon}>
          <Text style={AdminStil.aksiyonYazi}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function YayinciOdemeListesiDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [veri, setVeri] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [notu, setNotu] = useState('');
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    setHata(null);
    try {
      setVeri(await AdminYayinciOdemeListesiDetay(String(id)));
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setVeri(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

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

  const b = veri?.batch;
  const items: any[] = veri?.items ?? [];
  const approvals: any[] = veri?.approvals ?? [];
  const duzenlenebilir = b?.status === 'pending_approval';

  return (
    <Screen>
      <EkranBasligi
        title={b ? `${Tarih(b.period_month)} ödeme listesi` : 'Ödeme listesi'}
        subtitle={b ? `${BatchDurumEtiketi(b.status)} · ${Sayi(b.item_count)} kalem` : 'Yükleniyor'}
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !veri ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !b ? (
          <Text style={AdminStil.bos}>Kayıt bulunamadı</Text>
        ) : (
          <>
            <Kart>
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartBaslik}>{Tarih(b.period_month)} dönemi</Text>
                <Etiket metin={BatchDurumEtiketi(b.status)} renk={durumRengi(b.status)} />
              </View>
              <Text style={AdminStil.kartAlt}>
                Ödeme tarihi {Tarih(b.payout_date)} · mod {b.mode} · para birimi {b.currency}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Brüt {Usd(b.total_amount_usd)} · kesinti {Usd(b.total_fee_usd)} · net{' '}
                {Usd(b.total_net_usd)} · atlanan {Sayi(b.skipped_count)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Oluşturma {TarihSaat(b.created_at)}
                {b.approved_at ? ` · onay ${TarihSaat(b.approved_at)}` : ''}
                {b.processed_at ? ` · gönderim ${TarihSaat(b.processed_at)}` : ''}
                {b.completed_at ? ` · tamamlanma ${TarihSaat(b.completed_at)}` : ''}
              </Text>
              {b.note ? <Text style={AdminStil.kartAlt}>Not: {b.note}</Text> : null}
            </Kart>

            {duzenlenebilir ? (
              <Kart
                baslik="Parti onayı"
                alt="Onay, kalemleri ödeme için kilitler. Bu adım gerçek transfer başlatmaz; transfer manuel yapılır ve referansla işaretlenir."
              >
                <TextInput
                  style={AdminStil.input}
                  value={notu}
                  onChangeText={setNotu}
                  placeholder="Onay notu (opsiyonel)"
                  placeholderTextColor={RenkTokenlari.textDim}
                />
                <View style={AdminStil.aksiyonSatir}>
                  <OnayliButon
                    etiket="Partiyi onayla"
                    onOnay={async () => {
                      setMesaj(null);
                      await AdminYayinciOdemeBatchOnayla(b.id, notu);
                      setMesaj('Parti onaylandı. Kalemleri gerçek transfer sonrası işaretleyin.');
                      await yukle();
                    }}
                  />
                  <OnayliButon
                    etiket="Partiyi iptal et"
                    tehlike
                    disabled={!notu.trim()}
                    onOnay={async () => {
                      if (!notu.trim()) throw new Error('İptal için gerekçe zorunlu');
                      setMesaj(null);
                      await AdminYayinciOdemeBatchIptal(b.id, notu);
                      setMesaj('Parti iptal edildi; kazançlar yeniden ödemeye hazır durumuna döndü.');
                      await yukle();
                    }}
                  />
                </View>
                {!notu.trim() ? (
                  <Text style={AdminStil.kartAlt}>İptal için gerekçe yazmanız gerekir.</Text>
                ) : null}
                {mesaj ? (
                  <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{mesaj}</Text>
                ) : null}
              </Kart>
            ) : null}

            <BilgiKutusu
              baslik="Kalem işlem sırası"
              metin="Onaylı kalem → Gönderildi (referans zorunlu) → Ödendi. Başarısız işlemde kazanç tekrar ödemeye hazır hâle gelir ve not zorunludur. Tüm işlemler finans denetim kaydına yazılır."
            />

            <Text style={AdminStil.sectionLabel}>Kalemler ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={AdminStil.bos}>Kalem yok</Text>
            ) : (
              items.map((i) => (
                <Kart key={i.id}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{i.creator_name || '—'}</Text>
                    <Etiket metin={OgeDurumEtiketi(i.status)} renk={durumRengi(i.status)} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {i.country_code || '—'} · {i.currency} · {i.scheme || 'iban'}{' '}
                    {i.iban_masked ? `· ${i.iban_masked}` : ''}
                  </Text>
                  {i.details_masked && Object.keys(i.details_masked).length > 0 ? (
                    <Text style={AdminStil.kartAlt}>
                      {Object.entries(i.details_masked as Record<string, string>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </Text>
                  ) : null}
                  <Text style={AdminStil.kartAlt}>
                    Tutar {Usd(i.amount_usd)} · kesinti {Usd(i.fee_usd)} · net {Usd(i.net_usd)}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    {i.external_reference ? `Referans ${i.external_reference} · ` : ''}
                    {i.sent_at ? `gönderim ${TarihSaat(i.sent_at)} · ` : ''}
                    {i.paid_at ? `ödeme ${TarihSaat(i.paid_at)}` : ''}
                  </Text>
                  <OdemeTalimati accountId={i.payout_account_id} kompakt />
                  <KalemAksiyonlari item={i} onDone={yukle} />
                </Kart>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Onay kayıtları ({approvals.length})</Text>
            {approvals.length === 0 ? (
              <Text style={AdminStil.bos}>Henüz onay kaydı yok</Text>
            ) : (
              approvals.map((a) => (
                <View key={a.id} style={AdminStil.kart}>
                  <Text style={AdminStil.kartAlt}>
                    {TarihSaat(a.created_at)} · {a.action} · {Usd(a.amount_usd)}
                  </Text>
                  {a.note ? <Text style={AdminStil.kartAlt}>Not: {a.note}</Text> : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
