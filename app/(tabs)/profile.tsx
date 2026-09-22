import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { GradientButton } from '../../src/components/GradientButton';
import { YUZEN_TAB_ICERIK_BOSLUGU } from '../../src/components/YuzenTabBar';
import { useAuth } from '../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  ProfilIstatistikleriniGetir,
  type KullaniciProfilIstatistikleri,
} from '../../src/moduller/kullanici-profili/istatistik/ProfilIstatistikleriniGetir';
import { ProfilMedyaBuyutucu } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaBuyutucu';
import {
  OyunOyuncuIstatistikGetir,
  type OyunOyuncuIstatistik,
} from '../../src/moduller/oyunlar/ortak/servisler/OyunIstatistikServisi';
import { useGorunurOyunKodlari } from '../../src/moduller/oyunlar/ortak/hooks/useGorunurOyunKodlari';
import { KillSwitchAktifMi, OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { PrestigeRozetSatiri } from '../../src/moduller/vip/bilesenler/PrestigeRozetSatiri';
import { HesapDegeriRozeti } from '../../src/moduller/kullanici-profili/bilesenler/HesapDegeriRozeti';
import { useAjansUyeligi } from '../../src/moduller/ajanslar/kancalar/useAjansUyeligi';
import { AjansProfilRozeti } from '../../src/moduller/ajanslar/bilesenler/AjansProfilRozeti';
import { ProfilAvatarCerceve } from '../../src/moduller/kullanici-profili/bilesenler/ProfilAvatarCerceve';
import {
  GizlilikAyarlariniGetir,
  type GizlilikAyarlari,
} from '../../src/moduller/ayarlar/islemler/GizlilikAyarlariniYonet';
import { DurumProfilIzgarasi } from '../../src/moduller/durum/bilesenler/DurumProfilIzgarasi';
import {
  DurumKullanicisiniGetir,
  type DurumOggesi,
} from '../../src/moduller/durum/islemler/DurumIslemleri';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { TamusoBanner } from '../../src/banner';
import { TakipSayaciniFormatla } from '../../src/moduller/takip/TakipSayacFormat';

const COVER_H = 152;
const AVATAR = 92;

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
  hide_crown: false,
  hide_online_status: false,
  hide_followers: false,
  hide_following: false,
  hide_status_posts: false,
  hide_game_stats: false,
  is_private: false,
};

