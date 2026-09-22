import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
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
  AjansGorevListesi,
  AjansGorevOlustur,
  AjansHedefListesi,
  AjansHedefOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';

export default function AjansGorevlerEkrani() {
  const id = useAjansRouteId();
  const [gorevler, setGorevler] = useState<Array<Record<string, unknown>>>([]);
  const [hedefler, setHedefler] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const [g, h] = await Promise.all([
        AjansGorevListesi(id),
        AjansHedefListesi(id).catch(() => []),
      ]);
      setGorevler(g);
      setHedefler(h);
    } catch {
      setGorevler([]);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Görevler"
      subtitle="Görev ve hedefler"
      aktif="gorevler"
      yukleniyor={yukleniyor && gorevler.length === 0}
      refreshing={yukleniyor && gorevler.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Görev oluştur</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={title} onChangeText={setTitle} placeholder="Örn: Bu hafta 3 yayın" />
        <AjansCta
          label="Görev ekle"
          onPress={() => {
            void (async () => {
              const r = await AjansGorevOlustur({
                agencyId: id,
                title: title.trim() || 'Yeni görev',
                verificationType: 'live_count',
                verificationTarget: 3,
              });
              if (!r.ok) Alert.alert('Görev', r.hata);
              else {
                setTitle('');
                await yukle();
              }
            })();
          }}
        />
        <AjansCta
          ghost
          label="100 saat yayın hedefi"
          onPress={() => {
            void (async () => {
              const r = await AjansHedefOlustur({
                agencyId: id,
                title: '100 saat yayın',
                metric: 'live_hours',
                targetValue: 100,
              });
              if (!r.ok) Alert.alert('Hedef', r.hata);
              else await yukle();
            })();
          }}
        />
      </AjansKart>
      <AjansBolumBaslik>Görevler</AjansBolumBaslik>
      <AjansKart>
        {gorevler.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          gorevler.map((g) => (
            <AjansListeSatir
              key={String(g.id)}
              title={String(g.title)}
              subtitle={`${g.status} · ${g.verification_type} · ilerleme ${g.progress}/${g.verification_target}`}
            />
          ))
        )}
      </AjansKart>
      <AjansBolumBaslik>Hedefler</AjansBolumBaslik>
      <AjansKart>
        {hedefler.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          hedefler.map((h) => (
            <AjansListeSatir
              key={String(h.id)}
              title={String(h.title)}
              subtitle={`${h.current_value}/${h.target_value} · %${h.progress_pct}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
