import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Screen } from '../../src/components/Screen';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { DurumYorumPaneli } from '../../src/moduller/durum/bilesenler/DurumYorumPaneli';
import { KullaniciGuvenlikMenusu } from '../../src/moduller/moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import {
  DurumBegeniToggle,
  DurumDetayGetir,
  DurumSil,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { DurumTarihSaat } from '../../src/moduller/durum/islemler/DurumZaman';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const W = Dimensions.get('window').width;

function VideoTam({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      // Android nativeControls tüm overlay Pressable'ları yutar.
      nativeControls={false}
      pointerEvents="none"
    />
  );
}

export default function DurumDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const magaza = useHediyeMagaza();
  const [oge, setOge] = useState<DurumOggesi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yorumAcik, setYorumAcik] = useState(false);
  const [bildirAcik, setBildirAcik] = useState(false);

  const tx = useSharedValue(0);

  const kapat = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/durum' as any);
  }, []);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setOge(await DurumDetayGetir(id));
    } catch {
      setOge(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-24, 24])
    .onUpdate((e) => {
      if (e.translationX < 0) tx.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -W * 0.28 || e.velocityX < -800) {
        tx.value = withSpring(-W, { damping: 20 }, () => {
          runOnJS(kapat)();
        });
      } else {
        tx.value = withSpring(0);
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: 1 + tx.value / (W * 1.4),
  }));

  const begen = () => {
    if (!oge) return;
    islemiDene('yorum_yap', () => {
      void (async () => {
        const r = await DurumBegeniToggle(oge.id);
        if (!r.ok) {
          Alert.alert('Beğeni', r.hata ?? 'Başarısız');
          return;
        }
        setOge((p) =>
          p
            ? {
                ...p,
                liked_by_me: !!r.liked,
                like_count: r.like_count ?? p.like_count,
              }
            : p,
        );
      })();
    });
  };

  const sil = () => {
    if (!oge?.is_mine) return;
    Alert.alert('Durumu sil', 'Bu paylaşım kalıcı olarak silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await DurumSil(oge.id);
            if (!r.ok) Alert.alert('Sil', r.hata ?? 'Başarısız');
            else kapat();
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={[]} style={{ backgroundColor: '#000' }}>
      <ModulHataSiniri modulAdi="durum">
        {yukleniyor && !oge ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 80 }}
          />
        ) : !oge ? (
          <View style={styles.bos}>
            <Text style={styles.bosYazi}>Durum bulunamadı</Text>
            <Pressable onPress={kapat}>
              <Text style={styles.link}>Geri</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.root}>
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.medyaKatman, animStyle]}>
                {oge.media_type === 'video' ? (
                  <VideoTam uri={oge.media_url} />
                ) : (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Image
                      source={{ uri: oge.media_url }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </Animated.View>
            </GestureDetector>

            <View
              style={[styles.ust, { paddingTop: insets.top + 8 }]}
              pointerEvents="box-none"
            >
              <Pressable
                style={styles.kisi}
                onPress={() =>
                  router.push(`/kullanici/${oge.user_id}` as any)
                }
              >
                <ProfilAvatarKucuk
                  size={36}
                  displayName={oge.display_name}
                  username={oge.username}
                  avatarUrl={oge.avatar_url}
                />
                <View style={styles.kisiMetin}>
                  <Text style={styles.isim}>{oge.display_name}</Text>
                  <Text style={styles.zaman}>
                    {DurumTarihSaat(oge.created_at)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.ustSag}>
                {oge.is_mine ? (
                  <>
                    <Pressable
                      style={styles.ikonBtn}
                      onPress={() =>
                        router.push(`/durum/duzenle?id=${oge.id}` as any)
                      }
                      hitSlop={8}
                      accessibilityLabel="Düzenle"
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.ikonBtn} onPress={sil} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={styles.ikonBtn}
                    onPress={() => setBildirAcik(true)}
                    hitSlop={8}
                  >
                    <Ionicons name="flag-outline" size={20} color="#fff" />
                  </Pressable>
                )}
                <Pressable style={styles.ikonBtn} onPress={kapat} hitSlop={8}>
                  <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
              </View>
            </View>

            <Text style={styles.ipucu} pointerEvents="none">
              ← Sola kaydırarak çık
            </Text>

            <View style={[styles.alt, { paddingBottom: insets.bottom + 16 }]}>
              {oge.caption ? (
                <Text style={styles.caption} numberOfLines={4}>
                  {oge.caption}
                </Text>
              ) : null}
              <View style={styles.aksiyonlar}>
                <Pressable style={styles.aksiyon} onPress={begen} hitSlop={10}>
                  <Ionicons
                    name={oge.liked_by_me ? 'heart' : 'heart-outline'}
                    size={28}
                    color={oge.liked_by_me ? RenkTokenlari.danger : '#fff'}
                  />
                  <Text style={styles.aksiyonYazi}>{oge.like_count}</Text>
                </Pressable>
                <Pressable
                  style={styles.aksiyon}
                  onPress={() =>
                    islemiDene('yorum_yap', () => setYorumAcik(true))
                  }
                  hitSlop={10}
                >
                  <Ionicons name="chatbubble-outline" size={26} color="#fff" />
                  <Text style={styles.aksiyonYazi}>{oge.comment_count}</Text>
                </Pressable>
                {!oge.is_mine ? (
                  <Pressable
                    style={styles.aksiyon}
                    onPress={() =>
                      magaza.ac({
                        receiverId: oge.user_id,
                        aliciAdi: oge.display_name,
                        statusId: oge.id,
                        onBasarili: (_g, adet) => {
                          setOge((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  gift_count: (prev.gift_count ?? 0) + adet,
                                }
                              : prev,
                          );
                        },
                      })
                    }
                    hitSlop={10}
                  >
                    <Ionicons
                      name="gift-outline"
                      size={26}
                      color={
                        oge.gift_count > 0 ? RenkTokenlari.accent : '#fff'
                      }
                    />
                    <Text style={styles.aksiyonYazi}>
                      {oge.gift_count > 0 ? oge.gift_count : 'Hediye'}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.aksiyon}>
                    <Ionicons
                      name="gift-outline"
                      size={26}
                      color={RenkTokenlari.accent}
                    />
                    <Text style={styles.aksiyonYazi}>{oge.gift_count ?? 0}</Text>
                  </View>
                )}
                {!oge.is_mine ? (
                  <Pressable
                    style={styles.aksiyon}
                    onPress={() => setBildirAcik(true)}
                    hitSlop={10}
                  >
                    <Ionicons name="alert-circle-outline" size={26} color="#fff" />
                    <Text style={styles.aksiyonYazi}>Bildir</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.aksiyon}
                    onPress={() =>
                      router.push(`/durum/duzenle?id=${oge.id}` as any)
                    }
                    hitSlop={10}
                  >
                    <Ionicons name="create-outline" size={26} color="#fff" />
                    <Text style={styles.aksiyonYazi}>Düzenle</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        )}

        {oge && yorumAcik ? (
          <DurumYorumPaneli
            visible
            statusId={oge.id}
            canModerate={oge.is_mine}
            onClose={() => setYorumAcik(false)}
            onChanged={() => void yukle()}
            onProfil={(uid) => {
              setYorumAcik(false);
              router.push(`/kullanici/${uid}` as any);
            }}
          />
        ) : null}

        {oge && bildirAcik ? (
          <KullaniciGuvenlikMenusu
            visible
            targetUserId={oge.user_id}
            targetName={oge.display_name}
            contentType="status_post"
            contentId={oge.id}
            contentPreview={oge.caption}
            contentMediaUrl={oge.media_url}
            onClose={() => setBildirAcik(false)}
            onReported={() =>
              Alert.alert(
                'Bildirim alındı',
                'Raporunuz incelenecek. Teşekkürler — güvenli bir topluluk için bildiriminiz önemli.',
              )
            }
          />
        ) : null}

        <HediyeMagazaBaglamasi magaza={magaza} misafirKart={false} />

        <HesabiTamamlaKarti
          visible={upgradeAcik || magaza.upgradeAcik}
          onClose={() => {
            upgradeKapat();
            magaza.upgradeKapat();
          }}
          onCompleted={() => {
            upgradeKapat();
            magaza.upgradeKapat();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  medyaKatman: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  ust: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.md,
    zIndex: 10,
    elevation: 10,
  },
  kisi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    maxWidth: '70%',
  },
  kisiMetin: { flexShrink: 1, minWidth: 0 },
  isim: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  zaman: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.7)',
  },
  ustSag: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  ikonBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ipucu: {
    position: 'absolute',
    top: '48%',
    left: 12,
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-90deg' }],
    zIndex: 5,
  },
  alt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: BoslukTokenlari.lg,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
    elevation: 10,
  },
  caption: {
    ...TipografiTokenlari.body,
    color: '#fff',
    lineHeight: 20,
  },
  aksiyonlar: {
    flexDirection: 'row',
    gap: 22,
    alignItems: 'center',
  },
  aksiyon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 4,
  },
  aksiyonYazi: {
    ...TipografiTokenlari.caption,
    color: '#fff',
    fontWeight: '700',
  },
  bos: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bosYazi: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  link: { ...TipografiTokenlari.body, color: RenkTokenlari.primarySoft },
});
