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
import { useCeviri } from '../../../i18n/useCeviri';

export function ProfilSosyalAlani({
  targetUserId,
  viewerId,
  isSelf,
  isGuest,
  displayName,
  username,
  onMesaj,
  gosterTakipci = true,
  gosterTakip = true,
  gosterGonderi = true,
  /** X header: sadece Takip + Mesaj (sayaç / ortak yok) */
  sadeceAksiyon = false,
  /** Sayaçları gizle (X header’da gösteriliyorsa) */
  gosterSayaclar = true,
  /** Takip/Mesaj satırını gizle */
  gosterAksiyon = true,
}: {
  targetUserId: string;
  viewerId?: string | null;
  isSelf: boolean;
  isGuest?: boolean;
  displayName: string;
  username?: string | null;
  /** Geri uyumluluk — tik profil isim satırında; burada kullanılmaz */
  isVerified?: boolean;
  onMesaj?: () => void;
  gosterTakipci?: boolean;
  gosterTakip?: boolean;
  gosterGonderi?: boolean;
  sadeceAksiyon?: boolean;
  gosterSayaclar?: boolean;
  gosterAksiyon?: boolean;
}) {
  const { t } = useCeviri();
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
      Alert.alert(t('profil.takip'), t('takip.hataGuest'));
      return;
    }
    const st = durum?.state;
    if (st === 'FOLLOWING' || st === 'MUTUAL') {
      takiptenCikOnayi(username, () => {
        void calistir('unfollow').then((r) => {
          if (!r.ok) Alert.alert(t('profil.takip'), r.hata ?? TakipHataMesaji(r.code));
        });
      });
      return;
    }
    if (st === 'REQUEST_PENDING') {
      Alert.alert(t('takip.istekGonderildiBaslik'), t('takip.istekIptalSoru'), [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('takip.iptalEt'),
          onPress: () => {
            void calistir('cancel').then((r) => {
              if (!r.ok) Alert.alert(t('profil.takip'), r.hata ?? TakipHataMesaji(r.code));
            });
          },
        },
      ]);
      return;
    }
    void calistir('follow').then((r) => {
      if (!r.ok) Alert.alert(t('profil.takip'), r.hata ?? TakipHataMesaji(r.code));
    });
  }, [calistir, durum?.state, isGuest, username, t]);

  const aksiyonlar =
    isSelf ? null : durum?.state !== 'BLOCKED' && durum?.state !== 'BLOCKED_BY_USER' ? (
      <View style={sadeceAksiyon ? styles.aksiyonCompact : styles.aksiyon}>
        <TakipButonu
          state={durum?.state ?? 'NOT_FOLLOWING'}
          displayName={displayName}
          loading={isleniyor}
          onPress={takipBas}
          compact={sadeceAksiyon}
        />
        {onMesaj ? (
          <Pressable
            style={sadeceAksiyon ? styles.mesajCompact : styles.mesaj}
            onPress={onMesaj}
            accessibilityRole="button"
            accessibilityLabel={t('takip.mesajGonderA11y', { ad: displayName })}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={sadeceAksiyon ? 16 : 18}
              color={RenkTokenlari.text}
            />
            {sadeceAksiyon ? null : (
              <Text style={styles.mesajYazi}>{t('profil.mesajGonder')}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    ) : (
      <View style={sadeceAksiyon ? styles.engelKutuCompact : styles.engelKutu}>
        <Text style={styles.engel}>
          {sadeceAksiyon ? t('takip.engelli') : t('takip.engelliBody')}
        </Text>
        {sadeceAksiyon ? null : (
          <Text style={styles.engelAlt}>{t('takip.engelliAlt')}</Text>
        )}
      </View>
    );

  if (sadeceAksiyon) {
    return <View style={styles.wrapCompact}>{aksiyonlar}</View>;
  }

  return (
    <View style={styles.wrap}>
      {durum && !isSelf ? (
        <IliskiEtiketi
          state={durum.state}
          followsYou={durum.state === 'FOLLOWS_YOU'}
          isMutual={durum.state === 'MUTUAL'}
        />
      ) : null}

      {gosterSayaclar ? (
        <TakipSayaclari
          posts={gosterGonderi ? (durum?.posts_count ?? 0) : null}
          followers={gosterTakipci ? (durum?.followers_count ?? 0) : null}
          following={gosterTakip ? (durum?.following_count ?? 0) : null}
          onFollowers={
            gosterTakipci ? () => listeAc('followers') : undefined
          }
          onFollowing={
            gosterTakip ? () => listeAc('following') : undefined
          }
        />
      ) : null}

      {!isSelf ? (
        <OrtakTakipciler ozet={ortak} targetUserId={targetUserId} />
      ) : null}

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
      ) : gosterAksiyon ? (
        aksiyonlar
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
  wrapCompact: { alignItems: 'flex-end' },
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
  aksiyonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
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
  mesajCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
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
  engelKutuCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.danger + '55',
    backgroundColor: RenkTokenlari.danger + '12',
  },
  engelAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
});
