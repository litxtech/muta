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
  AjansEtkinlikListesi,
  AjansEtkinlikOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';

export default function AjansEtkinliklerEkrani() {
  const id = useAjansRouteId();
  const [liste, setListe] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setListe(await AjansEtkinlikListesi(id));
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
      title="Etkinlikler"
      subtitle="Ajans etkinlikleri"
      aktif="etkinlikler"
      yukleniyor={yukleniyor && liste.length === 0}
      refreshing={yukleniyor && liste.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Yeni etkinlik</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={title} onChangeText={setTitle} placeholder="Başlık" />
        <AjansInput value={desc} onChangeText={setDesc} placeholder="Açıklama" multiline />
        <AjansCta
          label="SCHEDULED olarak oluştur"
          onPress={() => {
            void (async () => {
              const r = await AjansEtkinlikOlustur({
                agencyId: id,
                title: title.trim() || 'Ajans Etkinliği',
                description: desc,
                startsAt: new Date(Date.now() + 86400000).toISOString(),
                status: 'SCHEDULED',
              });
              if (!r.ok) Alert.alert('Etkinlik', r.hata);
              else {
                setTitle('');
                setDesc('');
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
          liste.map((e) => (
            <AjansListeSatir
              key={String(e.id)}
              title={String(e.title)}
              subtitle={`${e.status} · ${e.kind} · ${new Date(String(e.starts_at)).toLocaleString('tr-TR')}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
