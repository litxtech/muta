import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { guvenliGeriDon } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import { ProfilGetir } from '../../src/moduller/kullanici-profili/okuma/ProfilGetir';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { ProfilMedyaBuyutucu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaBuyutucu';
import { ProfilAvatarCerceve } from '../../src/moduller/kullanici-profili/bilesenler/ProfilAvatarCerceve';
import { OzelSohbetAcVeyaGetir } from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { useHediyeMagaza } from '../../src/moduller/hediyeler/islemler/useHediyeMagaza';
import { HediyeMagazaBaglamasi } from '../../src/moduller/hediyeler/bilesenler/HediyeMagazaBaglamasi';
import { DurumProfilIzgarasi } from '../../src/moduller/durum/bilesenler/DurumProfilIzgarasi';
import {
  DurumKullanicisiniGetir,
  DurumSil,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import type { Profile } from '../../src/types/models';
import { AjansUyelikGetir, type AjansUyelik } from '../../src/moduller/ajanslar/okuma/AjansUyelikGetir';
import { AjansProfilRozeti } from '../../src/moduller/ajanslar/bilesenler/AjansProfilRozeti';
import { ProfilSosyalAlani } from '../../src/moduller/takip/bilesenler/ProfilSosyalAlani';
import { KullaniciGuvenlikMenusu } from '../../src/moduller/moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import { PrestigeRozetSatiri } from '../../src/moduller/vip/bilesenler/PrestigeRozetSatiri';
import { HesapDegeriRozeti } from '../../src/moduller/kullanici-profili/bilesenler/HesapDegeriRozeti';
import {
  GizlilikAyarlariniKullaniciIcinGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { TakipSayaciniFormatla } from '../../src/moduller/takip/TakipSayacFormat';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useAktifSesOdasi } from '../../src/moduller/ses-odalari/oturum/useAktifSesOdasi';

const COVER_H = 168;
const AVATAR = 96;

function formatSayi(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const EMPTY_PRIVACY: GizlilikAyarlari = {
  hide_recharge_rank: false,
  hide_gifter_rank: false,
  hide_current_room: false,
  hide_last_seen: false,
  hide_agency: false,
  hide_gift_collection: false,
  hide_top_supporter: false,
  hide_level: false,
  hide_topup_coin: false,
  hide_prestige: false,
  hide_account_value: false,
  is_private: false,
};

export default function KullaniciProfilEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, isGuest } = useAuth();
  const [profil, setProfil] = useState<Profile | null>(null);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY_PRIVACY);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [durumlar, setDurumlar] = useState<DurumOggesi[]>([]);
  const [durumYukleniyor, setDurumYukleniyor] = useState(false);
  const [ajansUyelik, setAjansUyelik] = useState<AjansUyelik | null>(null);
  const [guvenlikAcik, setGuvenlikAcik] = useState(false);
  const [buyut, setBuyut] = useState<{ uri: string; tur: 'avatar' | 'cover' } | null>(
    null,
  );
  const magaza = useHediyeMagaza();
  const sesOdasiArka = !!useAktifSesOdasi()?.arkaPlanda;
  // Ses odası modal üstünde Android insets.top bazen 0 — StatusBar yedegi
  const ustInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );
  // Ses odasından: üstte boşluk. Normal ziyaret: kapak çentiğe sıfır.
  const coverH = sesOdasiArka ? COVER_H : COVER_H + ustInset;
  const overlayTop = sesOdasiArka
    ? BoslukTokenlari.sm
    : ustInset + BoslukTokenlari.sm;

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    setDurumYukleniyor(true);
    try {
      const [p, s, giz] = await Promise.all([
        ProfilGetir(id),
        ProfilIstatistikleriniGetir(id).catch(() => null),
        GizlilikAyarlariniKullaniciIcinGetir(id).catch(() => EMPTY_PRIVACY),
      ]);
      setProfil(p);
      setStats(s);
      setPrivacy(giz);
    } catch {
      setProfil(null);
      setStats(null);
      setPrivacy(EMPTY_PRIVACY);
    } finally {
      setYukleniyor(false);
    }
    try {
      setAjansUyelik(await AjansUyelikGetir(id));
    } catch {
      setAjansUyelik(null);
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

  const medyaTikla = (tur: 'avatar' | 'cover') => {
    const uri = tur === 'cover' ? profil?.cover_url : profil?.avatar_url;
    if (uri) setBuyut({ uri, tur });
  };

  const gosterPrestige = kendi || !privacy.hide_prestige;
  const gosterAjans = kendi || !privacy.hide_agency;
  const gosterTopup = kendi || !privacy.hide_topup_coin;
  const gosterSeviye = kendi || !privacy.hide_level;
  const gosterHesapDegeri = kendi || !privacy.hide_account_value;

  const durumSil = (oge: DurumOggesi) => {
    if (!oge.is_mine) return;
    Alert.alert('Durumu kaldır', 'Bu paylaşım profilinden ve durumdan silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await DurumSil(oge.id);
            if (!r.ok) {
              Alert.alert('Sil', r.hata ?? 'Kaldırılamadı');
              return;
            }
            setDurumlar((prev) => prev.filter((x) => x.id !== oge.id));
          })();
        },
      },
    ]);
  };

  const durumMenu = (oge: DurumOggesi) => {
    if (!kendi || !oge.is_mine) return;
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      {
        text: 'Görüntüle',
        onPress: () => router.push(`/durum/${oge.id}` as any),
      },
    ];
    if (oge.post_kind !== 'game_win') {
      buttons.push({
        text: 'Düzenle',
        onPress: () => router.push(`/durum/duzenle?id=${oge.id}` as any),
      });
    }
    buttons.push(
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () => durumSil(oge),
      },
      { text: 'Vazgeç', style: 'cancel' },
    );
    Alert.alert('Gönderi', undefined, buttons);
  };

  const mesajAc = async () => {
    if (!id || kendi) return;
    const r = await OzelSohbetAcVeyaGetir(id);
    if (r.ok) router.push(`/mesaj/${r.threadId}` as any);
  };

  return (
    <Screen edges={[]}>
      <ModulHataSiniri modulAdi="kullanici-profili">
        <View
          style={
            sesOdasiArka
              ? [styles.odaUstBosluk, { paddingTop: ustInset }]
              : styles.durumSarici
          }
        >
        {yukleniyor || !profil ? (
          <View style={styles.durumSarici}>
            <Pressable
              style={[styles.overlayBtn, styles.backBtn, { top: overlayTop }]}
              onPress={() => guvenliGeriDon()}
              hitSlop={8}
              accessibilityLabel="Geri"
            >
              <Ionicons name="chevron-back" size={22} color={RenkTokenlari.text} />
            </Pressable>
            {yukleniyor ? (
              <ActivityIndicator
                color={RenkTokenlari.primary}
                style={{ marginTop: overlayTop + 80 }}
              />
            ) : (
              <Text style={[styles.bos, { marginTop: overlayTop + 80 }]}>
                Profil bulunamadı
              </Text>
            )}
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.pad,
              { paddingBottom: BoslukTokenlari.xxxl + insets.bottom },
            ]}
          >
            <View style={[styles.coverWrap, { height: coverH }]}>
              <Pressable
                onPress={() => medyaTikla('cover')}
                style={styles.coverPress}
                accessibilityLabel="Kapak fotoğrafı"
                disabled={!profil.cover_url}
              >
                {profil.cover_url ? (
                  <Image
                    source={{ uri: profil.cover_url }}
                    style={[styles.cover, { height: coverH }]}
                  />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPlaceholder]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.cover, { height: coverH }]}
                  />
                )}
                <LinearGradient
                  colors={['transparent', RenkTokenlari.bg]}
                  style={styles.coverFade}
                />
              </Pressable>

              <Pressable
                style={[styles.overlayBtn, styles.backBtn, { top: overlayTop }]}
                onPress={() => guvenliGeriDon()}
                hitSlop={8}
                accessibilityLabel="Geri"
              >
                <Ionicons name="chevron-back" size={22} color={RenkTokenlari.text} />
              </Pressable>

              {!kendi && id ? (
                <Pressable
                  style={[styles.overlayBtn, styles.moreBtn, { top: overlayTop }]}
                  onPress={() => setGuvenlikAcik(true)}
                  accessibilityLabel="Engelle veya bildir"
                  hitSlop={10}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color={RenkTokenlari.text}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.avatarBand}>
              <ProfilAvatarCerceve size={AVATAR}>
                <Pressable
                  onPress={() => medyaTikla('avatar')}
                  style={styles.avatarHit}
                  accessibilityLabel="Profil fotoğrafı"
                  disabled={!profil.avatar_url}
                >
                  {profil.avatar_url ? (
                    <Image source={{ uri: profil.avatar_url }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarHarf}>
                        {ad.slice(0, 1).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </Pressable>
              </ProfilAvatarCerceve>
            </View>

            <View style={styles.identity}>
              <View style={styles.adSatir}>
                <Text style={styles.ad} numberOfLines={1}>
                  {ad}
                </Text>
                {profil.is_verified ? (
                  <Ionicons name="checkmark-circle" size={18} color={RenkTokenlari.mint} />
                ) : null}
              </View>
              {profil.username ? (
                <Text style={styles.username}>@{profil.username}</Text>
              ) : null}
              {profil.public_user_id ? (
                <Text style={styles.publicId}>ID {profil.public_user_id}</Text>
              ) : null}
              {profil.bio ? <Text style={styles.bio}>{profil.bio}</Text> : null}

              {gosterHesapDegeri && stats ? (
                <HesapDegeriRozeti
                  value={stats.account_value ?? 0}
                  label={stats.account_value_label}
                />
              ) : null}

              {gosterPrestige && stats ? (
                <PrestigeRozetSatiri
                  vipLevel={stats.vip_level ?? 0}
                  gifterLevel={
                    kendi || !privacy.hide_gifter_rank ? stats.gifter_rank : null
                  }
                  charmLevel={stats.charm_level ?? 0}
                  rechargeLevel={
                    kendi || !privacy.hide_recharge_rank ? stats.recharge_rank : null
                  }
                />
              ) : null}
            </View>

            {id ? (
              <ProfilSosyalAlani
                targetUserId={id}
                viewerId={user?.id}
                isSelf={kendi}
                isGuest={isGuest}
                displayName={ad}
                username={profil.username}
                isVerified={profil.is_verified}
                onMesaj={kendi ? undefined : () => void mesajAc()}
              />
            ) : null}

            <View style={styles.followRow}>
              <View style={styles.followItem}>
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.following_count ?? 0)}
                </Text>
                <Text style={styles.followL}>Takip</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followItem}>
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.followers_count ?? 0)}
                </Text>
                <Text style={styles.followL}>Takipçi</Text>
              </View>
              <View style={styles.followDivider} />
              <View style={styles.followItem}>
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.posts_count ?? durumlar.length)}
                </Text>
                <Text style={styles.followL}>Gönderi</Text>
              </View>
            </View>

            <View style={styles.metrics}>
              {gosterSeviye ? (
                <Metric
                  label="Seviye"
                  value={String(profil.level ?? 1)}
                  icon="trophy-outline"
                  tint={RenkTokenlari.violet}
                />
              ) : null}
              {gosterSeviye ? (
                <Metric
                  label="Tecrübe"
                  value={formatSayi(profil.xp ?? 0)}
                  icon="flash-outline"
                  tint={RenkTokenlari.accent}
                />
              ) : null}
              {gosterTopup ? (
                <Metric
                  label="Yüklenen"
                  value={formatSayi(stats?.total_topup_coin ?? 0)}
                  icon="diamond-outline"
                  tint={RenkTokenlari.accent}
                />
              ) : null}
              <Metric
                label="Alınan"
                value={String(stats?.total_gifts_received ?? 0)}
                icon="gift-outline"
                tint={RenkTokenlari.mint}
              />
              {!gosterSeviye && !gosterTopup ? (
                <Metric
                  label="Gönderilen"
                  value={String(stats?.total_gifts_sent ?? 0)}
                  icon="heart-outline"
                  tint={RenkTokenlari.danger}
                />
              ) : null}
            </View>

            {gosterAjans && ajansUyelik?.agency ? (
              <View style={styles.ajansWrap}>
                <AjansProfilRozeti
                  varyant="uye"
                  ajans={ajansUyelik.agency}
                  tamGenislik
                  onPress={() =>
                    router.push(`/ajans/profil/${ajansUyelik.agency!.id}` as any)
                  }
                />
              </View>
            ) : null}

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
                    <Ionicons name="gift" size={18} color="#fff" />
                    <Text style={styles.hediyeYazi}>Hediye gönder</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.mesajBtn}
                onPress={() => router.push('/profil-duzenle' as any)}
              >
                <Ionicons name="create-outline" size={16} color={RenkTokenlari.text} />
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
                onUzunBas={kendi ? durumMenu : undefined}
                onPaylas={
                  kendi
                    ? () => router.push('/durum/olustur' as any)
                    : undefined
                }
              />
            </View>
          </ScrollView>
        )}

        <ProfilMedyaBuyutucu
          uri={buyut?.uri ?? null}
          tur={buyut?.tur}
          onKapat={() => setBuyut(null)}
        />

        <HediyeMagazaBaglamasi magaza={magaza} />
        {id ? (
          <KullaniciGuvenlikMenusu
            visible={guvenlikAcik}
            targetUserId={id}
            targetName={ad}
            contentType="profile"
            contentId={id}
            onClose={() => setGuvenlikAcik(false)}
            onBlocked={() => {
              setGuvenlikAcik(false);
              router.back();
            }}
          />
        ) : null}
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

