import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  AdminAutoBannerAyarlariKaydet,
  AdminAutoBannerCooldownTemizle,
  AdminAutoBannerHepsiniKapat,
  AdminAutoBannerKapat,
  AdminAutoBannerListele,
  AdminAutoBannerOncelik,
  AdminAutoBannerPin,
  AdminAutoBannerTaraYenile,
  AdminAutoBannerTtlUzat,
  AutoBannerAyarlariGetir,
} from '../../banner/auto/AutoBannerService';
import type {
  AutoBannerAyarlari,
  AutoBannerKayit,
} from '../../banner/auto/AutoBannerTipleri';
import {
  AUTO_BANNER_AYAR_VARSAYILAN,
  AUTO_BANNER_KIND_LABELS,
} from '../../banner/auto/AutoBannerTipleri';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type SayiAlan =
  | 'ttl_hours'
  | 'cooldown_hours'
  | 'room_coin_threshold'
  | 'live_coin_threshold'
  | 'game_coin_threshold'
  | 'gift_burst_window_sec'
  | 'gift_burst_coin_threshold'
  | 'max_active'
  | 'carousel_max';

/**
 * Olay / hediye otomatik banner yönetimi — algoritma ayarları + müdahale.
 */
export function AdminOtomatikBannerPaneli() {
  const [ayar, setAyar] = useState<AutoBannerAyarlari>(AUTO_BANNER_AYAR_VARSAYILAN);
  const [liste, setListe] = useState<AutoBannerKayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [filtre, setFiltre] = useState<'aktif' | 'hepsi'>('aktif');

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [a, rows] = await Promise.all([
        AutoBannerAyarlariGetir(),
        AdminAutoBannerListele().catch(() => [] as AutoBannerKayit[]),
      ]);
      setAyar(a);
      setListe(rows);
    } catch (e) {
      Alert.alert(
        'Hata',
        e instanceof Error ? e.message : 'Otomatik banner ayarları alınamadı',
      );
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const kaydet = async (patch: Partial<AutoBannerAyarlari>) => {
    const onceki = ayar;
    setAyar({ ...ayar, ...patch });
    setKaydediyor(true);
    try {
      const kayit = await AdminAutoBannerAyarlariKaydet(patch);
      setAyar(kayit);
    } catch (e) {
      setAyar(onceki);
      Alert.alert(
        'Hata',
        e instanceof Error ? e.message : 'Ayar kaydedilemedi',
      );
    } finally {
      setKaydediyor(false);
    }
  };

  const sayiGuncelle = (alan: SayiAlan, ham: string) => {
    const n = Number(ham.replace(/[^\d]/g, ''));
    if (!Number.isFinite(n)) return;
    setAyar((prev) => ({ ...prev, [alan]: n }));
  };

  const sayiKaydet = (alan: SayiAlan) => {
    void kaydet({ [alan]: ayar[alan] });
  };

  const gosterilen = liste.filter((x) =>
    filtre === 'aktif' ? x.active : true,
  );

  const bannerKapat = (id: string) => {
    Alert.alert('Bannerı kapat', 'Bu otomatik banner feed’den kalkacak.', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kapat',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await AdminAutoBannerKapat(id);
              await yukle();
            } catch (e) {
              Alert.alert(
                'Hata',
                e instanceof Error ? e.message : 'Kapatılamadı',
              );
            }
          })();
        },
      },
    ]);
  };

  const topluKapat = () => {
    Alert.alert('Tümünü kapat', 'Aktif otomatik bannerlar kapatılsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kapat',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const n = await AdminAutoBannerHepsiniKapat();
              Alert.alert('Tamam', `${n} banner kapatıldı`);
              await yukle();
            } catch (e) {
              Alert.alert(
                'Hata',
                e instanceof Error ? e.message : 'İşlem başarısız',
              );
            }
          })();
        },
      },
    ]);
  };

  if (yukleniyor && !ayar.updated_at) {
    return <ActivityIndicator color={RenkTokenlari.primary} />;
  }

  return (
    <View style={styles.kok}>
      <Text style={styles.bolumBaslik}>Algoritma</Text>
      <Text style={styles.bolumAlt}>
        Ses odası / canlı yayında hediye coin eşiği, milestone (1x·2x·5x) ve kısa
        pencereli hediye yağmuru otomatik banner üretir. Kaynak kapanınca düşer.
      </Text>

      <View style={styles.kart}>
        <View style={styles.satir}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.ad}>Otomatik banner sistemi</Text>
            <Text style={styles.meta}>
              Kapalıyken yeni oluşmaz; aktifler temizlenir
            </Text>
          </View>
          <Switch
            value={ayar.enabled}
            onValueChange={(v) => void kaydet({ enabled: v })}
            disabled={kaydediyor}
            trackColor={{
              false: RenkTokenlari.surface,
              true: RenkTokenlari.primary,
            }}
            thumbColor={RenkTokenlari.text}
          />
        </View>
      </View>

      <View style={styles.mudahale}>
        <MudahaleBtn
          icon="refresh"
          label="Tara / yenile"
          onPress={() => {
            void (async () => {
              try {
                const n = await AdminAutoBannerTaraYenile();
                Alert.alert('Tarama', `${n} canlı kaynak değerlendirildi`);
                await yukle();
              } catch (e) {
                Alert.alert(
                  'Hata',
                  e instanceof Error ? e.message : 'Tarama başarısız',
                );
              }
            })();
          }}
        />
        <MudahaleBtn
          icon="timer-outline"
          label="Cooldown temizle"
          onPress={() => {
            void (async () => {
              try {
                const n = await AdminAutoBannerCooldownTemizle();
                Alert.alert('Cooldown', `${n} kayıt serbest bırakıldı`);
              } catch (e) {
                Alert.alert(
                  'Hata',
                  e instanceof Error ? e.message : 'Temizlenemedi',
                );
              }
            })();
          }}
        />
        <MudahaleBtn
          icon="close-circle-outline"
          label="Tümünü kapat"
          danger
          onPress={topluKapat}
        />
      </View>

      <View style={styles.kart}>
        <Text style={styles.kartBaslik}>Coin eşikleri</Text>
        <SayiSatiri
          etiket="Oda coin eşiği"
          deger={ayar.room_coin_threshold}
          onChange={(t) => sayiGuncelle('room_coin_threshold', t)}
          onBlur={() => sayiKaydet('room_coin_threshold')}
          acik={ayar.room_coins_enabled}
          onAcik={(v) => void kaydet({ room_coins_enabled: v })}
        />
        <SayiSatiri
          etiket="Canlı coin eşiği"
          deger={ayar.live_coin_threshold}
          onChange={(t) => sayiGuncelle('live_coin_threshold', t)}
          onBlur={() => sayiKaydet('live_coin_threshold')}
          acik={ayar.live_coins_enabled}
          onAcik={(v) => void kaydet({ live_coins_enabled: v })}
        />
        <SayiSatiri
          etiket="Oyun coin eşiği"
          deger={ayar.game_coin_threshold}
          onChange={(t) => sayiGuncelle('game_coin_threshold', t)}
          onBlur={() => sayiKaydet('game_coin_threshold')}
          acik={ayar.game_coins_enabled}
          onAcik={(v) => void kaydet({ game_coins_enabled: v })}
        />
        <View style={styles.satir}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.ad}>Koltuklar dolunca</Text>
            <Text style={styles.meta}>Ses odasında tüm koltuklar dolu</Text>
          </View>
          <Switch
            value={ayar.seats_full_enabled}
            onValueChange={(v) => void kaydet({ seats_full_enabled: v })}
            disabled={kaydediyor}
            trackColor={{
              false: RenkTokenlari.surface,
              true: RenkTokenlari.primary,
            }}
            thumbColor={RenkTokenlari.text}
          />
        </View>
        <View style={styles.satir}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.ad}>Milestone (1× · 2× · 5×)</Text>
            <Text style={styles.meta}>
              Eşik katlarında yeni banner (cooldown ayrı)
            </Text>
          </View>
          <Switch
            value={ayar.milestone_enabled}
            onValueChange={(v) => void kaydet({ milestone_enabled: v })}
            disabled={kaydediyor}
            trackColor={{
              false: RenkTokenlari.surface,
              true: RenkTokenlari.primary,
            }}
            thumbColor={RenkTokenlari.text}
          />
        </View>
      </View>

      <View style={styles.kart}>
        <Text style={styles.kartBaslik}>Hediye yağmuru</Text>
        <View style={styles.satir}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.ad}>Patlama bannerı</Text>
            <Text style={styles.meta}>Kısa pencerede yoğun hediye</Text>
          </View>
          <Switch
            value={ayar.gift_burst_enabled}
            onValueChange={(v) => void kaydet({ gift_burst_enabled: v })}
            disabled={kaydediyor}
            trackColor={{
              false: RenkTokenlari.surface,
              true: RenkTokenlari.primary,
            }}
            thumbColor={RenkTokenlari.text}
          />
        </View>
        <SayiSatiri
          etiket="Pencere (saniye)"
          deger={ayar.gift_burst_window_sec}
          onChange={(t) => sayiGuncelle('gift_burst_window_sec', t)}
          onBlur={() => sayiKaydet('gift_burst_window_sec')}
        />
        <SayiSatiri
          etiket="Patlama coin eşiği"
          deger={ayar.gift_burst_coin_threshold}
          onChange={(t) => sayiGuncelle('gift_burst_coin_threshold', t)}
          onBlur={() => sayiKaydet('gift_burst_coin_threshold')}
        />
      </View>

      <View style={styles.kart}>
        <Text style={styles.kartBaslik}>Süre ve limit</Text>
        <SayiSatiri
          etiket="TTL (saat)"
          deger={ayar.ttl_hours}
          onChange={(t) => sayiGuncelle('ttl_hours', t)}
          onBlur={() => sayiKaydet('ttl_hours')}
        />
        <SayiSatiri
          etiket="Cooldown (saat)"
          deger={ayar.cooldown_hours}
          onChange={(t) => sayiGuncelle('cooldown_hours', t)}
          onBlur={() => sayiKaydet('cooldown_hours')}
        />
        <SayiSatiri
          etiket="Maks. aktif"
          deger={ayar.max_active}
          onChange={(t) => sayiGuncelle('max_active', t)}
          onBlur={() => sayiKaydet('max_active')}
        />
        <SayiSatiri
          etiket="Carousel limiti"
          deger={ayar.carousel_max}
          onChange={(t) => sayiGuncelle('carousel_max', t)}
          onBlur={() => sayiKaydet('carousel_max')}
        />
      </View>

      <View style={styles.filtreSatir}>
        <Text style={styles.bolumBaslik}>
          Otomatik bannerlar ({gosterilen.length})
        </Text>
        <View style={styles.filtreChip}>
          <Pressable
            onPress={() => setFiltre('aktif')}
            style={[styles.filtreBtn, filtre === 'aktif' && styles.filtreAktif]}
          >
            <Text style={styles.filtreYazi}>Aktif</Text>
          </Pressable>
          <Pressable
            onPress={() => setFiltre('hepsi')}
            style={[styles.filtreBtn, filtre === 'hepsi' && styles.filtreAktif]}
          >
            <Text style={styles.filtreYazi}>Hepsi</Text>
          </Pressable>
        </View>
      </View>

      {gosterilen.length === 0 ? (
        <Text style={styles.meta}>Kayıt yok. Hediye eşiği aşılınca oluşur.</Text>
      ) : (
        gosterilen.map((b) => (
          <View key={b.id} style={styles.bannerKart}>
            <View style={styles.bannerUst}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.ad} numberOfLines={1}>
                  {b.pinned ? '📌 ' : ''}
                  {b.title}
                </Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {AUTO_BANNER_KIND_LABELS[b.kind]} · skor {b.score ?? 0} · m
                  {b.milestone ?? 1} · {b.metric_value} coin
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {b.active ? 'Aktif' : 'Kapalı'} · bitiş{' '}
                  {new Date(b.expires_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            </View>
            <View style={styles.aksiyonlar}>
              <Aksiyon
                label={b.pinned ? 'Sabiti kaldır' : 'Sabitle'}
                onPress={() => {
                  void (async () => {
                    try {
                      await AdminAutoBannerPin(b.id, !b.pinned);
                      await yukle();
                    } catch (e) {
                      Alert.alert(
                        'Hata',
                        e instanceof Error ? e.message : 'Pin başarısız',
                      );
                    }
                  })();
                }}
              />
              <Aksiyon
                label="Öncelik+"
                onPress={() => {
                  void (async () => {
                    try {
                      await AdminAutoBannerOncelik(
                        b.id,
                        (b.admin_priority ?? 0) + 10,
                      );
                      await yukle();
                    } catch (e) {
                      Alert.alert(
                        'Hata',
                        e instanceof Error ? e.message : 'Öncelik başarısız',
                      );
                    }
                  })();
                }}
              />
              <Aksiyon
                label="+12s TTL"
                onPress={() => {
                  void (async () => {
                    try {
                      await AdminAutoBannerTtlUzat(b.id, 12);
                      await yukle();
                    } catch (e) {
                      Alert.alert(
                        'Hata',
                        e instanceof Error ? e.message : 'TTL uzatılamadı',
                      );
                    }
                  })();
                }}
              />
              {b.active ? (
                <Aksiyon label="Kapat" danger onPress={() => bannerKapat(b.id)} />
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function MudahaleBtn({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.mudahaleBtn, danger && styles.mudahaleDanger]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={14}
        color={danger ? RenkTokenlari.danger : RenkTokenlari.text}
      />
      <Text
        style={[
          styles.mudahaleYazi,
          danger && { color: RenkTokenlari.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Aksiyon({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={[styles.aksiyon, danger && { borderColor: RenkTokenlari.danger }]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.aksiyonYazi,
          danger && { color: RenkTokenlari.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SayiSatiri({
  etiket,
  deger,
  onChange,
  onBlur,
  acik,
  onAcik,
}: {
  etiket: string;
  deger: number;
  onChange: (t: string) => void;
  onBlur: () => void;
  acik?: boolean;
  onAcik?: (v: boolean) => void;
}) {
  return (
    <View style={styles.sayiSatir}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.ad}>{etiket}</Text>
        <TextInput
          style={styles.input}
          value={String(deger)}
          keyboardType="number-pad"
          onChangeText={onChange}
          onBlur={onBlur}
          placeholderTextColor={RenkTokenlari.textDim}
        />
      </View>
      {onAcik ? (
        <Switch
          value={!!acik}
          onValueChange={onAcik}
          trackColor={{
            false: RenkTokenlari.surface,
            true: RenkTokenlari.primary,
          }}
          thumbColor={RenkTokenlari.text}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    gap: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.lg,
  },
  bolumBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 16,
  },
  bolumAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: -4,
  },
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: BoslukTokenlari.md,
  },
  kartBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sayiSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ad: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    fontSize: 14,
  },
  meta: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  input: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: RenkTokenlari.surface,
    marginTop: 4,
  },
  mudahale: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mudahaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  mudahaleDanger: {
    borderColor: 'rgba(232,75,106,0.45)',
  },
  mudahaleYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  filtreSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  filtreChip: {
    flexDirection: 'row',
    gap: 6,
  },
  filtreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
  },
  filtreAktif: {
    backgroundColor: 'rgba(232,64,145,0.25)',
  },
  filtreYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  bannerKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 10,
  },
  bannerUst: {
    flexDirection: 'row',
    gap: 10,
  },
  aksiyonlar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aksiyon: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  aksiyonYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
