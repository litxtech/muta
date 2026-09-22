import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansHint,
  AjansKart,
  AjansKpiHucre,
  AjansListeSatir,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId, ajansHref } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansCanliOperasyonGetir,
  type AjansCanliOperasyon,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';

export default function AjansCanliEkrani() {
  const id = useAjansRouteId();
  const [data, setData] = useState<AjansCanliOperasyon | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setData(await AjansCanliOperasyonGetir(id));
    } catch {
      setData(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Canlı Operasyon"
      subtitle="Şu an ajansında ne oluyor?"
      aktif="canli"
      yukleniyor={yukleniyor && !data}
      refreshing={yukleniyor && !!data}
      onRefresh={() => void yukle()}
    >
      <View style={styles.kpiGrid}>
        <AjansKpiHucre
          label="Çevrimiçi"
          value={String(data?.ozet.cevrimici ?? 0)}
          emphasize
        />
        <AjansKpiHucre
          label="Canlı"
          value={String(data?.ozet.canli ?? 0)}
          emphasize
        />
        <AjansKpiHucre label="Ses odası" value={String(data?.ozet.ses ?? 0)} emphasize />
      </View>

      <AjansBolumBaslik>Çevrimiçi üyeler</AjansBolumBaslik>
      <AjansKart>
        {(data?.cevrimici ?? []).length === 0 ? (
          <AjansHint>Kimse çevrimiçi değil</AjansHint>
        ) : (
          data!.cevrimici.map((u) => (
            <AjansListeSatir
              key={u.user_id}
              title={u.display_name || u.username || 'Üye'}
              subtitle={u.username ? `@${u.username}` : undefined}
              avatarUrl={u.avatar_url}
              live
            />
          ))
        )}
      </AjansKart>

      <AjansBolumBaslik>Canlı yayın</AjansBolumBaslik>
      <AjansKart accent>
        {(data?.canli_yayinlar ?? []).length === 0 ? (
          <AjansHint>Aktif yayın yok</AjansHint>
        ) : (
          data!.canli_yayinlar.map((c) => (
            <AjansListeSatir
              key={c.session_id}
              title={c.display_name || c.username || 'Yayın'}
              subtitle={`${c.title} · ${c.viewer_count} izleyici`}
              avatarUrl={c.avatar_url}
              live
              trailing={<Text style={styles.link}>Git</Text>}
              onPress={() => router.push(`/canli/${c.session_id}` as any)}
            />
          ))
        )}
      </AjansKart>

      <AjansBolumBaslik>Ses odaları</AjansBolumBaslik>
      <AjansKart>
        {(data?.ses_odalari ?? []).length === 0 ? (
          <AjansHint>Aktif oda yok</AjansHint>
        ) : (
          data!.ses_odalari.map((r) => (
            <AjansListeSatir
              key={r.room_id}
              title={r.title}
              subtitle={`${r.display_name || r.username} · ${r.listener_count} dinleyici`}
              trailing={<Text style={styles.link}>Oda</Text>}
              onPress={() => router.push(`/room/${r.room_id}` as any)}
            />
          ))
        )}
      </AjansKart>

      <AjansBolumBaslik>Yaklaşan program</AjansBolumBaslik>
      <AjansKart>
        {(data?.yaklasan_programlar ?? []).length === 0 ? (
          <AjansHint>Planlanmış program yok</AjansHint>
        ) : (
          data!.yaklasan_programlar.map((p) => (
            <AjansListeSatir
              key={p.id}
              title={p.title}
              subtitle={`${p.kind} · ${new Date(p.starts_at).toLocaleString('tr-TR')}`}
              onPress={() => router.push(ajansHref(id, 'program') as any)}
            />
          ))
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', gap: 8 },
  link: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
});
