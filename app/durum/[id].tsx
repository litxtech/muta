import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  DurumMedyaHttpsMi,
  DurumMetinGonderisiMi,
  DurumOyunKazanciPayloadAl,
  DurumSil,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { DurumOyunKazanciKart } from '../../src/moduller/durum/bilesenler/DurumOyunKazanciKart';
import { DurumTarihSaat } from '../../src/moduller/durum/islemler/DurumZaman';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function VideoTam({ uri }: { uri: string }) {
  const guvenli = DurumMedyaHttpsMi(uri) ? uri.trim() : '';
  if (!guvenli) {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }
  return (
    <ModulHataSiniri
      modulAdi="durum-video"
      varyant="kart"
      yedek={
        <View style={[StyleSheet.absoluteFill, styles.videoHata]}>
          <Ionicons name="videocam-off" size={40} color="#fff" />
          <Text style={styles.videoHataYazi}>Video açılamadı</Text>
        </View>
      }
    >
      <VideoTamIc uri={guvenli} />
    </ModulHataSiniri>
  );
}

function VideoTamIc({ uri }: { uri: string }) {
  const [odakli, setOdakli] = useState(true);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  useFocusEffect(
    useCallback(() => {
      setOdakli(true);
      return () => setOdakli(false);
    }, []),
  );

  useEffect(() => {
    try {
      player.loop = true;
      player.muted = false;
      if (odakli) player.play();
      else player.pause();
    } catch {
      /* native henüz hazır değilse */
    }
    return () => {
      try {
        player.pause();
      } catch {
        /* */
      }
    };
  }, [player, uri, odakli]);

  return (
    <View style={StyleSheet.absoluteFill} collapsable={false}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture={false}
        playsInline
        {...(Platform.OS === 'android'
          ? { surfaceType: 'textureView' as const }
          : null)}
      />
    </View>
  );
}

