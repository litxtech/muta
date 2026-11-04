import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth, useWallet } from '../../src/contexts/AuthContext';
import { SeoAdresiniPaylas } from '../../src/moduller/seo/SeoPaylasimAdresi';
import { useAjansSahibiMi } from '../../src/moduller/ajanslar/kancalar/useAjansSahibiMi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { ProfilGetir } from '../../src/moduller/kullanici-profili/okuma/ProfilGetir';
import { ProfilMedyaBuyutucu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaBuyutucu';
import {
  ProfilXBaslik,
  ProfilXGonderiSekme,
  profilXOverlayBtnStyle,
} from '../../src/moduller/kullanici-profili/bilesenler/ProfilXBaslik';
import { useHikayeProfilOzet } from '../../src/moduller/hikaye/kancalar/useHikayeProfilOzet';
import { KillSwitchAktifMi, OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { PrestigeRozetSatiri } from '../../src/moduller/vip/bilesenler/PrestigeRozetSatiri';
import { UlkeKatkisiKart } from '../../src/moduller/ulke-ligi/bilesenler/UlkeKatkisiKart';
import { BenimUlkeKatkiGetir } from '../../src/moduller/ulke-ligi/islemler/UlkeLigiApi';
import type { BenimUlkeKatkisi } from '../../src/moduller/ulke-ligi/tipler';
import { useAjansUyeligi } from '../../src/moduller/ajanslar/kancalar/useAjansUyeligi';
import { AjansProfilRozeti } from '../../src/moduller/ajanslar/bilesenler/AjansProfilRozeti';
import {
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { DurumProfilIzgarasi } from '../../src/moduller/durum/bilesenler/DurumProfilIzgarasi';
import {
  DurumKullanicisiniGetir,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { MedyaUriGuvenli } from '../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';
import { ProfilAlinanHediyeButonu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilAlinanHediyeButonu';
import { useCeviri } from '../../src/i18n/useCeviri';

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
  hide_crown: false,
  hide_online_status: false,
  hide_followers: false,
  hide_following: false,
  hide_status_posts: false,
  is_private: false,
  search_profile_visible: true,
  search_posts_visible: true,
};

/** Profil — X tarzı hibrit header + Tamuso rozetleri */
export default function ProfileScreen() {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();
  const { profile, user, isGuest, refreshProfile, patchProfile } = useAuth();
  const { refreshWallet } = useWallet();
  const { uyelik: ajansUyelik, yukleniyor: ajansYukleniyor } = useAjansUyeligi(!isGuest);
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY_PRIVACY);
  const [buyut, setBuyut] = useState<{
    uri: string;
    tur: 'avatar' | 'cover';
  } | null>(null);
  const [durumlar, setDurumlar] = useState<DurumOggesi[]>([]);
  const [durumYukleniyor, setDurumYukleniyor] = useState(true);
  const [ulkeKatki, setUlkeKatki] = useState<BenimUlkeKatkisi | null>(null);
  const ulkeLigiAcik =
    OzellikBayragiAktifMi('country_league_enabled') &&
    !KillSwitchAktifMi('kill_country_league_display');
  const hikayeOzet = useHikayeProfilOzet(user?.id);
  const ajansSahibi = useAjansSahibiMi(user?.id);

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      if (!user?.id) return;
      // Kendi medya URL'lerini doğrudan DB'den al — Auth cache ile diğer profil farkını kapat
      void ProfilGetir(user.id)
        .then((p) => {
          if (!p) return;
          if (p.avatar_url || p.cover_url) {
            patchProfile({
              ...(p.avatar_url != null ? { avatar_url: p.avatar_url } : {}),
              ...(p.cover_url != null ? { cover_url: p.cover_url } : {}),
            });
          }
        })
        .catch(() => undefined);
      if (!isGuest) {
        void GizlilikAyarlariniGetir().then(setPrivacy);
      }
      if (!isGuest && ulkeLigiAcik) {
        void BenimUlkeKatkiGetir()
          .then(setUlkeKatki)
          .catch(() => setUlkeKatki(null));
      } else {
        setUlkeKatki(null);
      }
      ProfilIstatistikleriniGetir(user.id)
        .then(setStats)
        .catch(() => setStats(null));
      setDurumYukleniyor(true);
      DurumKullanicisiniGetir(user.id, 48)
        .then(setDurumlar)
        .catch(() => setDurumlar([]))
        .finally(() => setDurumYukleniyor(false));
    }, [user?.id, refreshProfile, patchProfile, isGuest, ulkeLigiAcik]),
  );

  const medyaTikla = (tur: 'avatar' | 'cover') => {
    const url =
      tur === 'cover'
        ? MedyaUriGuvenli(profile?.cover_url)
        : MedyaUriGuvenli(profile?.avatar_url);
    if (url) setBuyut({ uri: url, tur });
  };

  const avatarTikla = () => {
    if (hikayeOzet.hasActive && user?.id) {
      router.push(`/hikaye/${user.id}` as any);
      return;
    }
    medyaTikla('avatar');
  };

  const profilDuzenle = () => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    router.push('/profil-duzenle' as any);
  };

  const cuzdanaGit = () => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    router.replace('/(tabs)/wallet');
  };

  const displayName =
    profile?.display_name ??
    (isGuest ? t('ortak.misafir') : t('ortak.kullanici'));
  const username = profile?.username ?? t('profilTab.misafirUsername');
  const bio =
    profile?.bio?.trim() ||
    (isGuest ? t('profilTab.misafirBio') : t('profilTab.varsayilanBio'));
  const coverUri = MedyaUriGuvenli(profile?.cover_url);
  const avatarUri = MedyaUriGuvenli(profile?.avatar_url);

  const paylas = isGuest
    ? () => setUpgradeAcik(true)
    : () => router.push('/durum/olustur' as any);

  const profilLinkPaylas = async () => {
    if (!user?.id) return;
    const sonuc = await SeoAdresiniPaylas('profile', user.id);
    if (sonuc === 'yok') Alert.alert(t('ortak.paylas'), t('profil.baglantiKapali'));
  };

  return (
    <Screen edges={[]} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="kullanici-profili">
        <ScrollView
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scroll}
        >
          <ProfilXBaslik
            coverUri={coverUri}
            avatarUri={avatarUri}
            displayName={displayName}
            username={username}
            bio={bio}
            verified={!!profile?.is_verified}
            ajansSahibi={ajansSahibi}
            ajansSlot={
              isGuest || ajansYukleniyor ? null : ajansUyelik.role === 'pending' ? (
                <AjansProfilRozeti
                  varyant="beklemede"
                  ajans={ajansUyelik.agency}
                  onPress={() => router.push('/ajans/uye' as any)}
                />
              ) : ajansUyelik.agency ? (
                <AjansProfilRozeti
                  varyant="uye"
                  ajans={ajansUyelik.agency}
                  sahip={ajansSahibi || ajansUyelik.role === 'owner'}
                  onPress={() =>
                    router.push(`/ajans/profil/${ajansUyelik.agency!.id}` as any)
                  }
                />
              ) : (
                <AjansProfilRozeti
                  varyant="basvur"
                  onPress={() => router.push('/ajans' as any)}
                />
              )
            }
            titleId={
              privacy.hide_prestige
                ? null
                : profile?.selected_title_id ?? null
            }
            createdAt={profile?.created_at}
            country={profile?.country}
            publicUserId={profile?.public_user_id}
            guestBadge={isGuest}
            followingCount={stats?.following_count ?? 0}
            followersCount={stats?.followers_count ?? 0}
            postsCount={stats?.posts_count ?? 0}
            pendingFollowRequests={stats?.pending_follow_requests_count ?? 0}
            gosterTakip={!privacy.hide_following}
            gosterTakipci={!privacy.hide_followers}
            gosterGonderi
            level={Number(profile?.level) || 1}
            tacGizli={privacy.hide_crown}
            coverHExtra={insets.top}
            isimYani={
              user?.id ? (
                <ProfilAlinanHediyeButonu
                  userId={user.id}
                  adet={stats?.total_gifts_received ?? 0}
                />
              ) : null
            }
            onTakipPress={() =>
              user?.id &&
              router.push(`/takip/takip-edilenler?userId=${user.id}` as any)
            }
            onTakipciPress={() =>
              user?.id &&
              router.push(`/takip/takipciler?userId=${user.id}` as any)
            }
            onIstekPress={() => router.push('/takip/istekler' as any)}
            onCoverPress={() => medyaTikla('cover')}
            onAvatarPress={avatarTikla}
            onAvatarLongPress={() => medyaTikla('avatar')}
            hasStory={hikayeOzet.hasActive}
            hasUnseenStory={hikayeOzet.hasUnseen}
            storyPreviewUri={hikayeOzet.previewUrl}
            ustSag={
              <>
                {!isGuest && user?.id ? (
                  <Pressable
                    style={profilXOverlayBtnStyle}
                    onPress={() => void profilLinkPaylas()}
                    hitSlop={8}
                    accessibilityLabel={t('profil.baglantiyiPaylas')}
                  >
                    <Ionicons name="share-outline" size={20} color={RenkTokenlari.text} />
                  </Pressable>
                ) : null}
                <Pressable
                  style={profilXOverlayBtnStyle}
                  onPress={() => router.push('/profil-ayarlar' as any)}
                  hitSlop={8}
                  accessibilityLabel={t('profil.ayarlar')}
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={RenkTokenlari.text}
                  />
                </Pressable>
              </>
            }
            aksiyonSlot={
              <Pressable
                style={styles.duzenleBtn}
                onPress={profilDuzenle}
                accessibilityRole="button"
                accessibilityLabel={t('profil.duzenle')}
              >
                <Text style={styles.duzenleYazi}>{t('profil.duzenle')}</Text>
              </Pressable>
            }
          >
            <View style={styles.rozetBlok}>
              {stats && !privacy.hide_prestige ? (
                <PrestigeRozetSatiri
                  vipLevel={Number(stats.vip_level) || 0}
                  gifterLevel={stats.gifter_rank}
                  charmLevel={Number(stats.charm_level) || 0}
                  rechargeLevel={stats.recharge_rank}
                />
              ) : null}
              {ulkeLigiAcik && ulkeKatki?.show_on_profile && ulkeKatki.country_code ? (
                <View style={{ marginTop: BoslukTokenlari.sm }}>
                  <UlkeKatkisiKart
                    veri={ulkeKatki}
                    onPress={() =>
                      router.push(`/ulke/${ulkeKatki.country_code}` as never)
                    }
                  />
                </View>
              ) : null}
            </View>

            <TamusoBanner placement="PROFILE_TOP" screen="PROFILE" compact />

            <TamusoBanner placement="PROFILE_MIDDLE" screen="PROFILE" compact />

            <View style={styles.kisayolSatiri}>
              <Pressable
                onPress={cuzdanaGit}
                style={({ pressed }) => [styles.kisayolButon, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('cuzdan.baslik')}
              >
                <Ionicons name="wallet-outline" size={18} color={RenkTokenlari.accent} />
                <Text style={styles.kisayolMetin} numberOfLines={1}>
                  {t('cuzdan.baslik')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
              </Pressable>
            </View>

            <View style={styles.metrics}>
              <Metric
                label={t('profil.gonderilen')}
                value={String(stats?.total_gifts_sent ?? 0)}
                tint={RenkTokenlari.danger}
              />
              <Metric
                label={t('profil.alinan')}
                value={String(stats?.total_gifts_received ?? 0)}
                tint={RenkTokenlari.mint}
              />
              <Metric
                label={t('profil.seviye')}
                value={String(profile?.level ?? 1)}
                tint={RenkTokenlari.violet}
              />
              <Metric
                label={t('profil.tecrube')}
                value={formatSayi(profile?.xp ?? 0)}
                tint={RenkTokenlari.accent}
              />
            </View>

            {isGuest ? (
              <View style={styles.guestCta}>
                <GradientButton
                  title={t('ortak.hesabiTamamla')}
                  onPress={() => setUpgradeAcik(true)}
                />
              </View>
            ) : null}
          </ProfilXBaslik>

          <ProfilXGonderiSekme onPaylas={paylas} />
          <ModulHataSiniri modulAdi="profil-gonderiler" varyant="kart">
            <DurumProfilIzgarasi
              items={durumlar}
              yukleniyor={durumYukleniyor}
              baslikGizle
              yatayPadding
              bosMetin={
                isGuest
                  ? t('profilTab.misafirPaylasimBos')
                  : t('profilTab.paylasimBos')
              }
              onPress={(oge) => router.push(`/durum/${oge.id}` as any)}
            />
          </ModulHataSiniri>
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={() => setUpgradeAcik(false)}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
            Alert.alert(t('ortak.tamam'), t('profilTab.hesapGuncellendi'));
          }}
        />

        <ProfilMedyaBuyutucu
          uri={buyut?.uri ?? null}
          tur={buyut?.tur}
          onKapat={() => setBuyut(null)}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

function formatSayi(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '0';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.floor(v));
}

function Metric({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricN, { color: tint }]}>{value}</Text>
      <Text style={styles.metricL}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
  },
  duzenleBtn: {
    paddingVertical: 8,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  duzenleYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  rozetBlok: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    alignItems: 'stretch',
  },
  pressed: { opacity: 0.9 },
  kisayolSatiri: {
    flexDirection: 'row',
    marginHorizontal: BoslukTokenlari.lg,
    marginTop: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm,
  },
  kisayolButon: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  kisayolMetin: {
    ...TipografiTokenlari.body,
    flex: 1,
    fontWeight: '700',
    color: RenkTokenlari.text,
  },
  metrics: {
    flexDirection: 'row',
    marginHorizontal: BoslukTokenlari.lg,
    marginTop: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    overflow: 'hidden',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: BoslukTokenlari.md,
    gap: 2,
  },
  metricN: { ...TipografiTokenlari.caption, fontWeight: '800' },
  metricL: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
  },
  guestCta: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.lg,
  },
});
