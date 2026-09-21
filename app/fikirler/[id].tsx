import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { FikirDurumRozeti } from '../../src/moduller/fikir-geri-bildirim/bilesenler/FikirDurumRozeti';
import { FikirZamanCizelgesi } from '../../src/moduller/fikir-geri-bildirim/bilesenler/FikirZamanCizelgesi';
import {
  FikirDestekToggle,
  FikirDetayGetir,
} from '../../src/moduller/fikir-geri-bildirim/islemler/FikirIslemleri';
import { useFikirKanali } from '../../src/moduller/fikir-geri-bildirim/gercek-zamanli/useFikirKanali';
import type { FikirDetay } from '../../src/moduller/fikir-geri-bildirim/tipler';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function FikirDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fikir, setFikir] = useState<FikirDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [oyIslem, setOyIslem] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setFikir(await FikirDetayGetir(id));
      setHata(null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
      setFikir(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setYukleniyor(true);
      void load();
    }, [load]),
  );

  useFikirKanali(id, () => {
    void load();
  });

  const destekle = async () => {
    if (!id || !fikir?.is_public || oyIslem) return;
    setOyIslem(true);
    try {
      const r = await FikirDestekToggle(id);
      setFikir((prev) =>
        prev
          ? { ...prev, i_voted: r.voted, vote_count: r.vote_count }
          : prev,
      );
    } catch {
      /* ignore */
    } finally {
      setOyIslem(false);
    }
  };

  return (
    <Screen>
      <ModulHataSiniri modulAdi="fikir-detay">
        <EkranBasligi
          title="Fikir detayı"
          subtitle="Durum · ekip cevabı"
          onBack={() => router.back()}
        />
        {yukleniyor && !fikir ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : hata ? (
          <Text style={styles.hata}>{hata}</Text>
        ) : fikir ? (
          <ScrollView
            contentContainerStyle={styles.govde}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor}
                onRefresh={() => void load()}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
          >
            <View style={styles.ustSatir}>
              <View style={styles.kat}>
                <Ionicons
                  name={(fikir.category.icon as any) || 'bulb-outline'}
                  size={16}
                  color={RenkTokenlari.primarySoft}
                />
                <Text style={styles.katYazi}>{fikir.category.name}</Text>
              </View>
              <FikirDurumRozeti
                status={fikir.status}
                label={fikir.status_label}
              />
            </View>

            <Text style={styles.baslik}>{fikir.title}</Text>

            {fikir.status === 'COMPLETED' ? (
              <View style={styles.tamamlandi}>
                <Text style={styles.tamamlandiBaslik}>✨ HAYATA GEÇİRİLDİ</Text>
                <Text style={styles.tamamlandiAlt}>
                  Bu öneri Tamuso'ya eklendi.
                </Text>
                {fikir.is_mine ? (
                  <Text style={styles.katki}>✨ Tamuso'ya Katkıda Bulundu</Text>
                ) : null}
              </View>
            ) : null}

            {fikir.description ? (
              <Text style={styles.aciklama}>{fikir.description}</Text>
            ) : null}

            {fikir.attachments?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {fikir.attachments.map((a) => (
                  <Image
                    key={a.id}
                    source={{ uri: a.public_url }}
                    style={styles.gorsel}
                  />
                ))}
              </ScrollView>
            ) : null}

            {fikir.is_public ? (
              <Pressable
                style={[styles.destekBtn, fikir.i_voted && styles.destekAktif]}
                onPress={() => void destekle()}
                disabled={oyIslem}
              >
                <Ionicons
                  name={fikir.i_voted ? 'bulb' : 'bulb-outline'}
                  size={18}
                  color={fikir.i_voted ? RenkTokenlari.accent : RenkTokenlari.text}
                />
                <Text style={styles.destekYazi}>
                  {fikir.i_voted ? 'Desteğini kaldır' : 'Bu fikri destekliyorum'}
                </Text>
                <Text style={styles.destekSayi}>
                  💡 {fikir.vote_count.toLocaleString('tr-TR')} kişi destekliyor
                </Text>
              </Pressable>
            ) : null}

            <FikirZamanCizelgesi items={fikir.timeline} />

            {fikir.admin_replies?.length ? (
              <View style={styles.cevapBlok}>
                <Text style={styles.bolum}>Tamuso Ekibi</Text>
                {fikir.admin_replies.map((r) => (
                  <View key={r.id} style={styles.cevapKart}>
                    <View style={styles.rozet}>
                      <Text style={styles.rozetYazi}>Tamuso Ekibi</Text>
                    </View>
                    <Text style={styles.cevapGovde}>{r.body}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {fikir.rewards?.length ? (
              <View style={styles.odulBlok}>
                <Text style={styles.bolum}>Tamuso Katkı Ödülü</Text>
                {fikir.rewards.map((rw) => (
                  <View key={rw.id} style={styles.odulKart}>
                    <Text style={styles.odulYazi}>
                      {rw.reward_type === 'coin'
                        ? `+${Number(rw.reward_amount ?? 0).toLocaleString('tr-TR')} Coin`
                        : '🏅 Tamuso Katkıcısı Rozeti'}
                    </Text>
                    {rw.user_message ? (
                      <Text style={styles.odulNot}>{rw.user_message}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  govde: {
    padding: BoslukTokenlari.md,
    gap: BoslukTokenlari.md,
    paddingBottom: 48,
  },
  hata: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    padding: BoslukTokenlari.md,
  },
  ustSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  kat: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  katYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  aciklama: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 22,
  },
  gorsel: {
    width: 160,
    height: 120,
    borderRadius: YaricapTokenlari.md,
    marginRight: 10,
    backgroundColor: RenkTokenlari.surface,
  },
  destekBtn: {
    gap: 6,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  destekAktif: { borderColor: RenkTokenlari.accent + '66' },
  destekYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  destekSayi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  tamamlandi: {
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.mint + '18',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.mint + '55',
    gap: 4,
  },
  tamamlandiBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.mint,
    fontWeight: '800',
  },
  tamamlandiAlt: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
  katki: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    marginTop: 4,
    fontWeight: '600',
  },
  bolum: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    marginBottom: 6,
  },
  cevapBlok: { gap: 8 },
  cevapKart: {
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.lg,
    padding: 12,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.violet + '44',
  },
  rozet: {
    alignSelf: 'flex-start',
    backgroundColor: RenkTokenlari.violet + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  rozetYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.violet,
    fontWeight: '700',
  },
  cevapGovde: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  odulBlok: { gap: 8 },
  odulKart: {
    padding: 12,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.accent + '14',
    gap: 4,
  },
  odulYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  odulNot: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
});
