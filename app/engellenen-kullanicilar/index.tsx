import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { BosDurum } from '../../src/components/BosDurum';
import {
  EngellenenKullanicilariGetir,
  KullaniciEngeliKaldir,
  type EngellenenKullanici,
} from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { MedyaUriGuvenli } from '../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

/** Profil ayarlari: engellenenler + engeli kaldir (Apple/Google) */
export default function EngellenenKullanicilarEkrani() {
  const [liste, setListe] = useState<EngellenenKullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      setListe(await EngellenenKullanicilariGetir());
    } catch {
      setListe([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const kaldir = (item: EngellenenKullanici) => {
    const ad = item.display_name || item.username || 'Kullanıcı';
    Alert.alert('Engeli kaldır', `${ad} artık seni bulabilir ve mesaj atabilir.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        onPress: () => {
          void (async () => {
            setBusyId(item.blocked_id);
            const r = await KullaniciEngeliKaldir(item.blocked_id);
            setBusyId(null);
            if (!r.ok) {
              Alert.alert('Hata', r.hata ?? 'Kaldırılamadı');
              return;
            }
            await yukle();
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Engellenen kullanıcılar"
        subtitle="Engeli buradan kaldırabilirsin"
        fallbackHref={'/profil-ayarlar' as any}
      />
      {loading ? (
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(item) => item.blocked_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BosDurum
              icon="hand-left-outline"
              title="Engellenen yok"
              body="Birini engellediğinde burada listelenir."
            />
          }
          renderItem={({ item }) => {
            const ad = item.display_name || item.username || 'Kullanıcı';
            const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
            const avatar = MedyaUriGuvenli(item.avatar_url);
            return (
              <View style={styles.row}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[RenkTokenlari.primary, RenkTokenlari.deepPlum]}
                    style={styles.avatar}
                  >
                    <Text style={styles.harf}>{harf}</Text>
                  </LinearGradient>
                )}
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {ad}
                  </Text>
                  {item.username ? (
                    <Text style={styles.user} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.btn}
                  onPress={() => kaldir(item)}
                  disabled={busyId === item.blocked_id}
                >
                  <Text style={styles.btnText}>
                    {busyId === item.blocked_id ? '…' : 'Engeli kaldır'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: { fontSize: 18, fontWeight: '800', color: '#fff' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  user: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  btn: {
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.mint,
  },
  btnText: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
});
