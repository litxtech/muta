import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  LiderlikSiralamasiniGetir,
  LiderlikSiralamasiniYenile,
  type SiralamaBoard,
  type SiralamaPeriod,
  type SiralamaSatiri,
} from '../../src/moduller/liderlik-siralamalari/okuma/LiderlikSiralamasiniGetir';
import { SiralamaKullaniciSatiri } from '../../src/moduller/liderlik-siralamalari/bilesenler/SiralamaKullaniciSatiri';
import { SiralamaOdaSatiri } from '../../src/moduller/liderlik-siralamalari/bilesenler/SiralamaOdaSatiri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const BOARDS: { id: SiralamaBoard; label: string }[] = [
  { id: 'top_recharge', label: 'Yükleme' },
  { id: 'gifter', label: 'Hediye' },
  { id: 'host', label: 'Ev sahibi' },
  { id: 'room', label: 'Oda' },
];

const BOARD_IDS = new Set(BOARDS.map((b) => b.id));

const PERIODS: { id: SiralamaPeriod; label: string }[] = [
  { id: 'weekly', label: 'Haftalık' },
  { id: 'daily', label: 'Günlük' },
  { id: 'all_time', label: 'Tümü' },
];

function boardParam(raw: string | string[] | undefined): SiralamaBoard {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && BOARD_IDS.has(v as SiralamaBoard)
    ? (v as SiralamaBoard)
    : 'top_recharge';
}

/** Top Recharge ≠ Top Gifter — haftalik yukleme on planda */
export default function SiralamalarEkrani() {
  const params = useLocalSearchParams<{ board?: string }>();
  const [board, setBoard] = useState<SiralamaBoard>(() =>
    boardParam(params.board),
  );
  const [period, setPeriod] = useState<SiralamaPeriod>('weekly');
  const [rows, setRows] = useState<SiralamaSatiri[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!params.board) return;
    setBoard(boardParam(params.board));
  }, [params.board]);

  const etkinPeriod: SiralamaPeriod =
    board === 'room' || board === 'host' ? 'weekly' : period;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await LiderlikSiralamasiniYenile(board, etkinPeriod);
      setRows(await LiderlikSiralamasiniGetir({ board, period: etkinPeriod }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [board, etkinPeriod]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const altBaslik = useMemo(() => {
    if (board === 'top_recharge') {
      return period === 'weekly'
        ? 'Bu hafta en çok coin yükleyenler'
        : period === 'daily'
          ? 'Bugün en çok yükleyenler'
          : 'Tüm zamanlar yükleme';
    }
    if (board === 'gifter') return 'Hediye gönderenler';
    if (board === 'room') {
      return 'Bu hafta odada harcanan hediye + oyun coin · Pazartesi sıfırlanır';
    }
    return 'Hediye alan ev sahipleri';
  }, [board, period]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="liderlik-siralamalari">
        <EkranBasligi title="Sıralamalar" subtitle={altBaslik} />

        <View style={styles.tabs}>
          {BOARDS.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBoard(b.id)}
              style={[styles.tab, board === b.id && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, board === b.id && styles.tabTextActive]}
              >
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {board !== 'host' && board !== 'room' ? (
          <View style={styles.periods}>
            {PERIODS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPeriod(p.id)}
                style={[styles.period, period === p.id && styles.periodActive]}
              >
                <Text
                  style={[
                    styles.periodText,
                    period === p.id && styles.periodTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <FlatList
          data={rest}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            top3.length > 0 ? (
              <View style={styles.podium}>
                <LinearGradient
                  colors={['rgba(61,207,176,0.16)', 'rgba(18,16,24,0)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.podiumTitle}>
                  {board === 'room'
                    ? 'Haftanın odaları'
                    : board === 'top_recharge'
                      ? 'Haftanın zirvesi'
                      : 'Zirve'}
                </Text>
                {top3.map((item) =>
                  board === 'room' ? (
                    <SiralamaOdaSatiri key={item.id} item={item} />
                  ) : (
                    <SiralamaKullaniciSatiri
                      key={item.id}
                      item={item}
                      birim="coin"
                    />
                  ),
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && rows.length === 0 ? (
              <BosDurum
                icon="trophy-outline"
                title="Sıralama boş"
                body={
                  board === 'top_recharge'
                    ? 'Bu dönemde henüz coin yüklemesi yok. Profil → Ayarlar’dan sıralamayı gizleyebilirsin.'
                    : board === 'room'
                      ? 'Bu hafta henüz odada hediye veya oyun coin harcaması yok. Pazartesi sıralama sıfırlanır.'
                      : 'Bu dönem için kayıt yok.'
                }
              />
            ) : null
          }
          renderItem={({ item }) =>
            board === 'room' ? (
              <SiralamaOdaSatiri item={item} />
            ) : (
              <SiralamaKullaniciSatiri item={item} birim="coin" />
            )
          }
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    alignItems: 'center',
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tabActive: {
    borderColor: RenkTokenlari.mint,
    backgroundColor: 'rgba(61, 207, 176, 0.14)',
  },
  tabText: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  tabTextActive: { color: RenkTokenlari.mint, fontWeight: '700' },
  periods: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.md,
  },
  period: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.pill ?? 999,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  periodActive: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
  },
  periodText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  periodTextActive: { color: RenkTokenlari.primarySoft },
  list: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.sm,
  },
  podium: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.22)',
  },
  podiumTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: BoslukTokenlari.sm,
    textTransform: 'uppercase',
  },
});
