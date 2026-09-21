import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TakipSayaclari } from './TakipSayaclari';
import { TakipButonu } from './TakipButonu';
import { IliskiEtiketi } from './IliskiEtiketi';
import { OrtakTakipciler } from './OrtakTakipciler';
import { takiptenCikOnayi } from './TakipOnaySheet';
import { useTakipDurumu } from '../kancalar/useTakipDurumu';
import { useTakipMutasyonu } from '../kancalar/useTakipEt';
import { useTakipRealtime } from '../gercek-zamanli/useTakipRealtime';
import { TakipServisi } from '../islemler/TakipServisi';
import { TakipHataMesaji } from '../TakipHataMesajlari';
import type { OrtakTakipciOzeti } from '../TakipTipleri';

export function ProfilSosyalAlani({
  targetUserId,
  viewerId,
  isSelf,
  isGuest,
  displayName,
  username,
  isVerified,
  onMesaj,
}: {
  targetUserId: string;
  viewerId?: string | null;
  isSelf: boolean;
  isGuest?: boolean;
  displayName: string;
  username?: string | null;
  isVerified?: boolean;
  onMesaj?: () => void;
}) {
  const { durum, setDurum, yenile } = useTakipDurumu(targetUserId);
  const { calistir, isleniyor } = useTakipMutasyonu({
    targetUserId,
    viewerId,
    durum,
    setDurum,
  });
  const [ortak, setOrtak] = useState<OrtakTakipciOzeti | null>(null);

  useTakipRealtime({
    userId: isSelf ? viewerId : null,
    onChange: yenile,
  });

  useEffect(() => {
    if (isSelf || !viewerId) return;
    void TakipServisi.ortakOzet(targetUserId, viewerId)
      .then(setOrtak)
      .catch(() => setOrtak(null));
  }, [isSelf, targetUserId, viewerId]);

  const listeAc = (tur: 'followers' | 'following') => {
    const path =
      tur === 'followers'
        ? `/takip/takipciler?userId=${targetUserId}`
        : `/takip/takip-edilenler?userId=${targetUserId}`;
    router.push(path as any);
  };

  const takipBas = useCallback(() => {
    if (isGuest) {
      Alert.alert('Takip', 'Takip için hesabını tamamla.');
      return;
    }
    const st = durum?.state;
    if (st === 'FOLLOWING' || st === 'MUTUAL') {
      takiptenCikOnayi(username, () => {
        void calistir('unfollow').then((r) => {
          if (!r.ok) Alert.alert('Takip', r.hata ?? TakipHataMesaji(r.code));
        });
      });
      return;
    }
    if (st === 'REQUEST_PENDING') {
      Alert.alert('İstek gönderildi', 'Takip isteğini iptal etmek istiyor musun?', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal et',
          onPress: () => {
            void calistir('cancel').then((r) => {
              if (!r.ok) Alert.alert('Takip', r.hata ?? TakipHataMesaji(r.code));
            });
          },
        },
      ]);
      return;
    }
    void calistir('follow').then((r) => {
      if (!r.ok) Alert.alert('Takip', r.hata ?? TakipHataMesaji(r.code));
    });
  }, [calistir, durum?.state, isGuest, username]);

  return (
    <View style={styles.wrap}>
      <View style={styles.adSatir}>
        {isVerified ? (
          <Ionicons name="checkmark-circle" size={18} color={RenkTokenlari.mint} />
        ) : null}
      </View>
      {durum && !isSelf ? (
        <IliskiEtiketi
          state={durum.state}
          followsYou={durum.state === 'FOLLOWS_YOU'}
          isMutual={durum.state === 'MUTUAL'}
        />
      ) : null}

      <TakipSayaclari
        posts={durum?.posts_count ?? 0}
        followers={durum?.followers_count ?? 0}
        following={durum?.following_count ?? 0}
        onFollowers={() => listeAc('followers')}
        onFollowing={() => listeAc('following')}
      />

      {!isSelf ? <OrtakTakipciler ozet={ortak} /> : null}

      {isSelf ? (
        <View style={styles.selfRow}>
          {(durum?.pending_follow_requests_count ?? 0) > 0 ? (
            <Pressable
              style={styles.istekBtn}
              onPress={() => router.push('/takip/istekler' as any)}
            >
              <Text style={styles.istekYazi}>
                {durum?.pending_follow_requests_count} takip isteği
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : durum?.state !== 'BLOCKED' && durum?.state !== 'BLOCKED_BY_USER' ? (
        <View style={styles.aksiyon}>
          <TakipButonu
            state={durum?.state ?? 'NOT_FOLLOWING'}
            displayName={displayName}
            loading={isleniyor}
            onPress={takipBas}
          />
          {onMesaj ? (
            <Pressable
              style={styles.mesaj}
              onPress={onMesaj}
              accessibilityRole="button"
              accessibilityLabel={`${displayName} kullanıcısına mesaj gönder`}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color={RenkTokenlari.text}
              />
              <Text style={styles.mesajYazi}>Mesaj</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.engelKutu}>
          <Text style={styles.engel}>Bu hesapla ilişkin engellenmiş.</Text>
          <Text style={styles.engelAlt}>
            Mesaj, arama ve takip kapalı. Engeli Ayarlar → Engellenen kullanıcılar’dan
            kaldırabilirsin.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  adSatir: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selfRow: { width: '100%', marginTop: BoslukTokenlari.md },
  istekBtn: {
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    alignItems: 'center',
  },
  istekYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  aksiyon: { width: '100%', gap: BoslukTokenlari.sm, marginTop: BoslukTokenlari.lg },
  mesaj: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  mesajYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  engel: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  engelKutu: {
    marginTop: BoslukTokenlari.md,
    width: '100%',
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.danger + '55',
    backgroundColor: RenkTokenlari.danger + '12',
    gap: 6,
  },
  engelAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
});
