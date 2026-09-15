import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { ProfilGetir } from '../../src/moduller/kullanici-profili/okuma/ProfilGetir';
import { OzelSohbetAcVeyaGetir } from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { DurumProfilIzgarasi } from '../../src/moduller/durum/bilesenler/DurumProfilIzgarasi';
import {
  DurumKullanicisiniGetir,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import type { Profile } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

export default function KullaniciProfilEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [profil, setProfil] = useState<Profile | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [durumlar, setDurumlar] = useState<DurumOggesi[]>([]);
  const [durumYukleniyor, setDurumYukleniyor] = useState(false);
  const magaza = useHediyeMagaza();

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    setDurumYukleniyor(true);
    try {
      setProfil(await ProfilGetir(id));
    } catch {
      setProfil(null);
    } finally {
      setYukleniyor(false);
    }
    try {
      setDurumlar(await DurumKullanicisiniGetir(id, 48));
    } catch {
      setDurumlar([]);
    } finally {
      setDurumYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const kendi = user?.id === id;
  const ad =
    profil?.display_name?.trim() ||
    profil?.username?.trim() ||
    'Kullanıcı';

  const mesajAc = async () => {
    if (!id || kendi) return;
    const r = await OzelSohbetAcVeyaGetir(id);
    if (r.ok) router.push(`/mesaj/${r.threadId}` as any);
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="kullanici-profili">
        <EkranBasligi title="Profil" subtitle={ad} />
        {yukleniyor ? (
          <ActivityIndicator
            color={RenkTokenlari.primary}
            style={{ marginTop: 40 }}
          />
        ) : !profil ? (
          <Text style={styles.bos}>Profil bulunamadı</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.pad}>
            {profil.cover_url ? (
              <Image source={{ uri: profil.cover_url }} style={styles.cover} />
            ) : (
              <LinearGradient
                colors={['#2A1830', '#15101C']}
                style={styles.cover}
              />
            )}
            <View style={styles.avatarWrap}>
              {profil.avatar_url ? (
                <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarBos]}>
                  <Text style={styles.avatarHarf}>
                    {ad.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.ad}>{ad}</Text>
            {profil.username ? (
              <Text style={styles.username}>@{profil.username}</Text>
            ) : null}
            {profil.bio ? <Text style={styles.bio}>{profil.bio}</Text> : null}

            {!kendi ? (
              <View style={styles.aksiyonlar}>
                <Pressable
                  style={styles.hediyeBtn}
                  onPress={() =>
                    magaza.ac({
                      receiverId: profil.id,
                      aliciAdi: ad,
                      animasyon: true,
                    })
                  }
                >
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPrimary]}
                    style={styles.hediyeIc}
                  >
                    <Text style={styles.hediyeYazi}>🎁 Hediye gönder</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable style={styles.mesajBtn} onPress={() => void mesajAc()}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={RenkTokenlari.text}
                  />
                  <Text style={styles.mesajYazi}>Mesaj</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.mesajBtn}
                onPress={() => router.push('/profil-duzenle' as any)}
              >
                <Text style={styles.mesajYazi}>Profili düzenle</Text>
              </Pressable>
            )}

            <View style={styles.gonderiBlok}>
              <DurumProfilIzgarasi
                items={durumlar}
                yukleniyor={durumYukleniyor}
                baslik="Gönderiler"
                bosMetin="Bu kullanıcının henüz paylaşımı yok."
                yatayPadding={false}
                onPress={(oge) => router.push(`/durum/${oge.id}` as any)}
                onPaylas={
                  kendi
                    ? () => router.push('/durum/olustur' as any)
                    : undefined
                }
              />
            </View>
          </ScrollView>
        )}

        <HediyeMagazaBaglamasi magaza={magaza} />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.xxxl,
    alignItems: 'center',
  },
  bos: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  cover: {
    width: '100%',
    height: 120,
    borderRadius: YaricapTokenlari.lg,
    marginBottom: -36,
  },
  avatarWrap: {
    borderWidth: 3,
    borderColor: RenkTokenlari.bg,
    borderRadius: 48,
    marginBottom: BoslukTokenlari.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarBos: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  avatarHarf: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.primarySoft,
  },
  ad: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    textAlign: 'center',
  },
  username: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 4,
  },
  bio: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: BoslukTokenlari.md,
  },
  aksiyonlar: {
    width: '100%',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.xl,
  },
  hediyeBtn: { borderRadius: YaricapTokenlari.pill, overflow: 'hidden' },
  hediyeIc: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  hediyeYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  mesajBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    marginTop: BoslukTokenlari.xl,
    width: '100%',
  },
  mesajYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  gonderiBlok: {
    width: '100%',
    marginTop: BoslukTokenlari.lg,
  },
});
