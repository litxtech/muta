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
import {
  AdminYayinciBekleyen,
  AdminYayinciKazancDuzelt,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BilgiKutusu,
  Etiket,
  Kart,
  OnayliButon,
  Sayi,
  TarihSaat,
  Usd,
  YayinciNav,
  durumRengi,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

const FILTRELER = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'on_hold', label: 'İncelemede' },
  { key: 'available', label: 'Ödemeye Hazır' },
  { key: 'in_payout', label: 'Ödeme İşleminde' },
] as const;

function DuzeltmeFormu({ creatorId }: { creatorId: string }) {
  const [acik, setAcik] = useState(false);
  const [tutar, setTutar] = useState('');
  const [tur, setTur] = useState<'correction' | 'fee' | 'dispute'>('correction');
  const [gerekce, setGerekce] = useState('');
  const [mesaj, setMesaj] = useState<string | null>(null);

  if (!acik) {
    return (
      <Pressable onPress={() => setAcik(true)} style={AdminStil.aksiyon}>
        <Text style={AdminStil.aksiyonYazi}>Kazanç düzeltmesi</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <BilgiKutusu
        baslik="Ters kayıt"
        metin="Düzeltmeler geçmiş kaydı silmez; gerekçeli bir muhasebe hareketi olarak eklenir ve denetim kaydına yazılır. Negatif tutar düşüm, pozitif tutar ekleme anlamına gelir."
      />
      <TextInput
        style={AdminStil.input}
        value={tutar}
        onChangeText={setTutar}
        placeholder="Tutar (USD, örn. -4.20)"
        placeholderTextColor={RenkTokenlari.textDim}
        keyboardType="decimal-pad"
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['correction', 'Düzeltme'],
            ['fee', 'Kesinti'],
            ['dispute', 'İtiraz'],
          ] as const
        ).map(([k, l]) => (
          <Pressable
            key={k}
            onPress={() => setTur(k)}
            style={[AdminStil.aksiyon, tur === k && { borderColor: RenkTokenlari.borderAccent }]}
          >
            <Text style={AdminStil.aksiyonYazi}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={AdminStil.input}
        value={gerekce}
        onChangeText={setGerekce}
        placeholder="Gerekçe (zorunlu)"
        placeholderTextColor={RenkTokenlari.textDim}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <OnayliButon
          etiket="Düzeltmeyi kaydet"
          onOnay={async () => {
            const amount = Number(tutar.replace(',', '.'));
            if (!Number.isFinite(amount) || amount === 0) throw new Error('Geçerli bir tutar girin');
            if (!gerekce.trim()) throw new Error('Gerekçe zorunlu');
            await AdminYayinciKazancDuzelt({
              creatorId,
              amountUsd: amount,
              kind: tur,
              reason: gerekce,
            });
            setMesaj('Düzeltme kaydedildi (ters kayıt).');
            setTutar('');
            setGerekce('');
          }}
        />
        <Pressable onPress={() => setAcik(false)} style={AdminStil.aksiyon}>
          <Text style={AdminStil.aksiyonYazi}>Kapat</Text>
        </Pressable>
      </View>
      {mesaj ? (
        <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{mesaj}</Text>
      ) : null}
    </View>
  );
}

export default function YayinciBekleyenEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [items, setItems] = useState<any[]>([]);
  const [filtre, setFiltre] = useState<string>('all');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      setItems(await AdminYayinciBekleyen(200));
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setItems([]);
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

  const gorunen = filtre === 'all' ? items : items.filter((i) => i.status === filtre);

  return (
    <Screen>
      <EkranBasligi title="Bekleyen Gelirler" subtitle="Doğrulama · inceleme · ödemeye hazır" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <BilgiKutusu
          baslik="Durum kuralları"
          metin="Bekleyen: satın alma doğrulaması sürüyor. İncelemede: iade/itiraz/güvenlik kontrolü. Ödemeye hazır: dönem kapanışına girebilir. Ödeme işleminde: bir ödeme listesine alınmış. Bu ekran yalnızca okuma ve gerekçeli düzeltme yapar."
        />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {FILTRELER.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFiltre(f.key)}
              style={[AdminStil.aksiyon, filtre === f.key && { borderColor: RenkTokenlari.borderAccent }]}
            >
              <Text style={AdminStil.aksiyonYazi}>
                {f.label} ({f.key === 'all' ? items.length : items.filter((i) => i.status === f.key).length})
              </Text>
            </Pressable>
          ))}
        </View>

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && items.length === 0 ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : gorunen.length === 0 ? (
          <Text style={AdminStil.bos}>Bu filtrede kayıt yok</Text>
        ) : (
          gorunen.map((i) => (
            <Kart key={i.id}>
              <View style={AdminStil.satir}>
                <Text style={AdminStil.kartBaslik}>{i.creator_name || '—'}</Text>
                <Etiket metin={i.status} renk={durumRengi(i.status)} />
              </View>
              <Text style={AdminStil.kartAlt}>
                {TarihSaat(i.created_at)} · {Sayi(i.coins)} coin · kaynak {i.coin_source} · kanal{' '}
                {i.channel}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Gelir {Usd(i.gross_usd)} · yayıncı payı {Usd(i.creator_usd)} · net {Usd(i.net_usd)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Dönem {i.period_start ? String(i.period_start) : '—'}
                {i.hold_reason ? ` · bekleme nedeni: ${i.hold_reason}` : ''}
              </Text>
              <DuzeltmeFormu creatorId={i.creator_id} />
            </Kart>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
