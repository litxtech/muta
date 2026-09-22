import React, { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
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
  AjansDuyuruListesi,
  AjansDuyuruOlustur,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';

export default function AjansDuyurularEkrani() {
  const id = useAjansRouteId();
  const [liste, setListe] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [push, setPush] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setListe(await AjansDuyuruListesi(id));
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
      title="Duyurular"
      subtitle="Üyelere duyuru · push"
      aktif="duyurular"
      yukleniyor={yukleniyor && liste.length === 0}
      refreshing={yukleniyor && liste.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Yeni duyuru</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={title} onChangeText={setTitle} placeholder="Başlık" />
        <AjansInput value={body} onChangeText={setBody} placeholder="Mesaj" multiline />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ ...TipografiTokenlari.caption, color: RenkTokenlari.text }}>
            Push gönder (günlük limit 10)
          </Text>
          <Switch value={push} onValueChange={setPush} />
        </View>
        <AjansCta
          label="Gönder"
          onPress={() => {
            void (async () => {
              const r = await AjansDuyuruOlustur({
                agencyId: id,
                title: title.trim(),
                body: body.trim(),
                sendPush: push,
              });
              if (!r.ok) Alert.alert('Duyuru', r.hata);
              else {
                setTitle('');
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
          liste.map((d) => (
            <AjansListeSatir
              key={String(d.id)}
              title={String(d.title)}
              subtitle={`${d.okundu ? 'Okundu' : 'Okunmadı'} · ${new Date(String(d.created_at)).toLocaleString('tr-TR')}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