function Metric({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${tint}22` }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Text style={[styles.metricN, { color: tint }]}>{value}</Text>
      <Text style={styles.metricL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  durumSarici: {
    flex: 1,
  },
  odaUstBosluk: {
    flex: 1,
  },
  pad: {
    alignItems: 'center',
  },
  bos: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
  },
  coverWrap: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: -52,
    position: 'relative',
  },
  coverPress: {
    ...StyleSheet.absoluteFillObject,
  },
  cover: {
    width: '100%',
  },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  overlayBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RenkTokenlari.chipFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    zIndex: 2,
  },
  backBtn: {
    left: BoslukTokenlari.lg,
  },
  moreBtn: {
    right: BoslukTokenlari.lg,
  },
  avatarBand: {
    alignItems: 'center',
    marginBottom: BoslukTokenlari.sm,
    zIndex: 2,
  },
  avatarHit: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    ...TipografiTokenlari.title,
    color: '#12040C',
    fontWeight: '800',
  },
  identity: {
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
    marginBottom: BoslukTokenlari.md,
  },
  adSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
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
  publicId: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  bio: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: BoslukTokenlari.md,
    lineHeight: 22,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.sm,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.sm,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    width: '90%',
  },
  followItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  followDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: RenkTokenlari.border,
  },
  followN: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  followL: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.md,
    width: '100%',
  },
  metric: {
    width: '22%',
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: 6,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    gap: 4,
  },
  metricIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricN: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
  metricL: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  ajansWrap: {
    width: '90%',
    marginTop: BoslukTokenlari.lg,
  },
  aksiyonlar: {
    width: '90%',
    gap: BoslukTokenlari.sm,
    marginTop: BoslukTokenlari.xl,
  },
  hediyeBtn: { borderRadius: YaricapTokenlari.pill, overflow: 'hidden' },
  hediyeIc: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '90%',
  },
  mesajYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  gonderiBlok: {
    width: '100%',
    paddingHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.lg,
  },
});
