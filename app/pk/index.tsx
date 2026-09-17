import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  PkCanliMaclariGetir,
  type PkMacZengin,
} from '../../src/moduller/pk/skor/PkSkorOku';
import {
  PkKalanSaniye,
  PkSkorOlaylariniGetir,
  type PkSkorOlayi,
} from '../../src/moduller/pk/skor/PkSkorOlaylariniGetir';
import { PkYayinOnizlemeKarti } from '../../src/moduller/pk/bilesenler/PkYayinOnizlemeKarti';
import { useGecikmeliPkOnizleme } from '../../src/moduller/pk/onizleme/useGecikmeliPkOnizleme';
import { OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function SeciliArena({ mac }: { mac: PkMacZengin }) {
  const gecikmeli = useGecikmeliPkOnizleme(mac.score_a, mac.score_b, 3000);
  const kalan = PkKalanSaniye(mac.ends_at);
  const toplam = gecikmeli.score_a + gecikmeli.score_b;
  const oranA = toplam > 0 ? (gecikmeli.score_a / toplam) * 100 : 50;

  return (
    <View style={styles.arena}>
      <View style={styles.arenaAura} />
      <Text style={styles.type}>{mac.pk_type.toUpperCase()}</Text>
      <Text style={styles.gecikmeEtiket}>Önizleme · 3 saniye geriden</Text>
      <Text style={styles.timer}>
        {kalan == null
          ? '—'
          : `${Math.floor(kalan / 60)}:${String(kalan % 60).padStart(2, '0')}`}
      </Text>
      <View style={styles.scoreRow}>
        <Text style={styles.scoreA}>{gecikmeli.score_a}</Text>
        <Text style={styles.vs}>VS</Text>
        <Text style={styles.scoreB}>{gecikmeli.score_b}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barA, { width: `${oranA}%` as `${number}%` }]} />
      </View>
      <Text style={styles.meta}>Canlı skor 3 sn gecikmeli gösterilir</Text>
    </View>
  );
}

/** PK skor UI — authoritative deger backend'den; onizleme 3 sn geriden */
export default function PkEkrani() {
  const [maclar, setMaclar] = useState<PkMacZengin[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [olaylar, setOlaylar] = useState<PkSkorOlayi[]>([]);
  const [tick, setTick] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const enabled = OzellikBayragiAktifMi('pk_enabled');

  const yukle = useCallback(async () => {
    if (!enabled) {
      setMaclar([]);
      return;
    }
    setYukleniyor(true);
    try {
      const m = await PkCanliMaclariGetir();
      setMaclar(m);
      setSecili((prev) => {
        if (prev && m.some((x) => x.id === prev)) return prev;
        return m[0]?.id ?? null;
      });
    } catch {
      setMaclar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
      const id = setInterval(() => void yukle(), 1500);
      return () => clearInterval(id);
    }, [yukle]),
  );

  useEffect(() => {
    if (!secili) {
      setOlaylar([]);
      return;
    }
    PkSkorOlaylariniGetir(secili)
      .then(setOlaylar)
      .catch(() => setOlaylar([]));
  }, [secili, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const aktifMac = maclar.find((m) => m.id === secili) ?? maclar[0];

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="pk">
        <EkranBasligi
          title="Canlı PK"
          subtitle="Şeffaf aura · 3 sn gecikmeli önizleme"
        />
        <FlatList
          data={maclar}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={yukleniyor}
              onRefresh={() => void yukle()}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              {!enabled ? (
                <View style={styles.warnCard}>
                  <Text style={styles.warn}>PK özelliği şu an kapalı.</Text>
                </View>
              ) : null}
              {aktifMac ? <SeciliArena mac={aktifMac} /> : null}
              <Text style={styles.section}>Canlı PK önizlemeleri</Text>
            </View>
          }
          ListEmptyComponent={
            <BosDurum
              icon="flash-outline"
              title="Canlı PK yok"
              body="Yeni maçlar başladığında şeffaf aura’lı kartlar burada görünür."
            />
          }
          renderItem={({ item }) => (
            <PkYayinOnizlemeKarti
              mac={item}
              secili={secili === item.id}
              onPress={() => setSecili(item.id)}
            />
          )}
          ListFooterComponent={
            aktifMac ? (
              <View style={styles.footer}>
                <Text style={styles.section}>Skor olayları</Text>
                {olaylar.length === 0 ? (
                  <BosDurum
                    icon="trophy-outline"
                    title="Henüz skor yok"
                    body="Hediye ve aksiyonlar burada listelenir."
                  />
                ) : (
                  olaylar.map((item) => (
                    <View key={item.id} style={styles.event}>
                      <Text style={styles.eventSide}>
                        {item.side.toUpperCase()}
                      </Text>
                      <Text style={styles.eventDelta}>+{item.delta}</Text>
                      <Text style={styles.eventReason}>
                        {item.reason ?? 'skor'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null
          }
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
  },
  header: { gap: BoslukTokenlari.md, marginBottom: BoslukTokenlari.sm },
  footer: { marginTop: BoslukTokenlari.md, gap: BoslukTokenlari.xs },
  warnCard: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: 'rgba(240, 180, 41, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.35)',
  },
  warn: { ...TipografiTokenlari.body, color: RenkTokenlari.warning },
  arena: {
    padding: BoslukTokenlari.xl,
    borderRadius: YaricapTokenlari.xl,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    overflow: 'hidden',
  },
  arenaAura: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(196, 59, 255, 0.08)',
  },
  type: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent, fontWeight: '800' },
  gecikmeEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  timer: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.lg,
  },
  scoreA: { ...TipografiTokenlari.title, color: '#60A5FA', fontSize: 36 },
  scoreB: { ...TipografiTokenlari.title, color: '#F472B6', fontSize: 36 },
  vs: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  barTrack: {
    width: '100%',
    height: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(244, 114, 182, 0.35)',
    overflow: 'hidden',
  },
  barA: { height: '100%', backgroundColor: '#60A5FA' },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  section: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.sm,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  eventSide: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    width: 40,
  },
  eventDelta: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  eventReason: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    flex: 1,
  },
});
