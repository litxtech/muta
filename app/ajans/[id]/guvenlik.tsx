import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansCta,
  AjansHint,
  AjansKart,
  AjansListeSatir,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansAuditListesi,
  AjansGuvenlikAck,
  AjansGuvenlikListesi,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';

export default function AjansGuvenlikEkrani() {
  const id = useAjansRouteId();
  const [olaylar, setOlaylar] = useState<Array<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const [o, a] = await Promise.all([
        AjansGuvenlikListesi(id).catch(() => []),
        AjansAuditListesi(id, 40).catch(() => []),
      ]);
      setOlaylar(o);
      setAudit(a);
    } catch {
      setOlaylar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Güvenlik"
      subtitle="Olaylar ve audit"
      aktif="guvenlik"
      yukleniyor={yukleniyor && olaylar.length === 0 && audit.length === 0}
      refreshing={yukleniyor && (olaylar.length > 0 || audit.length > 0)}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Güvenlik olayları</AjansBolumBaslik>
      <AjansKart>
        {olaylar.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          olaylar.map((e) => (
            <AjansKart key={String(e.id)}>
              <AjansListeSatir
                title={String(e.title)}
                subtitle={`${e.severity} · ${e.acked ? 'onaylı' : 'yeni'} · ${new Date(String(e.created_at)).toLocaleString('tr-TR')}`}
              />
              {!e.acked ? (
                <AjansCta
                  ghost
                  label="Onayla (ACK)"
                  onPress={() => {
                    void (async () => {
                      const r = await AjansGuvenlikAck(String(e.id));
                      if (!r.ok) Alert.alert('Güvenlik', r.hata);
                      else await yukle();
                    })();
                  }}
                />
              ) : null}
            </AjansKart>
          ))
        )}
      </AjansKart>

      <AjansBolumBaslik>Audit log</AjansBolumBaslik>
      <AjansKart>
        {audit.length === 0 ? (
          <AjansHint>Henüz veri yok</AjansHint>
        ) : (
          audit.map((a) => (
            <AjansListeSatir
              key={String(a.id)}
              title={String(a.summary)}
              subtitle={`${a.actor_name ?? '—'} · ${a.action} · ${new Date(String(a.created_at)).toLocaleString('tr-TR')}`}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
