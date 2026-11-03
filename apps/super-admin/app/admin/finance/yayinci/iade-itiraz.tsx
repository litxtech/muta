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
  AdminYayinciIadeIsle,
  AdminYayinciIadeListesi,
  AdminYayinciItirazCoz,
  AdminYayinciItirazListesi,
  AdminYayinciRiskListesi,
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

function IadeAksiyonu({ gift }: { gift: any }) {
  const [acik, setAcik] = useState(false);
  const [not, setNot] = useState('');
  const [mesaj, setMesaj] = useState<string | null>(null);
  const kapali = gift.refund_status !== 'none';

  if (kapali) {
    return <Text style={AdminStil.kartAlt}>İade durumu: {gift.refund_status}</Text>;
  }

  if (!acik) {
    return (
      <Pressable onPress={() => setAcik(true)} style={AdminStil.aksiyon}>
        <Text style={AdminStil.aksiyonYazi}>İade / chargeback işle</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <BilgiKutusu
        baslik="Geri alınabilir kazanç"
        metin="Ödenmemiş kazanç doğrudan geçersiz kılınır. Ödenmiş veya ödeme listesine alınmış kazanç için negatif düzeltme kaydı oluşturulur ve yayıncıya risk kaydı eklenir."
        tehlike
      />
      <TextInput
        style={AdminStil.input}
        value={not}
        onChangeText={setNot}
        placeholder="Gerekçe / sağlayıcı referansı (zorunlu)"
        placeholderTextColor={RenkTokenlari.textDim}
      />
      <View style={AdminStil.aksiyonSatir}>
        <OnayliButon
          etiket="İade"
          tehlike
          onOnay={async () => {
            if (!not.trim()) throw new Error('Gerekçe zorunlu');
            await AdminYayinciIadeIsle(gift.gift_transaction_id, 'refund', not);
            setMesaj('İade işlendi.');
            setAcik(false);
          }}
        />
        <OnayliButon
          etiket="Chargeback"
          tehlike
          onOnay={async () => {
            if (!not.trim()) throw new Error('Gerekçe zorunlu');
            await AdminYayinciIadeIsle(gift.gift_transaction_id, 'chargeback', not);
            setMesaj('Chargeback işlendi.');
            setAcik(false);
          }}
        />
        <Pressable onPress={() => setAcik(false)} style={AdminStil.aksiyon}>
          <Text style={AdminStil.aksiyonYazi}>Vazgeç</Text>
        </Pressable>
      </View>
      {mesaj ? <Text style={{ color: RenkTokenlari.mint, fontSize: 12 }}>{mesaj}</Text> : null}
    </View>
  );
}

function ItirazAksiyonu({ itiraz, onDone }: { itiraz: any; onDone: () => Promise<void> }) {
  const [acik, setAcik] = useState(false);
  const [not, setNot] = useState('');

  if (!acik) {
    return (
      <Pressable onPress={() => setAcik(true)} style={AdminStil.aksiyon}>
        <Text style={AdminStil.aksiyonYazi}>İtirazı sonuçlandır</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <TextInput
        style={AdminStil.input}
        value={not}
        onChangeText={setNot}
        placeholder="Karar notu (zorunlu, kullanıcıya gösterilir)"
        placeholderTextColor={RenkTokenlari.textDim}
      />
      <View style={AdminStil.aksiyonSatir}>
        {(
          [
            ['reviewing', 'İncelemeye al'],
            ['resolved', 'Çözüldü'],
            ['rejected', 'Reddet'],
          ] as const
        ).map(([k, l]) => (
          <OnayliButon
            key={k}
            etiket={l}
            tehlike={k === 'rejected'}
            onOnay={async () => {
              if (!not.trim()) throw new Error('Karar notu zorunlu');
              await AdminYayinciItirazCoz(itiraz.id, k, not);
              setAcik(false);
              await onDone();
            }}
          />
        ))}
        <Pressable onPress={() => setAcik(false)} style={AdminStil.aksiyon}>
          <Text style={AdminStil.aksiyonYazi}>Vazgeç</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function YayinciIadeItirazEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [iadeler, setIadeler] = useState<any[]>([]);
  const [riskler, setRiskler] = useState<any[]>([]);
  const [itirazlar, setItirazlar] = useState<any[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const [i, r, t] = await Promise.all([
        AdminYayinciIadeListesi(),
        AdminYayinciRiskListesi(),
        AdminYayinciItirazListesi(),
      ]);
      setIadeler(i);
      setRiskler(r);
      setItirazlar(t);
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

  const acikItirazlar = itirazlar.filter((t) => t.status === 'open' || t.status === 'reviewing');
  const kapaliItirazlar = itirazlar.filter((t) => !['open', 'reviewing'].includes(t.status));

  return (
    <Screen>
      <EkranBasligi title="İade & İtiraz" subtitle="Risk · chargeback · yayıncı itirazları" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <BilgiKutusu
          baslik="Güvenlik kuralları"
          metin="Kendi hesabına hediye, bağlantılı hesaplarla yapay gelir, oyun coini kaynaklı gelir ve iade edilmiş satın almalar uygun gelir oluşturmaz. Şüpheli işlemler otomatik olarak risk kaydı açar; ödeme, inceleme tamamlanana kadar durdurulabilir."
        />

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && iadeler.length + riskler.length + itirazlar.length === 0 ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : (
          <>
            <Text style={AdminStil.sectionLabel}>İade ve uygunluk sorunları ({iadeler.length})</Text>
            {iadeler.length === 0 ? (
              <Text style={AdminStil.bos}>İade veya uygunluk sorunu yok</Text>
            ) : (
              iadeler.map((g) => (
                <Kart key={g.gift_transaction_id}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{g.creator_name || '—'}</Text>
                    <Etiket
                      metin={g.eligible ? 'Uygun' : 'Uygun değil'}
                      renk={g.eligible ? RenkTokenlari.mint : RenkTokenlari.danger}
                    />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {TarihSaat(g.created_at)} · {Sayi(g.coins)} coin · kaynak {g.coin_source}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Gelir {Usd(g.gross_usd)} · yayıncı payı {Usd(g.creator_usd)} · iade{' '}
                    {g.refund_status} · inceleme {g.review_status}
                  </Text>
                  {g.reason ? <Text style={AdminStil.kartAlt}>Neden: {g.reason}</Text> : null}
                  <IadeAksiyonu gift={g} />
                </Kart>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Riskli işlemler ({riskler.length})</Text>
            {riskler.length === 0 ? (
              <Text style={AdminStil.bos}>Açık risk kaydı yok</Text>
            ) : (
              riskler.map((r) => (
                <Kart key={r.id}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{r.user_name || '—'}</Text>
                    <Etiket
                      metin={`${r.severity} · ${r.status}`}
                      renk={durumRengi(r.status === 'open' ? 'on_hold' : 'paid')}
                    />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {TarihSaat(r.created_at)} · tür {r.kind}
                  </Text>
                  {r.details ? (
                    <Text style={AdminStil.kartAlt} numberOfLines={4}>
                      {JSON.stringify(r.details)}
                    </Text>
                  ) : null}
                </Kart>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Açık itirazlar ({acikItirazlar.length})</Text>
            {acikItirazlar.length === 0 ? (
              <Text style={AdminStil.bos}>Açık itiraz yok</Text>
            ) : (
              acikItirazlar.map((t) => (
                <Kart key={t.id}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{t.subject}</Text>
                    <Etiket metin={t.status} renk={durumRengi(t.status === 'open' ? 'pending' : 'approved')} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {t.user_name || '—'} · {t.kind} · {TarihSaat(t.created_at)}
                  </Text>
                  <Text style={AdminStil.kartAlt}>{t.body}</Text>
                  <ItirazAksiyonu itiraz={t} onDone={yukle} />
                </Kart>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Sonuçlanan itirazlar ({kapaliItirazlar.length})</Text>
            {kapaliItirazlar.length === 0 ? (
              <Text style={AdminStil.bos}>Kayıt yok</Text>
            ) : (
              kapaliItirazlar.map((t) => (
                <View key={t.id} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{t.subject}</Text>
                    <Etiket metin={t.status} renk={durumRengi(t.status === 'resolved' ? 'paid' : 'cancelled')} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {t.user_name || '—'} · {TarihSaat(t.resolved_at)}
                  </Text>
                  {t.resolution_note ? (
                    <Text style={AdminStil.kartAlt}>Karar: {t.resolution_note}</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
