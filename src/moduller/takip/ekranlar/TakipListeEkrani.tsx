import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { EkranBasligi } from '../../../components/EkranBasligi';
import { BosDurum } from '../../../components/BosDurum';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../../contexts/AuthContext';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TakipciKarti } from '../bilesenler/TakipciKarti';
import { takiptenCikOnayi } from '../bilesenler/TakipOnaySheet';
import { useTakipListesi } from '../kancalar/useTakipciler';
import { TakipServisi } from '../islemler/TakipServisi';
import { TakipAnalitik } from '../analytics/TakipAnalytics';
import { TakipHataMesaji } from '../TakipHataMesajlari';
import type { TakipListeTuru } from '../TakipTipleri';

export function TakipListeEkrani({
  userId,
  tur,
  title,
}: {
  userId: string;
  tur: TakipListeTuru;
  title: string;
}) {
  const { user, isGuest } = useAuth();
  const liste = useTakipListesi({ userId, tur });
  const kendi = user?.id === userId;
  const [busyId, setBusyId] = useState<string | null>(null);

  const followToggle = async (targetId: string, currentlyFollowing: boolean, username?: string | null) => {
    if (isGuest) {
      Alert.alert('Takip', 'Takip için hesabını tamamla.');
      return;
    }
    const calis = async () => {
      setBusyId(targetId);
      const r = currentlyFollowing
        ? await TakipServisi.takiptenCik(targetId)
        : await TakipServisi.takipEt(targetId);
      setBusyId(null);
      if (!r.ok) {
        Alert.alert('Takip', r.hata ?? TakipHataMesaji(r.code));
        return;
      }
      if (user?.id) TakipServisi.cacheInvalidatePair(user.id, targetId);
      const following = r.code === 'followed' || r.code === 'already_following' || r.state === 'FOLLOWING' || r.state === 'MUTUAL';
      const pending = r.code === 'requested' || r.state === 'REQUEST_PENDING';
      liste.kartGuncelle(targetId, {
        i_follow: following,
        is_mutual: r.state === 'MUTUAL',
        state: r.state ?? (pending ? 'REQUEST_PENDING' : following ? 'FOLLOWING' : 'NOT_FOLLOWING'),
      });
    };
    if (currentlyFollowing) {
      takiptenCikOnayi(username, () => void calis());
      return;
    }
    await calis();
  };

  const kaldir = (targetId: string, name: string) => {
    Alert.alert('Takipçiyi kaldır', `${name} senin takipçilerinden çıkarılsın mı?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(targetId);
            const r = await TakipServisi.takipciKaldir(targetId);
            setBusyId(null);
            if (!r.ok) {
              Alert.alert('Kaldır', r.hata ?? TakipHataMesaji(r.code));
              return;
            }
            TakipAnalitik('follower_removed');
            liste.kartCikar(targetId);
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="takip">
        <EkranBasligi title={title} />
        <View style={styles.arama}>
          <Ionicons name="search" size={16} color={RenkTokenlari.textMuted} />
          <TextInput
            value={liste.query}
            onChangeText={liste.ara}
            placeholder={tur === 'followers' ? 'Takipçilerde ara...' : 'Takip edilenlerde ara...'}
            placeholderTextColor={RenkTokenlari.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {liste.yukleniyor && !liste.items.length ? (
          <ActivityIndicator color={RenkTokenlari.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={liste.items}
            keyExtractor={(i) => i.user_id}
            onEndReached={liste.dahaYukle}
            onEndReachedThreshold={0.4}
            refreshing={liste.yukleniyor}
            onRefresh={liste.yenile}
            ListEmptyComponent={
              liste.hata ? (
                <BosDurum icon="warning-outline" title="Liste yüklenemedi" body={liste.hata} />
              ) : (
                <BosDurum
                  icon="people-outline"
                  title={tur === 'followers' ? 'Henüz takipçi yok' : 'Henüz kimseyi takip etmiyor'}
                />
              )
            }
            ListFooterComponent={
              liste.dahaYukleniyor ? (
                <ActivityIndicator color={RenkTokenlari.primarySoft} style={{ margin: 16 }} />
              ) : null
            }
            renderItem={({ item }) => (
              <TakipciKarti
                kart={item}
                followLoading={busyId === item.user_id}
                onPress={() => router.push(`/kullanici/${item.user_id}` as any)}
                onFollowPress={() =>
                  void followToggle(
                    item.user_id,
                    item.state === 'FOLLOWING' || item.state === 'MUTUAL',
                    item.username,
                  )
                }
                onRemove={
                  kendi && tur === 'followers'
                    ? () => kaldir(item.user_id, item.display_name)
                    : undefined
                }
              />
            )}
          />
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

void Pressable;
void Text;
void YaricapTokenlari;

const styles = StyleSheet.create({
  arama: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  input: {
    flex: 1,
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    paddingVertical: 8,
  },
});
