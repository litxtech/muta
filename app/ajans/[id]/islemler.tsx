import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../src/contexts/AuthContext';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansCta,
  AjansHint,
  AjansInput,
  AjansKart,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { AjansCoinYukleKarti } from '../../../src/moduller/ajanslar/bilesenler/AjansCoinYukleKarti';
import { useAjansRouteId } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansCoinTransfer,
  AjansPanelDetayGetir,
  AjansUyeOdaKur,
  type AjansPanelDetay,
} from '../../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import { AjansOzelOdaKur } from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import {
  KullanicilariAra,
  type ArananKullanici,
} from '../../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';

function uuidYerel() {
  return `agency-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AjansIslemlerEkrani() {
  const id = useAjansRouteId();
  const { user } = useAuth();
  const [detay, setDetay] = useState<AjansPanelDetay | null>(null);
  const [arama, setArama] = useState('');
  const [sonuclar, setSonuclar] = useState<ArananKullanici[]>([]);
  const [secili, setSecili] = useState<ArananKullanici | null>(null);
  const [coin, setCoin] = useState('');
  const [odaBaslik, setOdaBaslik] = useState('');
  const [odaUyeId, setOdaUyeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setDetay(await AjansPanelDetayGetir(id));
    } catch {
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  useEffect(() => {
    const q = arama.trim();
    if (q.length < 1) {
      setSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void KullanicilariAra({ sorgu: q, haricUserId: user?.id, limit: 12 })
        .then(setSonuclar)
        .catch(() => setSonuclar([]));
    }, 200);
    return () => clearTimeout(t);
  }, [arama, user?.id]);

  const uyeler = detay?.uyeler ?? [];
  const bakiye = detay?.wallet?.distribution_balance ?? 0;
  const coinYetkili = Boolean(detay?.agency.is_coin_distributor);

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="İşlemler"
      subtitle="Coin · oda"
      aktif="islemler"
      yukleniyor={yukleniyor && !detay}
      refreshing={yukleniyor && !!detay}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Coin yükleme</AjansBolumBaslik>
      <AjansCoinYukleKarti
        yetkili={coinYetkili}
        bakiye={bakiye}
        busy={busy}
        arama={arama}
        onArama={(t) => {
          setArama(t);
          setSecili(null);
        }}
        sonuclar={sonuclar}
        secili={secili}
        onSec={(k) => {
          setSecili(k);
          setArama(k.display_name || k.username || '');
          setSonuclar([]);
        }}
        onSecTemizle={() => setSecili(null)}
        coin={coin}
        onCoin={setCoin}
        hizliMiktarlar={[1000, 5000, 10000, 25000]}
        hizliUyeler={uyeler}
        onHizliUye={(u) => {
          setSecili({
            id: u.user_id,
            display_name: u.display_name,
            username: u.username,
            avatar_url: u.avatar_url,
            public_user_id: null,
            is_verified: false,
          });
          setArama(u.display_name || u.username || '');
        }}
        onYukle={() => {
          if (!secili) {
            Alert.alert('Yükleme', 'Kullanıcı seç.');
            return;
          }
          const n = Math.floor(Number(coin));
          if (!Number.isFinite(n) || n <= 0) {
            Alert.alert('Yükleme', 'Geçerli miktar gir.');
            return;
          }
          void (async () => {
            setBusy(true);
            const r = await AjansCoinTransfer({
              agencyId: id,
              toUserId: secili.id,
              coins: n,
              idempotencyKey: uuidYerel(),
            });
            setBusy(false);
            if (!r.ok) Alert.alert('Yükleme', r.hata);
            else {
              Alert.alert('Tamam', 'Coin yüklendi');
              setCoin('');
              setSecili(null);
              await yukle();
            }
          })();
        }}
      />

      <AjansBolumBaslik>Üye için ses odası</AjansBolumBaslik>
      <AjansKart>
        <AjansHint>Oda seçilen üyenin host hesabında açılır.</AjansHint>
        <View style={styles.chipSatir}>
          {uyeler.map((u) => (
            <Pressable
              key={u.user_id}
              style={[styles.chip, odaUyeId === u.user_id && styles.chipAktif]}
              onPress={() => setOdaUyeId(u.user_id)}
            >
              <Text style={styles.chipYazi}>{u.display_name || u.username}</Text>
            </Pressable>
          ))}
        </View>
        <AjansInput value={odaBaslik} onChangeText={setOdaBaslik} placeholder="Oda başlığı" />
        <AjansCta
          label="Ses odası kur"
          onPress={() => {
            if (!odaUyeId) {
              Alert.alert('Oda', 'Üye seç');
              return;
            }
            void (async () => {
              setBusy(true);
              const r = await AjansUyeOdaKur({
                agencyId: id,
                userId: odaUyeId,
                title: odaBaslik.trim() || 'Ajans Odası',
              });
              setBusy(false);
              if (!r.ok) Alert.alert('Oda', r.hata);
              else if (r.room_id) router.push(`/room/${r.room_id}` as any);
            })();
          }}
        />
        <AjansCta
          ghost
          label="Ajans üyelerine özel oda"
          onPress={() => {
            void (async () => {
              const r = await AjansOzelOdaKur({
                agencyId: id,
                title: odaBaslik.trim() || 'Ajans Özel Oda',
                hostId: odaUyeId ?? undefined,
              });
              if (!r.ok) Alert.alert('Oda', r.hata);
              else if (r.room_id) router.push(`/room/${r.room_id}` as any);
            })();
          }}
        />
      </AjansKart>

      <AjansBolumBaslik>Son yüklemeler</AjansBolumBaslik>
      <AjansKart>
        {(detay?.son_transferler ?? []).length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          (detay?.son_transferler ?? []).slice(0, 20).map((t) => (
            <Text key={t.id} style={styles.transfer}>
              {t.to_name} · {t.coins} coin · {new Date(t.created_at).toLocaleString('tr-TR')}
            </Text>
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  chipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipAktif: { borderColor: RenkTokenlari.primarySoft },
  chipYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text },
  transfer: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
});
