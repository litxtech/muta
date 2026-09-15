import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminAktifOyunOturumlari,
  AdminOyunKataloguGetir,
  AdminOyunKontrolGuncelle,
  AdminTumOyunKontrolleriniGetir,
  type AdminOyunKatalogSatiri,
} from '../../src/moduller/admin/oyunlar/AdminOyunIslemleri';
import type { EconomyMode, GameControlConfig } from '../../src/moduller/oyunlar/ortak/tipler/OyunTipleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const MODLAR: EconomyMode[] = [
  'NORMAL',
  'PROMOTION',
  'LOW_REWARD',
  'NO_REWARD',
  'MAINTENANCE',
];

function oyunAdi(
  code: string,
  katalog: AdminOyunKatalogSatiri[],
): string {
  return katalog.find((k) => k.game_code === code)?.name ?? code;
}

export default function AdminOyunlarEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [configs, setConfigs] = useState<GameControlConfig[]>([]);
  const [katalog, setKatalog] = useState<AdminOyunKatalogSatiri[]>([]);
  const [seciliKod, setSeciliKod] = useState<string | null>(null);
  const [aktif, setAktif] = useState<
    Awaited<ReturnType<typeof AdminAktifOyunOturumlari>>
  >([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [xpMul, setXpMul] = useState('1');
  const [trophyMul, setTrophyMul] = useState('1');
  const [rewardFactor, setRewardFactor] = useState('1');
  const [reason, setReason] = useState('');

  const cfg = useMemo(
    () => configs.find((c) => c.game_code === seciliKod) ?? null,
    [configs, seciliKod],
  );

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [cList, kat, a] = await Promise.all([
        AdminTumOyunKontrolleriniGetir(),
        AdminOyunKataloguGetir(),
        AdminAktifOyunOturumlari(),
      ]);
      setConfigs(cList);
      setKatalog(kat);
      setAktif(a);
      setSeciliKod((prev) => {
        const next =
          prev && cList.some((c) => c.game_code === prev)
            ? prev
            : (cList[0]?.game_code ?? null);
        const selected = cList.find((c) => c.game_code === next);
        if (selected) {
          setXpMul(String(selected.xp_multiplier));
          setTrophyMul(String(selected.trophy_multiplier));
          setRewardFactor(String(selected.reward_factor));
        }
        return next;
      });
    } catch (e) {
      Alert.alert('Oyunlar', e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  const sec = (code: string) => {
    setSeciliKod(code);
    const next = configs.find((c) => c.game_code === code);
    if (next) {
      setXpMul(String(next.xp_multiplier));
      setTrophyMul(String(next.trophy_multiplier));
      setRewardFactor(String(next.reward_factor));
    }
  };

  const kaydet = async (gameCode: string, patch: Record<string, unknown>, sebep?: string) => {
    setKaydediyor(true);
    try {
      const next = await AdminOyunKontrolGuncelle({
        gameCode,
        patch,
        reason: sebep ?? (reason || 'admin panel'),
      });
      setConfigs((prev) => prev.map((c) => (c.game_code === gameCode ? next : c)));
      Alert.alert('Kaydedildi', 'Oyun kontrol ayarı güncellendi (audit log yazıldı).');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setKaydediyor(false);
    }
  };

  if (!admin) return null;

  return (
    <Screen>
      <EkranBasligi
        title="Oyun Yönetimi"
        subtitle="Kapalı oyun uygulamada hiç görünmez"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={yukleniyor} onRefresh={() => void yukle()} />
        }
      >
        {yukleniyor && configs.length === 0 ? (
          <ActivityIndicator color={RenkTokenlari.accent} />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>Oyunlar</Text>
          <Text style={styles.hint}>
            Kapatılan oyun oda menüsü, başlat sheet ve davetlerde listelenmez; sunucu da oturum
            açmaz.
          </Text>
          {configs.length === 0 ? (
            <Text style={styles.meta}>Kayıtlı oyun yok.</Text>
          ) : (
            configs.map((c) => {
              const acik = c.is_enabled && c.mode !== 'MAINTENANCE';
              return (
                <View key={c.game_code} style={styles.gameRow}>
                  <Pressable style={styles.gameInfo} onPress={() => sec(c.game_code)}>
                    <Text
                      style={[
                        styles.gameName,
                        seciliKod === c.game_code && styles.gameNameOn,
                      ]}
                    >
                      {oyunAdi(c.game_code, katalog)}
                    </Text>
                    <Text style={styles.meta}>
                      {c.game_code} · {acik ? 'görünür' : 'gizli'} · {c.mode}
                    </Text>
                  </Pressable>
                  <Switch
                    value={c.is_enabled}
                    onValueChange={(v) =>
                      void kaydet(c.game_code, { is_enabled: v }, `enabled=${v}`)
                    }
                    disabled={kaydediyor}
                  />
                </View>
              );
            })
          )}
        </View>

        {cfg ? (
          <View style={styles.card}>
            <Text style={styles.title}>{oyunAdi(cfg.game_code, katalog)}</Text>
            <Text style={styles.meta}>
              Kod: {cfg.game_code} · Süre: {cfg.default_duration_seconds}s · Oyuncu:{' '}
              {cfg.min_players}–{cfg.max_players}
            </Text>

            <View style={styles.row}>
              <Text style={styles.label}>Oyun açık (uygulamada görünür)</Text>
              <Switch
                value={cfg.is_enabled}
                onValueChange={(v) =>
                  void kaydet(cfg.game_code, { is_enabled: v }, `enabled=${v}`)
                }
                disabled={kaydediyor}
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Coin ödül (şeffaf havuz)</Text>
              <Switch
                value={cfg.coin_rewards_enabled}
                onValueChange={(v) =>
                  void kaydet(cfg.game_code, { coin_rewards_enabled: v }, `coin_rewards=${v}`)
                }
                disabled={kaydediyor}
              />
            </View>
            <Text style={styles.hint}>
              Kapalıyken yalnızca XP / kupa. Açıkken giriş coin’i havuza girer; sıralama payı
              maç öncesi politikada görünür. Gizli kazanma müdahalesi yok.
            </Text>

            <Text style={styles.section}>Günlük mod</Text>
            <View style={styles.chips}>
              {MODLAR.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.chip, cfg.mode === m && styles.chipOn]}
                  onPress={() => void kaydet(cfg.game_code, { mode: m }, `mode=${m}`)}
                >
                  <Text style={[styles.chipText, cfg.mode === m && styles.chipTextOn]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              MAINTENANCE modu oyunu uygulamadan gizler (is_enabled açık olsa bile).
            </Text>

            <Text style={styles.section}>Çarpanlar</Text>
            <Text style={styles.label}>XP çarpanı</Text>
            <TextInput
              style={styles.input}
              value={xpMul}
              onChangeText={setXpMul}
              keyboardType="decimal-pad"
              placeholderTextColor={RenkTokenlari.textMuted}
            />
            <Text style={styles.label}>Kupa çarpanı</Text>
            <TextInput
              style={styles.input}
              value={trophyMul}
              onChangeText={setTrophyMul}
              keyboardType="decimal-pad"
              placeholderTextColor={RenkTokenlari.textMuted}
            />
            <Text style={styles.label}>Ödül oranı (0.1–1)</Text>
            <TextInput
              style={styles.input}
              value={rewardFactor}
              onChangeText={setRewardFactor}
              keyboardType="decimal-pad"
              placeholderTextColor={RenkTokenlari.textMuted}
            />
            <Text style={styles.label}>Değişiklik gerekçesi (audit)</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder="Örn: hafta sonu kampanyası"
              placeholderTextColor={RenkTokenlari.textMuted}
            />
            <Pressable
              style={styles.btn}
              disabled={kaydediyor}
              onPress={() =>
                void kaydet(cfg.game_code, {
                  xp_multiplier: Number(xpMul) || 1,
                  trophy_multiplier: Number(trophyMul) || 1,
                  reward_factor: Number(rewardFactor) || 1,
                })
              }
            >
              <Text style={styles.btnText}>
                {kaydediyor ? 'Kaydediliyor…' : 'Çarpanları kaydet'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() =>
                void kaydet(
                  cfg.game_code,
                  {
                    xp_multiplier: 3,
                    trophy_multiplier: 2,
                    mode: 'PROMOTION',
                  },
                  'hızlı 3x XP / 2x kupa',
                )
              }
            >
              <Text style={styles.btnText}>Hızlı: 3× XP · 2× Kupa</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() =>
                void kaydet(
                  cfg.game_code,
                  { mode: 'NO_REWARD', reward_factor: 0 },
                  'ödülsüz eğlence',
                )
              }
            >
              <Text style={styles.btnText}>Ödülsüz eğlence modu</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>Aktif oturumlar</Text>
          {aktif.length === 0 ? (
            <Text style={styles.meta}>Şu an aktif oyun yok.</Text>
          ) : (
            aktif.map((o) => (
              <Text key={o.id} style={styles.meta}>
                {o.game_code} · {o.status} · {o.id.slice(0, 8)}
              </Text>
            ))
          )}
        </View>

        <Pressable
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => router.push('/admin/oyun-test' as any)}
        >
          <Text style={styles.btnText}>Odasız oyun testi aç</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: 16,
    padding: BoslukTokenlari.md,
    gap: 10,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  title: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.h2.fontSize,
    fontWeight: '700',
  },
  meta: {
    color: RenkTokenlari.textMuted,
    fontSize: TipografiTokenlari.caption.fontSize,
  },
  hint: {
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  gameInfo: { flex: 1, gap: 2 },
  gameName: {
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: TipografiTokenlari.body.fontSize,
  },
  gameNameOn: { color: RenkTokenlari.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: RenkTokenlari.text,
    fontSize: TipografiTokenlari.caption.fontSize,
    flex: 1,
    paddingRight: 8,
  },
  section: {
    marginTop: 8,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  chipOn: {
    backgroundColor: RenkTokenlari.violet,
    borderColor: RenkTokenlari.violet,
  },
  chipText: { color: RenkTokenlari.textMuted, fontSize: 11, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.bg,
  },
  btn: {
    marginTop: 4,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  btnText: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
