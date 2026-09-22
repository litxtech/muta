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
  AjansProgramListesi,
  AjansProgramOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';

export default function AjansProgramEkrani() {
  const id = useAjansRouteId();
  const [liste, setListe] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setListe(await AjansProgramListesi(id));
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
      title="Program"
      subtitle="Yayın ve oda takvimi"
      aktif="program"
      yukleniyor={yukleniyor && liste.length === 0}
      refreshing={yukleniyor && liste.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Yeni program</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={title} onChangeText={setTitle} placeholder="Başlık" />
        <AjansCta
          label="1 saat sonra canlı planla"
          onPress={() => {
            void (async () => {
              const starts = new Date(Date.now() + 3600000).toISOString();
              const r = await AjansProgramOlustur({
                agencyId: id,
                title: title.trim() || 'Planlanan yayın',
                kind: 'live',
                startsAt: starts,
              });
              if (!r.ok) Alert.alert('Program', r.hata);
              else {
                setTitle('');
                await yukle();
              }
            })();
          }}
        />
      </AjansKart>
      <AjansKart>
        {liste.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          liste.map((p) => (
            <AjansListeSatir
              key={String(p.id)}
              title={String(p.title)}
              subtitle={`${p.kind} · ${p.status} · ${new Date(String(p.starts_at)).toLocaleString('tr-TR')} · ${p.host_name ?? ''}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
