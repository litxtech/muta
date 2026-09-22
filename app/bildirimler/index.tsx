import React, { useCallback, useState } from 'react';
import {
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

function kategoriEtiketi(cat: string) {
  const map: Record<string, string> = {
    messages: 'Mesaj',
    gifts: 'Hediye',
    live: 'Canlı',
    rooms: 'Oda',
    social: 'Sosyal',
    wallet: 'Cüzdan',
    system: 'Sistem',
  };
  return map[cat] ?? cat;
}

function gonderenAdi(item: UygulamaBildirimi): string {
  if (item.actor_name?.trim()) return item.actor_name.trim();
  if (item.actor_username?.trim()) return `@${item.actor_username.trim()}`;
  if (item.category === 'system') return 'Tamuso';
  if (item.category === 'wallet') return 'Cüzdan';
  return item.title || 'Bildirim';
}

function UstIkon({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ustIkon, pressed && { opacity: 0.75 }]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={18} color={RenkTokenlari.text} />
    </Pressable>
  );
}

export default function BildirimMerkeziEkrani() {
  const { sayfayiAcincaOkundu, tekOkundu } = useBildirimler();
  const [items, setItems] = useState<UygulamaBildirimi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

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
      };
    }, [load, sayfayiAcincaOkundu]),
  );

  const ac = (item: UygulamaBildirimi) => {
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

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="bildirimler">
        <EkranBasligi
          title="Bildirimler"
          right={
            <View style={styles.ustAksiyonlar}>
              <UstIkon
                icon="flag-outline"
                label="Raporlarım"
                onPress={() => router.push('/raporlarim' as any)}
              />
              <UstIkon
                icon="options-outline"
                label="Bildirim ayarları"
                onPress={() => router.push('/bildirim-ayarlari' as any)}
              />
            </View>
          }
        />
        <View style={styles.content}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshing={yukleniyor}
            onRefresh={() => {
              setYukleniyor(true);
              void load();
            }}
            ListEmptyComponent={
              yukleniyor ? null : (
                <BosDurum
                  icon="notifications-outline"
                  title="Bildirim yok"
                  body="Mesaj, hediye ve sistem bildirimleri burada görünür."
                />
              )
            }
            renderItem={({ item }) => {
              const okunmadi = !item.read_at;
              const ad = gonderenAdi(item);
              const zs = BildirimTarihSaat(item.created_at);
              const hedefVar = !!BildirimHedefYolu({
                deep_link: item.deep_link,
                category: item.category,
                payload: item.payload,
                actor_id: item.actor_id,
              });

              return (
                <Pressable
                  style={[styles.card, okunmadi && styles.cardUnread]}
                  onPress={() => ac(item)}
                >
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
                      <Text style={styles.saat}>{zs.saat}</Text>
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
                        {kategoriEtiketi(item.category)}
                        {zs.tarih ? ` · ${zs.tarih}` : ''}
                        {zs.saat ? ` · ${zs.saat}` : ''}
                      </Text>
                      {hedefVar ? (
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
