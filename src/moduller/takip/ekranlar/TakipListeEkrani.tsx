import React, { useCallback, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
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
import { GizlilikAyarlariniKullaniciIcinGetir } from '../../ayarlar/islemler/GizlilikAyarlariniYonet';
import { KullaniciGuvenlikMenusu } from '../../moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import { useCeviri } from '../../../i18n/useCeviri';

export function TakipListeEkrani({
  userId,
  tur,
  title,
}: {
  userId: string;
  tur: TakipListeTuru;
  title: string;
}) {
  const { t } = useCeviri();
  const { user, isGuest } = useAuth();
  const liste = useTakipListesi({ userId, tur });
  const kendi = user?.id === userId;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [istekSayisi, setIstekSayisi] = useState(0);
  const [listeGizli, setListeGizli] = useState(false);
  const [menuHedef, setMenuHedef] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (kendi || !userId) {
        setListeGizli(false);
        return;
      }
      void GizlilikAyarlariniKullaniciIcinGetir(userId)
        .then((g) => {
          setListeGizli(
            tur === 'followers' ? g.hide_followers : g.hide_following,
          );
        })
        .catch(() => setListeGizli(false));
    }, [kendi, userId, tur]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!kendi || tur !== 'followers') {
        setIstekSayisi(0);
        return;
      }
      void TakipServisi.istekler()
        .then((page) => setIstekSayisi(page.items.length))
        .catch(() => setIstekSayisi(0));
    }, [kendi, tur]),
  );

  const followToggle = async (
    targetId: string,
    currentlyFollowing: boolean,
    username?: string | null,
  ) => {
    if (isGuest) {
      Alert.alert(t('profil.takip'), t('takip.hataGuest'));
      return;
    }
    const calis = async () => {
      setBusyId(targetId);
      const r = currentlyFollowing
        ? await TakipServisi.takiptenCik(targetId)
        : await TakipServisi.takipEt(targetId);
      setBusyId(null);
      if (!r.ok) {
        Alert.alert(t('profil.takip'), r.hata ?? TakipHataMesaji(r.code));
        return;
      }
      if (user?.id) TakipServisi.cacheInvalidatePair(user.id, targetId);
      const following =
        r.code === 'followed' ||
        r.code === 'already_following' ||
        r.state === 'FOLLOWING' ||
        r.state === 'MUTUAL';
      const pending = r.code === 'requested' || r.state === 'REQUEST_PENDING';
      liste.kartGuncelle(targetId, {
        i_follow: following,
        is_mutual: r.state === 'MUTUAL',
        state:
          r.state ??
          (pending
            ? 'REQUEST_PENDING'
            : following
              ? 'FOLLOWING'
              : 'NOT_FOLLOWING'),
      });
    };
    if (currentlyFollowing) {
      takiptenCikOnayi(username, () => void calis());
      return;
    }
    await calis();
  };

  const kaldir = (targetId: string, name: string) => {
    Alert.alert(
      t('takip.takipciyiKaldir'),
      t('takip.takipciyiKaldirSoru', { ad: name }),
      [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('takip.kaldirBaslik'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(targetId);
              const r = await TakipServisi.takipciKaldir(targetId);
              setBusyId(null);
              if (!r.ok) {
                Alert.alert(t('takip.kaldirBaslik'), r.hata ?? TakipHataMesaji(r.code));
                return;
              }
              TakipAnalitik('follower_removed');
              liste.kartCikar(targetId);
            })();
          },
        },
      ],
    );
  };

  const istekBaslik =
    kendi && tur === 'followers' ? (
      <Pressable
        onPress={() => router.push('/takip/istekler' as any)}
        style={({ pressed }) => [
          styles.istekBanner,
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('takip.takipIstekleri')}
      >
        <View style={styles.istekSol}>
          <Ionicons
            name="mail-unread-outline"
            size={20}
            color={RenkTokenlari.primarySoft}
          />
          <View style={styles.istekCopy}>
            <Text style={styles.istekBaslik}>{t('takip.takipIstekleri')}</Text>
            <Text style={styles.istekAlt}>
              {istekSayisi > 0
                ? t('takip.bekleyenIstek', { count: istekSayisi })
                : t('takip.gizliIstekAlt')}
            </Text>
          </View>
        </View>
        <View style={styles.istekSag}>
          {istekSayisi > 0 ? (
            <View style={styles.istekRozet}>
              <Text style={styles.istekRozetYazi}>{istekSayisi}</Text>
            </View>
          ) : null}
          <Ionicons
            name="chevron-forward"
            size={16}
            color={RenkTokenlari.textDim}
          />
        </View>
      </Pressable>
    ) : null;

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="takip">
        <EkranBasligi title={title} />
        {listeGizli ? (
          <BosDurum
            title={t('takip.listeGizli')}
            body={
              tur === 'followers'
                ? t('takip.takipciGizli')
                : t('takip.takipGizli')
            }
          />
        ) : (
        <>
        <View style={styles.arama}>
          <Ionicons name="search" size={16} color={RenkTokenlari.textMuted} />
          <TextInput
            value={liste.query}
            onChangeText={liste.ara}
            placeholder={
              tur === 'followers'
                ? t('takip.takipcilerdeAra')
                : t('takip.takipEdilenlerdeAra')
            }
            placeholderTextColor={RenkTokenlari.textMuted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {liste.yukleniyor && !liste.items.length ? (
          <ActivityIndicator
            color={RenkTokenlari.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={liste.items}
            keyExtractor={(i) => i.user_id}
            onEndReached={liste.dahaYukle}
            onEndReachedThreshold={0.4}
            refreshing={liste.yukleniyor}
            onRefresh={liste.yenile}
            ListHeaderComponent={istekBaslik}
            ListEmptyComponent={
              liste.hata ? (
                <BosDurum
                  icon="warning-outline"
                  title={t('takip.listeYuklenemedi')}
                  body={liste.hata}
                />
              ) : (
                <BosDurum
                  icon="people-outline"
                  title={
                    tur === 'followers'
                      ? t('takip.takipciYok')
                      : t('takip.takipEdilenYok')
                  }
                />
              )
            }
            ListFooterComponent={
              liste.dahaYukleniyor ? (
                <ActivityIndicator
                  color={RenkTokenlari.primarySoft}
                  style={{ margin: 16 }}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <TakipciKarti
                kart={item}
                followLoading={busyId === item.user_id}
                onPress={() =>
                  router.push(`/kullanici/${item.user_id}` as any)
                }
                onFollowPress={() =>
                  void followToggle(
                    item.user_id,
                    item.state === 'FOLLOWING' || item.state === 'MUTUAL',
                    item.username,
                  )
                }
                onMenuPress={
                  kendi && tur === 'followers'
                    ? () =>
                        setMenuHedef({
                          userId: item.user_id,
                          name: item.display_name,
                        })
                    : undefined
                }
              />
            )}
          />
        )}
        </>
        )}
        <KullaniciGuvenlikMenusu
          visible={!!menuHedef}
          targetUserId={menuHedef?.userId ?? ''}
          targetName={menuHedef?.name}
          isGuest={isGuest}
          contentType="user"
          contentId={menuHedef?.userId}
          onClose={() => setMenuHedef(null)}
          onTakipciKaldir={
            menuHedef
              ? () => kaldir(menuHedef.userId, menuHedef.name)
              : undefined
          }
          onBlocked={() => {
            if (menuHedef) liste.kartCikar(menuHedef.userId);
            setMenuHedef(null);
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

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
  istekBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 10,
  },
  istekSol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  istekCopy: { flex: 1, minWidth: 0, gap: 2 },
  istekBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  istekAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  istekSag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  istekRozet: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  istekRozetYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
  },
});
