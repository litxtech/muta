import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
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
import {
  RaporDurumEtiketiKullanici,
  RaporlarimiListele,
  type KullaniciRaporOzeti,
} from '../../src/moduller/moderasyon/okuma/RaporlarimiGetir';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function durumRenk(st: string) {
  switch (st) {
    case 'reviewing':
      return RenkTokenlari.accent;
    case 'resolved':
      return RenkTokenlari.mint;
    case 'dismissed':
      return RenkTokenlari.textMuted;
    default:
      return RenkTokenlari.primarySoft;
  }
}

export default function RaporlarimEkrani() {
  const [items, setItems] = useState<KullaniciRaporOzeti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await RaporlarimiListele(60));
    } catch {
      setItems([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ModulHataSiniri modulAdi="raporlarim">
        <EkranBasligi
          title="RaporlarÄ±m"
          subtitle="Bildirimlerin Â· durum takibi"
          onBack={() => router.back()}
        />
        <View style={styles.ust}>
          <Pressable
            style={styles.chip}
            onPress={() => router.push('/bildir' as any)}
          >
            <Ionicons name="flag-outline" size={16} color={RenkTokenlari.primarySoft} />
            <Text style={styles.chipYazi}>Yeni bildir</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.liste}
          refreshControl={
            <RefreshControl
              refreshing={yukleniyor && items.length > 0}
              onRefresh={() => {
                setYukleniyor(true);
                void load();
              }}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
          ListEmptyComponent={
            yukleniyor ? null : (
              <BosDurum
                title="HenÃ¼z rapor yok"
                body="Bir kullanÄ±cÄ±yÄ± bildirdiÄŸinde durumu burada takip edersin."
              />
            )
          }
          renderItem={({ item }) => {
            const ad =
              item.target?.display_name?.trim() ||
              (item.target?.username
                ? `@${item.target.username}`
                : 'KullanÄ±cÄ±');
            return (
              <Pressable
                style={styles.kart}
                onPress={() => router.push(`/raporlarim/${item.id}` as any)}
              >
                <ProfilAvatarKucuk
                  avatarUrl={item.target?.avatar_url}
                  displayName={item.target?.display_name}
                  username={item.target?.username}
                  size={42}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.baslik} numberOfLines={1}>
                    {ad}
                  </Text>
                  <Text style={styles.alt} numberOfLines={1}>
                    {item.reason}
                  </Text>
                  {item.reporter_note ? (
                    <Text style={styles.not} numberOfLines={1}>
                      {item.reporter_note}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.durum,
                    { borderColor: durumRenk(item.status) },
                  ]}
                >
                  <Text
                    style={[styles.durumYazi, { color: durumRenk(item.status) }]}
                  >
                    {RaporDurumEtiketiKullanici(item.status)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ust: {
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: 8,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
  },
  chipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  liste: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: 40,
    gap: 10,
  },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  not: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
  },
  durum: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
  },
  durumYazi: {
    ...TipografiTokenlari.micro,
    fontWeight: '800',
  },
});