/** Profil — tek ayarlar, tek düzenle; butonlar üst üste binmez */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, wallet, user, isGuest, refreshProfile, refreshWallet } = useAuth();
  const { uyelik: ajansUyelik, yukleniyor: ajansYukleniyor } = useAjansUyeligi(!isGuest);
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const [oyunKartAcik, setOyunKartAcik] = useState(false);
  const coverH = COVER_H + insets.top;
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [privacy, setPrivacy] = useState<GizlilikAyarlari>(EMPTY_PRIVACY);
  const [oyunStats, setOyunStats] = useState<OyunOyuncuIstatistik | null>(null);
  const [buyut, setBuyut] = useState<{
    uri: string;
    tur: 'avatar' | 'cover';
  } | null>(null);
  const [durumlar, setDurumlar] = useState<DurumOggesi[]>([]);
  const [durumYukleniyor, setDurumYukleniyor] = useState(true);
  const oyunPlatformAcik =
    OzellikBayragiAktifMi('games_enabled') && !KillSwitchAktifMi('kill_games');
  const { anyVisible: oyunGorunur } = useGorunurOyunKodlari({
    enabled: oyunPlatformAcik,
  });
  const oyunProfiliAcik = oyunPlatformAcik && oyunGorunur;

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
      if (!user?.id) return;
      if (!isGuest) {
        void GizlilikAyarlariniGetir().then(setPrivacy);
      }
      ProfilIstatistikleriniGetir(user.id)
        .then(setStats)
        .catch(() => setStats(null));
      if (oyunProfiliAcik) {
        OyunOyuncuIstatistikGetir(user.id)
          .then(setOyunStats)
          .catch(() => setOyunStats(null));
      } else {
        setOyunStats(null);
      }
      setDurumYukleniyor(true);
      DurumKullanicisiniGetir(user.id, 48)
        .then(setDurumlar)
        .catch(() => setDurumlar([]))
        .finally(() => setDurumYukleniyor(false));
    }, [user?.id, refreshProfile, oyunProfiliAcik, isGuest]),
  );

  const medyaTikla = (tur: 'avatar' | 'cover') => {
    const url =
      tur === 'cover'
        ? typeof profile?.cover_url === 'string' &&
          /^https?:\/\//i.test(profile.cover_url.trim())
          ? profile.cover_url.trim()
          : null
        : typeof profile?.avatar_url === 'string' &&
            /^https?:\/\//i.test(profile.avatar_url.trim())
          ? profile.avatar_url.trim()
          : null;
    if (url) setBuyut({ uri: url, tur });
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
    profile?.display_name ?? (isGuest ? 'Misafir' : 'Kullanıcı');
  const username = profile?.username ?? 'misafir';
  const bio =
    profile?.bio?.trim() ||
    (isGuest
      ? 'Misafir hesabın — tam profil için hesabını tamamla.'
      : 'Tamuso’da ses, hediye ve canlı yayın.');
  const coverUri =
    typeof profile?.cover_url === 'string' &&
    /^https?:\/\//i.test(profile.cover_url.trim())
      ? profile.cover_url.trim()
      : null;
  const avatarUri =
    typeof profile?.avatar_url === 'string' &&
    /^https?:\/\//i.test(profile.avatar_url.trim())
      ? profile.avatar_url.trim()
      : null;

  return (
    <Screen edges={[]} tabSayfaKaydir>
      <ModulHataSiniri modulAdi="kullanici-profili">
        <ScrollView
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scroll}
        >
          {/* Kapak — tıkla büyüt; yükleme profil düzenlemede */}
          <View style={[styles.coverWrap, { height: coverH }]}>
            <Pressable
              onPress={() => medyaTikla('cover')}
              style={styles.coverPress}
              accessibilityLabel="Kapak fotoğrafı"
              disabled={!coverUri}
            >
              {coverUri ? (
                <Image
                  source={{ uri: coverUri }}
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
                colors={['transparent', 'rgba(18,16,24,0.75)']}
                style={styles.coverFade}
              />
            </Pressable>

            <View
              style={[
                styles.ustAksiyonlar,
                { top: insets.top + BoslukTokenlari.sm },
              ]}
            >
              <Pressable
                style={styles.ustBtn}
                onPress={profilDuzenle}
                hitSlop={8}
                accessibilityLabel="Profili düzenle"
              >
                <Ionicons name="create-outline" size={18} color={RenkTokenlari.text} />
              </Pressable>
              <Pressable
                style={styles.ustBtn}
                onPress={() => router.push('/profil-ayarlar' as any)}
                hitSlop={8}
                accessibilityLabel="Ayarlar"
              >
                <Ionicons name="settings-outline" size={20} color={RenkTokenlari.text} />
              </Pressable>
            </View>
          </View>

          {/* Avatar — taç çökerse düz avatar yedek */}
          <View style={styles.avatarBand}>
            <ModulHataSiniri
              modulAdi="profil-avatar"
              varyant="kart"
              yedek={
                <View style={styles.avatarHit}>
                  <Pressable
                    onPress={() => medyaTikla('avatar')}
                    style={styles.avatarWrap}
                    disabled={!avatarUri}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                      <LinearGradient
                        colors={[...RenkTokenlari.gradientPrimary]}
                        style={styles.avatar}
                      >
                        <Ionicons name="person" size={40} color="#12040C" />
                      </LinearGradient>
                    )}
                  </Pressable>
                </View>
              }
            >
              <View style={styles.avatarHit}>
                <ProfilAvatarCerceve
                  size={AVATAR}
                  level={Number(profile?.level) || 1}
                  gizli={privacy.hide_crown}
                >
                  <Pressable
                    onPress={() => medyaTikla('avatar')}
                    style={styles.avatarWrap}
                    accessibilityLabel="Profil fotoğrafı"
                    disabled={!avatarUri}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                      <LinearGradient
                        colors={[...RenkTokenlari.gradientPrimary]}
                        style={styles.avatar}
                      >
                        <Ionicons name="person" size={40} color="#12040C" />
                      </LinearGradient>
                    )}
                  </Pressable>
                </ProfilAvatarCerceve>
              </View>
            </ModulHataSiniri>
          </View>

          <TamusoBanner placement="PROFILE_TOP" screen="PROFILE" compact />

          {/* Kimlik — ortalı */}
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {profile?.is_verified ? (
                <Ionicons name="checkmark-circle" size={18} color={RenkTokenlari.mint} />
              ) : null}
            </View>
            <Text style={styles.username}>@{username}</Text>

            {(stats?.pending_follow_requests_count ?? 0) > 0 ? (
              <Pressable
                onPress={() => router.push('/takip/istekler' as any)}
                style={({ pressed }) => [
                  styles.followRow,
                  styles.followRowIstek,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.followN}>{stats?.pending_follow_requests_count}</Text>
                <Text style={styles.followL}>Takip isteği</Text>
              </Pressable>
            ) : null}
            <View style={styles.followRow}>
              <Pressable
                style={styles.followItem}
                onPress={() =>
                  user?.id &&
                  router.push(`/takip/takip-edilenler?userId=${user.id}` as any)
                }
                accessibilityRole="button"
                accessibilityLabel="Takip edilenler"
              >
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.following_count ?? 0)}
                </Text>
                <Text style={styles.followL}>Takip</Text>
              </Pressable>
              <View style={styles.followDivider} />
              <Pressable
                style={styles.followItem}
                onPress={() =>
                  user?.id &&
                  router.push(`/takip/takipciler?userId=${user.id}` as any)
                }
                accessibilityRole="button"
                accessibilityLabel="Takipçiler"
              >
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.followers_count ?? 0)}
                </Text>
                <Text style={styles.followL}>Takipçi</Text>
              </Pressable>
              <View style={styles.followDivider} />
              <View style={styles.followItem}>
                <Text style={styles.followN}>
                  {TakipSayaciniFormatla(stats?.posts_count ?? 0)}
                </Text>
                <Text style={styles.followL}>Gönderi</Text>
              </View>
            </View>

            {profile?.public_user_id ? (
              <Text style={styles.publicId}>ID {profile.public_user_id}</Text>
            ) : null}
            {isGuest ? (
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>MİSAFİR</Text>
              </View>
            ) : null}
            <Text style={styles.bio}>{bio}</Text>
            {stats && !privacy.hide_account_value ? (
              <HesapDegeriRozeti
                value={Number(stats.account_value) || 0}
                label={stats.account_value_label}
              />
            ) : null}
            {stats && !privacy.hide_prestige ? (
              <PrestigeRozetSatiri
                vipLevel={Number(stats.vip_level) || 0}
                gifterLevel={stats.gifter_rank}
                charmLevel={Number(stats.charm_level) || 0}
                rechargeLevel={stats.recharge_rank}
              />
            ) : null}
          </View>

          {/* Premium aksiyonlar — ortalı; ajans burada */}
          <View style={styles.aksiyonlar}>
            {!isGuest && !ajansYukleniyor && ajansUyelik.role === 'pending' ? (
              <AjansProfilRozeti
                varyant="beklemede"
                ajans={ajansUyelik.agency}
                tamGenislik
                onPress={() => router.push('/ajans/uye' as any)}
              />
            ) : !isGuest && !ajansYukleniyor && ajansUyelik.agency ? (
              <AjansProfilRozeti
                varyant="uye"
                ajans={ajansUyelik.agency}
                tamGenislik
                onPress={() =>
                  router.push(`/ajans/profil/${ajansUyelik.agency!.id}` as any)
                }
              />
            ) : !isGuest && !ajansYukleniyor ? (
              <AjansProfilRozeti
                varyant="basvur"
                tamGenislik
                onPress={() => router.push('/ajans' as any)}
              />
            ) : null}
          </View>

          <TamusoBanner placement="PROFILE_MIDDLE" screen="PROFILE" compact />

          {/* Cüzdan — yan yana düz bakiye kutuları */}
          <Pressable
            onPress={cuzdanaGit}
            style={({ pressed }) => [styles.walletPress, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Cüzdan"
          >
            <View style={styles.walletUst}>
              <View style={styles.walletSol}>
                <Text style={styles.walletBaslik}>Cüzdan</Text>
                <Text style={styles.walletAlt}>Coin ve elmas bakiyen</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={RenkTokenlari.textDim} />
            </View>
            <View style={styles.walletBakiyeRow}>
              <View style={styles.walletBakiyeKart}>
                <View style={[styles.walletDot, { backgroundColor: RenkTokenlari.accent }]} />
                <View style={styles.walletBakiyeCopy}>
                  <Text style={styles.walletBakiyeEtiket}>Coin</Text>
                  <Text style={styles.walletBakiyeDeger} numberOfLines={1}>
                    {formatSayi(wallet?.coins ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.walletBakiyeKart}>
                <View style={[styles.walletDot, { backgroundColor: RenkTokenlari.violet }]} />
                <View style={styles.walletBakiyeCopy}>
                  <Text style={styles.walletBakiyeEtiket}>Elmas</Text>
                  <Text style={styles.walletBakiyeDeger} numberOfLines={1}>
                    {formatSayi(wallet?.diamonds ?? 0)}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Oyun — cüzdan kartı düzeni; tıkla detay kartı */}
          {oyunProfiliAcik && !privacy.hide_game_stats ? (
            <Pressable
              onPress={() => setOyunKartAcik(true)}
              style={({ pressed }) => [styles.walletPress, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Oyun profili"
            >
              <View style={styles.walletUst}>
                <View style={styles.walletSol}>
                  <Text style={styles.walletBaslik}>Oyun</Text>
                  <Text style={styles.walletAlt}>
                    {oyunStats?.leagueLabel ?? 'Lig'} · profil kartın
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={RenkTokenlari.textDim} />
              </View>
              <View style={styles.walletBakiyeRow}>
                <View style={styles.walletBakiyeKart}>
                  <View style={[styles.walletDot, { backgroundColor: RenkTokenlari.accent }]} />
                  <View style={styles.walletBakiyeCopy}>
                    <Text style={styles.walletBakiyeEtiket}>Kupa</Text>
                    <Text style={styles.walletBakiyeDeger} numberOfLines={1}>
                      {formatSayi(oyunStats?.trophies ?? 0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.walletBakiyeKart}>
                  <View style={[styles.walletDot, { backgroundColor: RenkTokenlari.mint }]} />
                  <View style={styles.walletBakiyeCopy}>
                    <Text style={styles.walletBakiyeEtiket}>Galibiyet</Text>
                    <Text style={styles.walletBakiyeDeger} numberOfLines={1}>
                      {oyunStats?.wins ?? 0}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* Metrikler */}
          <View style={styles.metrics}>
            <Metric
              label="Gönderilen"
              value={String(stats?.total_gifts_sent ?? 0)}
              tint={RenkTokenlari.danger}
            />
            <Metric
              label="Alınan"
              value={String(stats?.total_gifts_received ?? 0)}
              tint={RenkTokenlari.mint}
            />
            <Metric
              label="Seviye"
              value={String(profile?.level ?? 1)}
              tint={RenkTokenlari.violet}
            />
            <Metric
              label="Tecrübe"
              value={formatSayi(profile?.xp ?? 0)}
              tint={RenkTokenlari.accent}
            />
          </View>

          {isGuest ? (
            <View style={styles.guestCta}>
              <GradientButton
                title="Hesabı tamamla"
                onPress={() => setUpgradeAcik(true)}
              />
            </View>
          ) : null}

          <ModulHataSiniri modulAdi="profil-gonderiler" varyant="kart">
            <DurumProfilIzgarasi
              items={durumlar}
              yukleniyor={durumYukleniyor}
              baslik="Gönderilerim"
              bosMetin={
                isGuest
                  ? 'Paylaşım için hesabını tamamla.'
                  : 'Henüz paylaşımın yok — ilk durumunu ekle.'
              }
              onPress={(oge) => router.push(`/durum/${oge.id}` as any)}
              onPaylas={
                isGuest
                  ? () => setUpgradeAcik(true)
                  : () => router.push('/durum/olustur' as any)
              }
            />
          </ModulHataSiniri>
        </ScrollView>

        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={() => setUpgradeAcik(false)}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
            Alert.alert('Tamam', 'Hesabın güncellendi.');
          }}
        />

        <OyunProfilKartModal
          visible={oyunKartAcik && oyunProfiliAcik}
          stats={oyunStats}
          onKapat={() => setOyunKartAcik(false)}
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

function OyunProfilKartModal({
  visible,
  stats,
  onKapat,
}: {
  visible: boolean;
  stats: OyunOyuncuIstatistik | null;
  onKapat: () => void;
}) {
  const hucreler = [
    { etiket: 'Kupa', deger: formatSayi(stats?.trophies ?? 0), tint: RenkTokenlari.accent },
    { etiket: 'Oyun XP', deger: formatSayi(stats?.xp ?? 0), tint: RenkTokenlari.violet },
    { etiket: 'Maç', deger: String(stats?.totalGames ?? 0), tint: RenkTokenlari.text },
    { etiket: 'Galibiyet', deger: String(stats?.wins ?? 0), tint: RenkTokenlari.mint },
    {
      etiket: 'En yüksek',
      deger: formatSayi(stats?.highestScore ?? 0),
      tint: RenkTokenlari.accent,
    },
    {
      etiket: 'Combo',
      deger: `×${stats?.highestCombo ?? 0}`,
      tint: RenkTokenlari.violet,
    },
  ] as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKapat}
      statusBarTranslucent
    >
      <Pressable style={styles.oyunModalMaske} onPress={onKapat}>
        <Pressable
          style={styles.oyunModalKart}
          onPress={(e) => e.stopPropagation()}
          accessibilityLabel="Oyun profil kartı"
        >
          <View style={styles.walletUst}>
            <View style={styles.walletSol}>
              <Text style={styles.walletBaslik}>Oyun profili</Text>
              <Text style={[styles.walletAlt, { color: RenkTokenlari.accent }]}>
                {stats?.leagueLabel ?? 'Lig'}
              </Text>
            </View>
            <Pressable
              onPress={onKapat}
              hitSlop={10}
              accessibilityLabel="Kapat"
              style={styles.oyunModalKapat}
            >
              <Ionicons name="close" size={18} color={RenkTokenlari.textMuted} />
            </Pressable>
          </View>

          <View style={styles.oyunModalGrid}>
            {hucreler.map((h) => (
              <View key={h.etiket} style={[styles.walletBakiyeKart, styles.oyunModalHucre]}>
                <View style={[styles.walletDot, { backgroundColor: h.tint }]} />
                <View style={styles.walletBakiyeCopy}>
                  <Text style={styles.walletBakiyeEtiket}>{h.etiket}</Text>
                  <Text style={styles.walletBakiyeDeger} numberOfLines={1}>
                    {h.deger}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.oyunModalAlt}>
            {(stats?.totalGames ?? 0) > 0
              ? `Galibiyet oranı %${stats?.winRate ?? 0}`
              : 'Ses odasında oyun oyna — XP ve kupa kazan.'}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: YUZEN_TAB_ICERIK_BOSLUGU,
  },
  coverWrap: {
    position: 'relative',
  },
  coverPress: {
    ...StyleSheet.absoluteFill,
  },
  cover: {
    width: '100%',
  },
  coverFade: {
    ...StyleSheet.absoluteFill,
  },
  gearBtn: {
    position: 'absolute',
    right: BoslukTokenlari.lg,
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
  ustAksiyonlar: {
    position: 'absolute',
    right: BoslukTokenlari.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  ustBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RenkTokenlari.chipFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  avatarBand: {
    alignItems: 'center',
    marginTop: -(AVATAR / 2 + 8),
    marginBottom: BoslukTokenlari.sm,
    zIndex: 2,
  },
  avatarHit: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: 4,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  name: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    flexShrink: 1,
    textAlign: 'center',
  },
  username: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  publicId: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
  guestBadge: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: RenkTokenlari.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  guestBadgeText: { ...TipografiTokenlari.micro, color: RenkTokenlari.accent },
  bio: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    marginTop: BoslukTokenlari.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  aksiyonlar: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    alignItems: 'stretch',
  },
  pressed: { opacity: 0.9 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: BoslukTokenlari.sm,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: RenkTokenlari.bgCard,
  },
  followRowIstek: {
    marginBottom: 0,
    justifyContent: 'center',
    gap: 6,
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
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  followL: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  walletPress: {
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    gap: BoslukTokenlari.md,
  },
  walletUst: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  walletSol: { flex: 1, gap: 2, minWidth: 0 },
  walletBaslik: {
    ...TipografiTokenlari.body,
    fontWeight: '700',
    color: RenkTokenlari.text,
  },
  walletAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  walletBakiyeRow: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
  },
  walletBakiyeKart: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingVertical: 10,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  walletBakiyeCopy: { flex: 1, minWidth: 0, gap: 1 },
  walletBakiyeEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  walletBakiyeDeger: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: RenkTokenlari.text,
  },
  metrics: {
    flexDirection: 'row',
    marginHorizontal: BoslukTokenlari.xl,
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
  oyunModalMaske: {
    flex: 1,
    backgroundColor: 'rgba(8,6,14,0.72)',
    justifyContent: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
  },
  oyunModalKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    gap: BoslukTokenlari.md,
  },
  oyunModalKapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  oyunModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
  },
  oyunModalHucre: {
    flexGrow: 0,
    flexBasis: '47%',
    maxWidth: '48%',
  },
  oyunModalAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  guestCta: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.lg,
  },
});
