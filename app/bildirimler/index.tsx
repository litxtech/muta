import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useBildirimler } from '../../src/moduller/bildirimler/baglam/BildirimSaglayici';
import {
  BildirimlerimiListele,
  BildirimSil,
  BildirimleriTopluSil,
  BildirimleriHepsiniSil,
  type UygulamaBildirimi,
} from '../../src/moduller/bildirimler/okuma/BildirimKuyrugumuGetir';
import {
  BildirimHedefYolu,
  BildirimTarihSaat,
} from '../../src/moduller/bildirimler/islemler/BildirimHedefYolu';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../src/i18n/useCeviri';
import type { CeviriAnahtari } from '../../src/i18n/useCeviri';

function kategoriEtiketi(
  cat: string,
  t: (key: CeviriAnahtari, opts?: Record<string, unknown>) => string,
) {
  const map: Record<string, CeviriAnahtari> = {
    gifts: 'bildirimler.kategoriHediye',
    live: 'bildirimler.kategoriCanli',
    rooms: 'bildirimler.kategoriOda',
    social: 'bildirimler.kategoriSosyal',
    wallet: 'bildirimler.kategoriCuzdan',
    system: 'bildirimler.kategoriSistem',
  };
  const key = map[cat];
  return key ? t(key) : cat;
}

function gonderenAdi(
  item: UygulamaBildirimi,
  t: (key: CeviriAnahtari, opts?: Record<string, unknown>) => string,
): string {
  if (item.actor_name?.trim()) return item.actor_name.trim();
  if (item.actor_username?.trim()) return `@${item.actor_username.trim()}`;
  if (item.category === 'system') return 'Tamuso';
  if (item.category === 'wallet') return t('bildirimler.kategoriCuzdan');
  return item.title || t('bildirimler.varsayilanBaslik');
}

