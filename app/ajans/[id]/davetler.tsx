import React, { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansCta,
  AjansHint,
  AjansInput,
  AjansKart,
  AjansListeSatir,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansDavetAnalitik,
  AjansDavetIptal,
  AjansDavetListesi,
  AjansDavetOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';

export default function AjansDavetlerEkrani() {
  const id = useAjansRouteId();
  const [liste, setListe] = useState<Array<Record<string, unknown>>>([]);
  const [analitik, setAnalitik] = useState<Record<string, unknown> | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const [l, a] = await Promise.all([
        AjansDavetListesi(id),
        AjansDavetAnalitik(id).catch(() => null),
      ]);
      setListe(l);
      setAnalitik(a);
    } catch {
      setListe([]);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Davetler"
      subtitle="Kod · QR · analitika"
      aktif="davetler"
      yukleniyor={yukleniyor && liste.length === 0}
      refreshing={yukleniyor && liste.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Yeni davet</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={label} onChangeText={setLabel} placeholder="Etiket (opsiyonel)" />
        <AjansInput
          value={maxUses}
          onChangeText={setMaxUses}
          placeholder="Max kullanım (boş=sınırsız, 1=tek)"
          keyboardType="number-pad"
        />
        <AjansCta
          label="Davet Oluştur"
          onPress={() => {
            void (async () => {
              const n = maxUses.trim() === '' ? null : Math.max(1, Number(maxUses) || 1);
              const r = await AjansDavetOlustur({
                agencyId: id,
                maxUses: n,
                label: label.trim() || undefined,
              });
              if (!r.ok) Alert.alert('Davet', r.hata);
              else {
                Alert.alert('Kod', r.invite_code ?? '');
                await Share.share({
                  message: `Tamuso ajans davet kodu: ${r.invite_code}`,
                }).catch(() => undefined);
                await yukle();
              }
            })();
          }}
        />
        <Text style={styles.hint}>
          QR türleri: AJANS PROFİLİ / BAŞVUR / ETKİNLİK — deep link mevcut navigasyon ile açılır.
        </Text>
      </AjansKart>

      <AjansBolumBaslik>Aktif davetler</AjansBolumBaslik>
      <AjansKart>
        {liste.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          liste.map((d) => (
            <View key={String(d.id)}>
              <AjansListeSatir
                title={String(d.invite_code)}
                subtitle={`${d.status} · ${d.used_count ?? 0}/${d.max_uses ?? '∞'} · ${d.label ?? ''}`}
              />
              <AjansCta
                ghost
                label="İptal"
                onPress={() => {
                  void (async () => {
                    const r = await AjansDavetIptal(String(d.id));
                    if (!r.ok) Alert.alert('Davet', r.hata);
                    else await yukle();
                  })();
                }}
              />
            </View>
          ))
        )}
      </AjansKart>

      <AjansBolumBaslik>Davet analitiği</AjansBolumBaslik>
      <AjansKart>
        {analitik ? (
          <Text style={styles.hint}>
            Toplam olay: {String(analitik.toplam ?? 0)}
            {'\n'}
            Tipler: {JSON.stringify(analitik.by_type ?? {})}
            {'\n'}
            Kaynak: {JSON.stringify(analitik.by_source ?? {})}
          </Text>
        ) : (
          <AjansHint>Henüz veri yok</AjansHint>
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  hint: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
});
