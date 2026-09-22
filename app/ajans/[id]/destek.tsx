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
  AjansDestekListesi,
  AjansDestekOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';

export default function AjansDestekEkrani() {
  const id = useAjansRouteId();
  const [liste, setListe] = useState<Array<Record<string, unknown>>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setListe(await AjansDestekListesi(id));
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
      title="Destek"
      subtitle="Ajans destek talepleri"
      aktif="destek"
      yukleniyor={yukleniyor && liste.length === 0}
      refreshing={yukleniyor && liste.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Yeni talep</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={subject} onChangeText={setSubject} placeholder="Konu" />
        <AjansInput value={body} onChangeText={setBody} placeholder="Açıklama" multiline />
        <AjansCta
          label="Gönder"
          onPress={() => {
            void (async () => {
              const r = await AjansDestekOlustur({
                agencyId: id,
                subject: subject.trim(),
                body: body.trim(),
              });
              if (!r.ok) Alert.alert('Destek', r.hata);
              else {
                setSubject('');
                setBody('');
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
          liste.map((t) => (
            <AjansListeSatir
              key={String(t.id)}
              title={String(t.subject)}
              subtitle={`${t.status} · ${t.creator_name ?? ''} · ${new Date(String(t.created_at)).toLocaleString('tr-TR')}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
