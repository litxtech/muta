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
  AdminAutoBannerKapat,
  AdminAutoBannerListele,
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
  | 'max_active'
  | 'carousel_max';

/**
 * Olay tabanlı otomatik banner yönetimi — eşikler, TTL, master kapatma.
 */
export function AdminOtomatikBannerPaneli() {
  const [ayar, setAyar] = useState<AutoBannerAyarlari>(AUTO_BANNER_AYAR_VARSAYILAN);
  const [aktifler, setAktifler] = useState<AutoBannerKayit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [a, liste] = await Promise.all([
        AutoBannerAyarlariGetir(),
        AdminAutoBannerListele().catch(() => [] as AutoBannerKayit[]),
      ]);
      setAyar(a);
      setAktifler(liste.filter((x) => x.active));
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
    const sonraki = { ...ayar, ...patch };
    setAyar(sonraki);
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

  const bannerKapat = (id: string) => {
    Alert.alert('Bannerı kapat', 'Bu otomatik banner kaldırılacak.', [
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

  if (yukleniyor && !ayar.updated_at) {
    return <ActivityIndicator color={RenkTokenlari.primary} />;
  }

  return (
    <View style={styles.kok}>
      <Text style={styles.bolumBaslik}>Olay otomatik bannerları</Text>
      <Text style={styles.bolumAlt}>
        Coin eşiği, koltuk dolu ve oyun harcamasında oluşur. Kaynak kapanınca veya
        TTL bitince kalkar. Sağa-sola kaydırarak gezilir.
      </Text>

      <View style={styles.kart}>
        <View style={styles.satir}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.ad}>Otomatik banner sistemi</Text>
            <Text style={styles.meta}>
              Kapalıyken yeni banner oluşmaz; aktifler temizlenir
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

      <View style={styles.kart}>
        <Text style={styles.kartBaslik}>Eşikler</Text>
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

      <Text style={styles.bolumBaslik}>
        Aktif otomatik ({aktifler.length})
      </Text>
      {aktifler.length === 0 ? (
        <Text style={styles.meta}>Şu an aktif olay bannerı yok.</Text>
      ) : (
        aktifler.map((b) => (
          <View key={b.id} style={styles.bannerSatir}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.ad} numberOfLines={1}>
                {b.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {AUTO_BANNER_KIND_LABELS[b.kind]} · {b.metric_value} ·{' '}
                {new Date(b.expires_at).toLocaleString('tr-TR')}
              </Text>
            </View>
            <Pressable
              style={styles.kapatBtn}
              onPress={() => bannerKapat(b.id)}
              accessibilityLabel="Bannerı kapat"
            >
              <Ionicons name="close" size={16} color={RenkTokenlari.text} />
            </Pressable>
          </View>
        ))
      )}
    </View>
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
  bannerSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  kapatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
});
