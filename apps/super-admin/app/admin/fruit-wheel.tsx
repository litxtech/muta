import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../../../src/components/Screen';
import { EkranBasligi } from '../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  fruitWheelAdminAudit,
  fruitWheelAdminDashboard,
  fruitWheelAdminMath,
  fruitWheelAdminSetEnabled,
} from '../../lib/FruitWheelAdminApi';
import { RenkTokenlari } from '../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Fruit = {
  id: string;
  multiplier: number;
  weight?: number;
  enabled?: boolean;
};

/**
 * Meyve Çarkı personel paneli.
 *
 * Bilinçli olarak SALT OKUNUR:
 *   - Sonuç seçilemez (force_next kaldırıldı).
 *   - Ağırlık/çarpan yayınlama kaldırıldı.
 *   - Yalnızca bakım modu ve denetim kaydı yönetilir.
 *
 * Çark sonucu sunucudaki RNG tarafından üretilir.
 */
export default function AdminFruitWheel() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [math, setMath] = useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = useState('');
  const [note, setNote] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const d = (await fruitWheelAdminDashboard()) as {
        ok?: boolean;
        fruits?: Fruit[];
        gameEnabled?: boolean;
      };
      if (!d?.ok) {
        setNote('Yetki veya bağlantı yok');
        return;
      }
      setDash(d as Record<string, unknown>);
      setFruits(Array.isArray(d.fruits) ? d.fruits : []);
      const m = (await fruitWheelAdminMath()) as Record<string, unknown>;
      if (m?.ok) setMath(m);
      const a = (await fruitWheelAdminAudit()) as {
        ok?: boolean;
        items?: { action: string; createdAt: string }[];
      };
      if (a?.ok && a.items) {
        setAudit(a.items.slice(0, 8).map((i) => `${i.action} · ${i.createdAt}`).join('\n'));
      }
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (admin) void yukle();
    }, [admin, yukle]),
  );

  if (!admin) {
    return (
      <Screen>
        <EkranBasligi title="Meyve Çarkı" />
        <Text style={styles.note}>Bu ekran yalnızca yetkili personel içindir.</Text>
      </Screen>
    );
  }

  const enabled = Boolean(dash?.gameEnabled);
  const round = dash?.currentRound as { roundNo?: number; status?: string } | null;

  const bakimDegistir = async (v: boolean) => {
    setBusy(true);
    try {
      const res = (await fruitWheelAdminSetEnabled(v)) as { ok?: boolean; message?: string };
      setNote(
        res?.ok
          ? v
            ? 'Oyun açıldı'
            : 'Oyun bakım moduna alındı'
          : res?.message || 'İşlem reddedildi',
      );
      await yukle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <EkranBasligi title="Meyve Çarkı" subtitle="Bakım ve denetim" />

        {yukleniyor ? <ActivityIndicator color={RenkTokenlari.accent} /> : null}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Oyun açık</Text>
              <Text style={styles.meta}>
                Kapatıldığında çark bakım moduna girer; yeni tur açılmaz.
              </Text>
            </View>
            <Switch value={enabled} disabled={busy} onValueChange={bakimDegistir} />
          </View>
          <Text style={styles.meta}>
            Tur {round?.roundNo ?? '—'} · {round?.status ?? 'yok'} · sürüm{' '}
            {String(dash?.configVersion ?? '—')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sonuç üretimi</Text>
          <Text style={styles.meta}>
            Çark sonucu sunucudaki rastgele sayı üreteci tarafından belirlenir. Personel
            panelinden sonuç seçilemez, sıra yazılamaz, ağırlık/çarpan yayınlanamaz.
          </Text>
        </View>

        <Text style={styles.section}>Meyveler (salt okunur)</Text>
        {fruits.map((f) => (
          <View key={f.id} style={styles.fruitRow}>
            <Text style={styles.fruitName}>{f.id}</Text>
            <Text style={styles.meta}>×{f.multiplier}</Text>
            <Text style={styles.meta}>{f.enabled === false ? 'kapalı' : 'aktif'}</Text>
          </View>
        ))}

        {math ? (
          <Text style={styles.meta}>
            Eşit dağılım beklenen dönüş: {String(math.equalSpreadExpectedReturn ?? '—')}
          </Text>
        ) : null}

        <Text style={styles.section}>Denetim kaydı</Text>
        <Text style={styles.meta}>{audit || 'Kayıt yok'}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.xxl,
  },
  card: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.md,
    gap: BoslukTokenlari.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: BoslukTokenlari.md },
  flex: { flex: 1 },
  cardTitle: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  section: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: BoslukTokenlari.sm,
  },
  fruitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  fruitName: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  meta: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  note: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.warning,
    padding: BoslukTokenlari.lg,
  },
});