function UstIkon({
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
      onPress={onPress}
      style={({ pressed }) => [styles.ustIkon, pressed && { opacity: 0.75 }]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={danger ? RenkTokenlari.danger : RenkTokenlari.text}
      />
    </Pressable>
  );
}

export default function BildirimMerkeziEkrani() {
  const { t } = useCeviri();
  const { sayfayiAcincaOkundu, tekOkundu, yenile } = useBildirimler();
  const [items, setItems] = useState<UygulamaBildirimi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secimModu, setSecimModu] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [siliniyor, setSiliniyor] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await BildirimlerimiListele(60));
    } catch {
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let iptal = false;
      void (async () => {
        await sayfayiAcincaOkundu();
        if (!iptal) await load();
      })();
      return () => {
        iptal = true;
        setSecimModu(false);
        setSecili(new Set());
      };
    }, [load, sayfayiAcincaOkundu]),
  );

  const secimModunuKapat = useCallback(() => {
    setSecimModu(false);
    setSecili(new Set());
  }, []);

  const secimModunuAc = useCallback(() => {
    setSecimModu(true);
    setSecili(new Set());
  }, []);

  const toggleSec = useCallback((id: string) => {
    setSecili((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const hepsiniSec = useCallback(() => {
    setSecili(new Set(items.map((x) => x.id)));
  }, [items]);

  const ac = (item: UygulamaBildirimi) => {
    if (secimModu) {
      toggleSec(item.id);
      return;
    }
    void tekOkundu(item.id);
    setItems((prev) =>
      prev.map((x) =>
        x.id === item.id
          ? { ...x, read_at: x.read_at ?? new Date().toISOString() }
          : x,
      ),
    );
    const hedef = BildirimHedefYolu({
      deep_link: item.deep_link,
      category: item.category,
      payload: item.payload,
      actor_id: item.actor_id,
    });
    if (hedef) {
      router.push(hedef as any);
    }
  };

  const tekSil = useCallback(
    (item: UygulamaBildirimi) => {
      Alert.alert(t('bildirimler.silBaslik'), t('bildirimler.silSoru'), [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('ortak.sil'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setSiliniyor(true);
                await BildirimSil(item.id);
                setItems((prev) => prev.filter((x) => x.id !== item.id));
                setSecili((prev) => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
                await yenile();
              } catch {
                Alert.alert(t('ortak.hata'), t('bildirimler.silinemedi'));
              } finally {
                setSiliniyor(false);
              }
            })();
          },
        },
      ]);
    },
    [yenile, t],
  );

  const secilenleriSil = useCallback(() => {
    const ids = Array.from(secili);
    if (ids.length === 0) return;
    Alert.alert(
      t('bildirimler.secilenleriSil'),
      t('bildirimler.secilenleriSilSoru', { count: ids.length }),
      [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('ortak.sil'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setSiliniyor(true);
                await BildirimleriTopluSil(ids);
                const silinen = new Set(ids);
                setItems((prev) => prev.filter((x) => !silinen.has(x.id)));
                secimModunuKapat();
                await yenile();
              } catch {
                Alert.alert(t('ortak.hata'), t('bildirimler.silinemediCoklu'));
              } finally {
                setSiliniyor(false);
              }
            })();
          },
        },
      ],
    );
  }, [secili, secimModunuKapat, yenile, t]);

  const tumunuSil = useCallback(() => {
    if (items.length === 0) return;
    Alert.alert(
      t('bildirimler.tumunuSil'),
      t('bildirimler.tumunuSilSoru'),
      [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('bildirimler.tumunuSil'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setSiliniyor(true);
                await BildirimleriHepsiniSil();
                setItems([]);
                secimModunuKapat();
                await yenile();
              } catch {
                Alert.alert(t('ortak.hata'), t('bildirimler.silinemediCoklu'));
              } finally {
                setSiliniyor(false);
              }
            })();
          },
        },
      ],
    );
  }, [items.length, secimModunuKapat, yenile, t]);

  const seciliSayisi = secili.size;
  const tumuSecili = useMemo(
    () => items.length > 0 && seciliSayisi === items.length,
    [items.length, seciliSayisi],
  );

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="bildirimler">
        <EkranBasligi
          title={
            secimModu
              ? t('bildirimler.secili', { count: seciliSayisi })
              : t('bildirimler.baslik')
          }
          right={
            <View style={styles.ustAksiyonlar}>
              {secimModu ? (
                <>
                  <UstIkon
                    icon={tumuSecili ? 'checkbox' : 'checkbox-outline'}
                    label={
                      tumuSecili
                        ? t('bildirimler.secimiKaldir')
                        : t('bildirimler.tumunuSec')
                    }
                    onPress={() => {
                      if (tumuSecili) setSecili(new Set());
                      else hepsiniSec();
                    }}
                  />
                  <UstIkon
                    icon="trash-outline"
                    label={
                      seciliSayisi > 0
                        ? t('bildirimler.secilenleriSil')
                        : t('bildirimler.tumunuSil')
                    }
                    danger
                    onPress={() => {
                      if (seciliSayisi > 0) secilenleriSil();
                      else tumunuSil();
                    }}
                  />
                  <UstIkon
                    icon="close"
                    label={t('bildirimler.secimiKapat')}
                    onPress={secimModunuKapat}
                  />
                </>
              ) : (
                <>
                  {items.length > 0 ? (
                    <UstIkon
                      icon="trash-outline"
                      label={t('bildirimler.silBaslik')}
                      danger
                      onPress={secimModunuAc}
                    />
                  ) : null}
                  <UstIkon
                    icon="flag-outline"
                    label={t('bildirimler.raporlarim')}
                    onPress={() => router.push('/raporlarim' as any)}
                  />
                  <UstIkon
                    icon="options-outline"
                    label={t('bildirimler.ayarlar')}
                    onPress={() => router.push('/bildirim-ayarlari' as any)}
                  />
                </>
              )}
            </View>
          }
        />
        <View style={styles.content}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={yukleniyor || siliniyor}
            onRefresh={() => {
              setYukleniyor(true);
              void load();
            }}
            ListEmptyComponent={
              yukleniyor ? null : (
                <BosDurum
                  icon="notifications-outline"
                  title={t('bildirimler.bos')}
                  body={t('bildirimler.bosBody')}
                />
              )
            }
            renderItem={({ item }) => {
              const okunmadi = !item.read_at;
              const ad = gonderenAdi(item, t);
              const zs = BildirimTarihSaat(item.created_at);
              const hedefVar = !!BildirimHedefYolu({
                deep_link: item.deep_link,
                category: item.category,
                payload: item.payload,
                actor_id: item.actor_id,
              });
              const secildi = secili.has(item.id);

              return (
                <Pressable
                  style={[
                    styles.card,
                    okunmadi && styles.cardUnread,
                    secildi && styles.cardSecili,
                  ]}
                  onPress={() => ac(item)}
                  onLongPress={() => {
                    if (!secimModu) {
                      setSecimModu(true);
                      setSecili(new Set([item.id]));
                    } else {
                      tekSil(item);
                    }
                  }}
                  delayLongPress={350}
                >
                  {secimModu ? (
                    <View style={styles.secimKutu}>
                      <Ionicons
                        name={secildi ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={
                          secildi
                            ? RenkTokenlari.primarySoft
                            : RenkTokenlari.textDim
                        }
                      />
                    </View>
                  ) : null}

                  <View style={styles.avatarWrap}>
                    <ProfilAvatarKucuk
                      size={48}
                      displayName={ad}
                      username={item.actor_username}
                      avatarUrl={item.actor_avatar_url}
                    />
                    {okunmadi ? <View style={styles.nokta} /> : null}
                  </View>

                  <View style={styles.cardGovde}>
                    <View style={styles.cardUst}>
                      <Text
                        style={[styles.isim, okunmadi && styles.isimUnread]}
                        numberOfLines={1}
                      >
                        {ad}
                      </Text>
                      {!secimModu ? (
                        <Pressable
                          onPress={() => tekSil(item)}
                          hitSlop={8}
                          style={styles.satirSil}
                          accessibilityRole="button"
                          accessibilityLabel={t('bildirimler.silBaslik')}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={RenkTokenlari.textDim}
                          />
                        </Pressable>
                      ) : (
                        <Text style={styles.saat}>{zs.saat}</Text>
                      )}
                    </View>

                    <Text
                      style={[styles.baslik, okunmadi && styles.baslikUnread]}
                      numberOfLines={2}
                    >
                      {item.title !== ad ? item.title : item.body || item.title}
                    </Text>

                    {item.body && item.title !== ad ? (
                      <Text style={styles.body} numberOfLines={2}>
                        {item.body}
                      </Text>
                    ) : null}

                    <View style={styles.metaSatir}>
                      <Text style={styles.meta}>
                        {kategoriEtiketi(item.category, t)}
                        {zs.tarih ? ` · ${zs.tarih}` : ''}
                        {zs.saat ? ` · ${zs.saat}` : ''}
                      </Text>
                      {!secimModu && hedefVar ? (
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={RenkTokenlari.textDim}
                        />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  ustAksiyonlar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ustIkon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.chipFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  list: { paddingBottom: BoslukTokenlari.xxxl, gap: BoslukTokenlari.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cardUnread: {
    borderColor: `${RenkTokenlari.primarySoft}55`,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  cardSecili: {
    borderColor: RenkTokenlari.primarySoft,
  },
  secimKutu: {
    paddingTop: 12,
    width: 24,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  nokta: {
    position: 'absolute',
    right: -1,
    top: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RenkTokenlari.primarySoft,
    borderWidth: 2,
    borderColor: RenkTokenlari.bgElevated,
  },
  cardGovde: { flex: 1, minWidth: 0, gap: 3 },
  cardUst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  isim: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    flex: 1,
  },
  isimUnread: {
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  saat: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  satirSil: {
    padding: 4,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  baslikUnread: {
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  body: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    lineHeight: 17,
  },
  metaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 6,
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    flex: 1,
  },
});