export default function DurumDetayEkrani() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const magaza = useHediyeMagaza();
  const [oge, setOge] = useState<DurumOggesi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yorumAcik, setYorumAcik] = useState(false);
  const [bildirAcik, setBildirAcik] = useState(false);
  const [lightboxAcik, setLightboxAcik] = useState(false);

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
      setLightboxAcik(false);
    }, [yukle]),
  );

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

  const metinGonderisi = oge ? DurumMetinGonderisiMi(oge) : false;
  const ikonRenk = metinGonderisi ? RenkTokenlari.text : '#fff';
  // Yüklenirken siyah boş ekran olmasın
  const ekranBg = !oge || metinGonderisi ? RenkTokenlari.bg : '#000';

  return (
    <Screen edges={[]} style={{ backgroundColor: ekranBg }}>
      <ModulHataSiniri modulAdi="durum">
        {yukleniyor && !oge ? (
          <View style={[styles.root, { backgroundColor: RenkTokenlari.bg }]}>
            <View
              style={[styles.ust, { paddingTop: insets.top + 8 }]}
              pointerEvents="box-none"
            >
              <View style={{ flex: 1 }} />
              <Pressable
                style={styles.ikonBtn}
                onPress={kapat}
                hitSlop={12}
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={24} color={RenkTokenlari.text} />
              </Pressable>
            </View>
            <ActivityIndicator
              color={RenkTokenlari.primarySoft}
              style={{ marginTop: 80 }}
            />
          </View>
        ) : !oge ? (
          <View style={styles.bos}>
            <Text style={styles.bosYazi}>Durum bulunamadı</Text>
            <Pressable onPress={kapat}>
              <Text style={styles.link}>Geri</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.root, metinGonderisi && { backgroundColor: ekranBg }]}>
            <View
              style={[
                styles.medyaKatman,
                metinGonderisi && { backgroundColor: ekranBg },
              ]}
            >
              {(() => {
                const kazanc = DurumOyunKazanciPayloadAl(oge);
                if (kazanc) {
                  return (
                    <View style={styles.kartWrap}>
                      <DurumOyunKazanciKart payload={kazanc} />
                    </View>
                  );
                }
                if (metinGonderisi) {
                  return (
                    <View style={styles.metinGovde} pointerEvents="none">
                      <Text style={styles.metinBaslik}>
                        {oge.caption?.trim() || 'Durum'}
                      </Text>
                    </View>
                  );
                }
                if (oge.media_type === 'video') {
                  return <VideoTam uri={oge.media_url} />;
                }
                const resimUri = DurumMedyaHttpsMi(oge.media_url)
                  ? oge.media_url.trim()
                  : '';
                if (!resimUri) {
                  return (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: RenkTokenlari.bgElevated },
                      ]}
                    />
                  );
                }
                return (
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setLightboxAcik(true)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="Resmi büyüt"
                  >
                    <Image
                      source={{ uri: resimUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="contain"
                    />
                  </Pressable>
                );
              })()}
            </View>

            {!metinGonderisi &&
            lightboxAcik &&
            DurumMedyaHttpsMi(oge.media_url) ? (
              <View
                style={styles.lightbox}
                accessibilityViewIsModal
                accessibilityLabel="Büyütülmüş resim"
              >
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setLightboxAcik(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Resmi kapat"
                />
                <Image
                  source={{ uri: oge.media_url.trim() }}
                  style={styles.lightboxResim}
                  resizeMode="contain"
                />
                <Pressable
                  style={[
                    styles.lightboxKapat,
                    { top: Math.max(12, insets.top + 8) },
                  ]}
                  onPress={() => setLightboxAcik(false)}
                  hitSlop={12}
                  accessibilityLabel="Kapat"
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
              </View>
            ) : null}

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
                  <Text style={[styles.isim, metinGonderisi && { color: RenkTokenlari.text }]}>
                    {oge.display_name}
                  </Text>
                  <Text
                    style={[
                      styles.zaman,
                      metinGonderisi && { color: RenkTokenlari.textMuted },
                    ]}
                  >
                    {DurumTarihSaat(oge.created_at)}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.ustSag}>
                {oge.is_mine ? (
                  <>
                    {oge.post_kind !== 'game_win' ? (
                      <Pressable
                        style={styles.ikonBtn}
                        onPress={() =>
                          router.push(`/durum/duzenle?id=${oge.id}` as any)
                        }
                        hitSlop={8}
                        accessibilityLabel="Düzenle"
                      >
                        <Ionicons name="create-outline" size={20} color={ikonRenk} />
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.ikonBtn} onPress={sil} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={ikonRenk} />
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={styles.ikonBtn}
                    onPress={() => setBildirAcik(true)}
                    hitSlop={8}
                  >
                    <Ionicons name="flag-outline" size={20} color={ikonRenk} />
                  </Pressable>
                )}
                <Pressable style={styles.ikonBtn} onPress={kapat} hitSlop={8}>
                  <Ionicons name="close" size={24} color={ikonRenk} />
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.alt,
                { paddingBottom: insets.bottom + 16 },
                metinGonderisi && styles.altMetin,
              ]}
            >
              {oge.caption && !metinGonderisi ? (
                <Text style={styles.caption} numberOfLines={4}>
                  {oge.caption}
                </Text>
              ) : null}
              <View style={styles.aksiyonlar}>
                <Pressable style={styles.aksiyon} onPress={begen} hitSlop={10}>
                  <Ionicons
                    name={oge.liked_by_me ? 'heart' : 'heart-outline'}
                    size={28}
                    color={
                      oge.liked_by_me
                        ? RenkTokenlari.danger
                        : ikonRenk
                    }
                  />
                  <Text
                    style={[
                      styles.aksiyonYazi,
                      metinGonderisi && { color: RenkTokenlari.text },
                    ]}
                  >
                    {oge.like_count}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.aksiyon}
                  onPress={() =>
                    islemiDene('yorum_yap', () => setYorumAcik(true))
                  }
                  hitSlop={10}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={26}
                    color={ikonRenk}
                  />
                  <Text
                    style={[
                      styles.aksiyonYazi,
                      metinGonderisi && { color: RenkTokenlari.text },
                    ]}
                  >
                    {oge.comment_count}
                  </Text>
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
                        oge.gift_count > 0 ? RenkTokenlari.accent : ikonRenk
                      }
                    />
                    <Text
                      style={[
                        styles.aksiyonYazi,
                        metinGonderisi && { color: RenkTokenlari.text },
                      ]}
                    >
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
                    <Text
                      style={[
                        styles.aksiyonYazi,
                        metinGonderisi && { color: RenkTokenlari.text },
                      ]}
                    >
                      {oge.gift_count ?? 0}
                    </Text>
                  </View>
                )}
                {!oge.is_mine ? (
                  <Pressable
                    style={styles.aksiyon}
                    onPress={() => setBildirAcik(true)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={26}
                      color={ikonRenk}
                    />
                    <Text
                      style={[
                        styles.aksiyonYazi,
                        metinGonderisi && { color: RenkTokenlari.text },
                      ]}
                    >
                      Bildir
                    </Text>
                  </Pressable>
                ) : oge.post_kind !== 'game_win' ? (
                  <Pressable
                    style={styles.aksiyon}
                    onPress={() =>
                      router.push(`/durum/duzenle?id=${oge.id}` as any)
                    }
                    hitSlop={10}
                  >
                    <Ionicons name="create-outline" size={26} color={ikonRenk} />
                    <Text
                      style={[
                        styles.aksiyonYazi,
                        metinGonderisi && { color: RenkTokenlari.text },
                      ]}
                    >
                      Düzenle
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.aksiyon} onPress={sil} hitSlop={10}>
                    <Ionicons name="trash-outline" size={26} color={ikonRenk} />
                    <Text
                      style={[
                        styles.aksiyonYazi,
                        metinGonderisi && { color: RenkTokenlari.text },
                      ]}
                    >
                      Kaldır
                    </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  metinGovde: {
    paddingHorizontal: BoslukTokenlari.xl,
    maxWidth: 420,
    alignItems: 'center',
  },
  metinBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
  },
  lightbox: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    elevation: 40,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxResim: {
    ...StyleSheet.absoluteFill,
    zIndex: 41,
  },
  lightboxKapat: {
    position: 'absolute',
    right: 16,
    zIndex: 42,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kartWrap: {
    width: '88%',
    maxWidth: 360,
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
  altMetin: {
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
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
  videoHata: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
  },
  videoHataYazi: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
});
