import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansHint,
  AjansKart,
  AjansKpiHucre,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansAnalitikGetir,
  saniyeSaatMetni,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Donem = '7' | '30' | '90';

function tarihAralik(donem: Donem): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - Number(donem));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function AjansAnalitikEkrani() {
  const id = useAjansRouteId();
  const [donem, setDonem] = useState<Donem>('30');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const { from, to } = tarihAralik(donem);
      setData(await AjansAnalitikGetir(id, from, to));
    } catch {
      setData(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id, donem]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const k = (data?.karsilastirma ?? {}) as Record<string, unknown>;

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Analitik"
      subtitle={`${donem} günlük dönem`}
      aktif="analitik"
      yukleniyor={yukleniyor && !data}
      refreshing={yukleniyor && !!data}
      onRefresh={() => void yukle()}
    >
      <View style={styles.filtre}>
        {(['7', '30', '90'] as Donem[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, donem === d && styles.chipAktif]}
            onPress={() => setDonem(d)}
          >
            <Text style={[styles.chipYazi, donem === d && styles.chipYaziAktif]}>
              {d} gün
            </Text>
          </Pressable>
        ))}
      </View>
      {!data ? (
        <AjansHint>Henüz veri yok</AjansHint>
      ) : (
        <>
          <View style={styles.kpiGrid}>
            <AjansKpiHucre label="Üye" value={String(data.uye_sayisi ?? 0)} emphasize />
            <AjansKpiHucre label="Aktif" value={String(data.aktif_uye ?? 0)} emphasize />
            <AjansKpiHucre label="Yeni" value={String(data.yeni_uye ?? 0)} />
            <AjansKpiHucre label="Başvuru" value={String(data.basvuru_sayisi ?? 0)} />
          </View>
          <AjansBolumBaslik>Aktivite</AjansBolumBaslik>
          <AjansKart>
            <Text style={styles.satir}>
              Yayın: {saniyeSaatMetni(Number(data.yayin_saniye) || 0)}
            </Text>
            <Text style={styles.satir}>
              Ses odası: {saniyeSaatMetni(Number(data.ses_saniye) || 0)}
            </Text>
            <Text style={styles.satir}>Etkinlik: {String(data.etkinlik_sayisi ?? 0)}</Text>
            <Text style={styles.satir}>
              Görev tamamlanan: {String(data.gorev_tamamlanan ?? 0)}
            </Text>
          </AjansKart>
          <AjansBolumBaslik>Dönem karşılaştırma</AjansBolumBaslik>
          <AjansKart accent>
            <View style={styles.kpiGrid}>
              <AjansKpiHucre
                label="Yayın Δ"
                value={`%${String(k.yayin_degisim_pct ?? 0)}`}
                emphasize
              />
              <AjansKpiHucre
                label="Ses Δ"
                value={`%${String(k.ses_degisim_pct ?? 0)}`}
                emphasize
              />
            </View>
            <Text style={styles.alt}>
              Önceki yayın: {saniyeSaatMetni(Number(k.onceki_yayin_saniye) || 0)} · Önceki
              ses: {saniyeSaatMetni(Number(k.onceki_ses_saniye) || 0)}
            </Text>
          </AjansKart>
        </>
      )}
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  filtre: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  chipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  chipYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
  chipYaziAktif: { color: RenkTokenlari.text, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  satir: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  alt: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim, marginTop: 8 },
});
