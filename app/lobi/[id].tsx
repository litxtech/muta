import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { guvenliGeriDon } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import {
  OdaGirisYetkisiniKontrolEt,
  OdaKapasitesiniKontrolEt,
} from '../../src/moduller/oda-lobisi/islemler/OdaGirisKontrolleri';
import {
  LobiKatilimcilariniGetir,
  LobidenAyril,
  LobiyeKatil,
} from '../../src/moduller/oda-lobisi/islemler/LobiKatilimIslemleri';
import {
  OdaToplulukOnayiVarMi,
  OdaToplulukOnayiniKaydet,
} from '../../src/moduller/oda-lobisi/depolama/OdaToplulukOnayi';
import { LobiCanliVideoSahne } from '../../src/moduller/oda-lobisi/bilesenler/LobiCanliVideoSahne';
import { PolitikaOkumaPaneli } from '../../src/moduller/politikalar/bilesenler/PolitikaOkumaPaneli';
import {
  POLITIKA_LISTESI,
  POLITIKA_METINLERI,
  type PolitikaTanimi,
} from '../../src/moduller/politikalar/icerik/PolitikaMetinleri';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { AnaSayfaCanliNokta } from '../../src/moduller/ana-sayfa/bilesenler/AnaSayfaCanliNokta';
import { CamArkaplan } from '../../src/bilesenler/yuzey/CamArkaplan';
import { joinRoom } from '../../src/services/api';
import type { Room } from '../../src/types/models';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type LobiKisi = {
  user_id: string;
  joined_at: string;
  profile?: {
    id: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

/**
 * Oda lobisi — canlı video tiyatrosu (tam ekran insanlar + cam alt panel).
 */
export default function OdaLobisiEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [oda, setOda] = useState<Room | null>(null);
  const [kisiler, setKisiler] = useState<LobiKisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [giriyor, setGiriyor] = useState(false);
  const [hatirlatmaOk, setHatirlatmaOk] = useState(false);
  const [okunan, setOkunan] = useState<PolitikaTanimi | null>(null);
  const ayrildi = useRef(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      if (!user) {
        Alert.alert('Giriş', 'Oturum gerekli');
        router.replace('/(auth)/login' as any);
        return;
      }
      const yetki = await OdaGirisYetkisiniKontrolEt(id);
      if (!yetki.ok || !yetki.oda) {
        Alert.alert('Oda', yetki.hata ?? 'Oda yok');
        router.replace('/(tabs)' as any);
        return;
      }
      setOda(yetki.oda);
      await LobiyeKatil(id);
      const liste = await LobiKatilimcilariniGetir(id);
      setKisiler(liste);
      setHatirlatmaOk(await OdaToplulukOnayiVarMi());
    } catch (e) {
      Alert.alert('Lobi', e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setYukleniyor(false);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      ayrildi.current = false;
      void yukle();
      return () => {
        if (id && !ayrildi.current) void LobidenAyril(id);
      };
    }, [yukle, id]),
  );

  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      void LobiKatilimcilariniGetir(id)
        .then(setKisiler)
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(t);
  }, [id]);

  const odayaGir = async () => {
    if (!id || !user || !oda || giriyor) return;
    if (!hatirlatmaOk) {
      Alert.alert(
        'Topluluk kuralları',
        '18+ platform. Çocuk koruma ihlallerinde af yoktur; hesaplar kalıcı kapatılır.',
      );
      return;
    }
    setGiriyor(true);
    try {
      const hostMu = user.id === oda.host_id;
      if (!hostMu) {
        const kapasite = await OdaKapasitesiniKontrolEt({
          listener_count: oda.listener_count,
          audience_capacity: oda.audience_capacity,
        });
        if (!kapasite.ok) {
          Alert.alert('Dolu', kapasite.hata);
          return;
        }
      }
      await OdaToplulukOnayiniKaydet();
      ayrildi.current = true;
      await LobidenAyril(id);
      await joinRoom(oda.id, user.id, hostMu ? 'host' : 'listener');
      router.replace(`/room/${oda.id}` as any);
    } catch (e) {
      Alert.alert('Giriş', e instanceof Error ? e.message : 'Hata');
    } finally {
      setGiriyor(false);
    }
  };

  const izleyici = Math.max(kisiler.length, oda?.listener_count ?? 0);

  return (
    <View style={styles.screen}>
      <ModulHataSiniri modulAdi="oda-lobisi">
        <LobiCanliVideoSahne aktif={!okunan} />

        {/* Üst — canlı tiyatro bar */}
        <View style={[styles.ust, { paddingTop: insets.top + 6 }]}>
          <Pressable
            onPress={() => guvenliGeriDon('/(tabs)/rooms')}
            style={styles.yuvarlak}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>

          <View style={styles.hostKart}>
            <ProfilAvatarKucuk
              size={36}
              displayName={oda?.host?.display_name}
              username={oda?.host?.username}
              avatarUrl={oda?.host?.avatar_url ?? oda?.cover_url}
            />
            <View style={styles.hostCopy}>
              <Text style={styles.odaAd} numberOfLines={1}>
                {oda?.title ?? 'Lobi'}
              </Text>
              <Text style={styles.hostAd} numberOfLines={1}>
                {oda?.host?.display_name ??
                  (oda?.host?.username ? `@${oda.host.username}` : 'Ev sahibi')}
              </Text>
            </View>
          </View>

          <View style={styles.canliRozet}>
            <AnaSayfaCanliNokta boyut={6} />
            <Text style={styles.canliYazi}>CANLI</Text>
          </View>

          <View style={styles.izleyiciRozet}>
            <Ionicons name="eye" size={14} color="#fff" />
            <Text style={styles.izleyiciYazi}>{izleyici}</Text>
          </View>

          <Pressable
            onPress={() => setOkunan(POLITIKA_METINLERI.child_safety)}
            style={[styles.yuvarlak, styles.kalkan]}
            hitSlop={8}
          >
            <Ionicons name="shield-checkmark" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Ortada bekleyen avatar şeridi */}
        <View style={styles.ortaSerit} pointerEvents="box-none">
          {yukleniyor ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.avatarSerit}>
              {kisiler.slice(0, 6).map((k) => (
                <View key={k.user_id} style={styles.avatarHalka}>
                  <ProfilAvatarKucuk
                    size={44}
                    displayName={k.profile?.display_name}
                    username={k.profile?.username}
                    avatarUrl={k.profile?.avatar_url}
                  />
                </View>
              ))}
              {kisiler.length === 0 ? (
                <Text style={styles.ortaYazi}>Lobide insanlar birikiyor…</Text>
              ) : (
                <Text style={styles.ortaYazi}>{kisiler.length} kişi lobide</Text>
              )}
            </View>
          )}
        </View>

        {/* Alt cam panel — politikalar + onay + CTA */}
        <View style={[styles.alt, { paddingBottom: insets.bottom + 14 }]}>
          <CamArkaplan
            intensity={28}
            tint="dark"
            style={StyleSheet.absoluteFill}
            fallbackColor="rgba(12,8,18,0.82)"
            pointerEvents="none"
          />
          <Text style={styles.altBaslik}>Odaya girmeden önce</Text>
          <Text style={styles.altAlt}>
            Gerçek ortam · 18+ · çocuk korumada af yok, hesap kapatılır
          </Text>

          <View style={styles.politikaRow}>
            {POLITIKA_LISTESI.map((p) => (
              <Pressable
                key={p.kod}
                style={[
                  styles.chip,
                  p.kod === 'child_safety' && styles.chipDanger,
                ]}
                onPress={() => setOkunan(p)}
              >
                <Text
                  style={[
                    styles.chipYazi,
                    p.kod === 'child_safety' && styles.chipYaziDanger,
                  ]}
                >
                  {p.kod === 'tos'
                    ? 'Kullanım'
                    : p.kod === 'privacy'
                      ? 'Gizlilik'
                      : 'Çocuk koruma'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.onaySatir}
            onPress={() => setHatirlatmaOk((v) => !v)}
          >
            <Ionicons
              name={hatirlatmaOk ? 'checkbox' : 'square-outline'}
              size={22}
              color={hatirlatmaOk ? RenkTokenlari.mint : 'rgba(255,255,255,0.55)'}
            />
            <Text style={styles.onayYazi}>
              Politikaları kabul ediyorum · çocuk korumada af yoktur
            </Text>
          </Pressable>

          <LinearGradient
            colors={[...RenkTokenlari.gradientPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGrad}
          >
            <Pressable
              style={styles.cta}
              onPress={() => void odayaGir()}
              disabled={giriyor || yukleniyor || !oda}
            >
              {giriyor ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={styles.ctaYazi}>Canlı odaya gir</Text>
                </>
              )}
            </Pressable>
          </LinearGradient>
        </View>

        <PolitikaOkumaPaneli
          politika={okunan}
          onKapat={() => setOkunan(null)}
        />
      </ModulHataSiniri>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0610' },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    zIndex: 4,
  },
  yuvarlak: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  kalkan: { backgroundColor: 'rgba(232,75,106,0.45)' },
  hostKart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hostCopy: { flex: 1, minWidth: 0 },
  odaAd: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '800',
  },
  hostAd: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.7)',
  },
  canliRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.live,
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  izleyiciRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  izleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '700',
  },
  ortaSerit: {
    position: 'absolute',
    left: 16,
    right: 140,
    top: '42%',
    zIndex: 3,
  },
  avatarSerit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  avatarHalka: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  ortaYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  alt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.lg,
    gap: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  altBaslik: {
    ...TipografiTokenlari.h2,
    color: '#fff',
  },
  altAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.65)',
    marginTop: -4,
  },
  politikaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(232,64,145,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.45)',
  },
  chipDanger: {
    backgroundColor: 'rgba(232,75,106,0.22)',
    borderColor: 'rgba(232,75,106,0.55)',
  },
  chipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  chipYaziDanger: { color: '#FF8FA3' },
  onaySatir: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  onayYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
    lineHeight: 18,
  },
  ctaGrad: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  ctaYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
});
