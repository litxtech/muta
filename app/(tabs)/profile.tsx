import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { ProfilMedyaSecenekleri } from '../../src/moduller/kullanici-profili/bilesenler/ProfilMedyaSecenekleri';
import { ProfilMedyasiSil } from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiSil';
import {
  ProfilMedyasiYukle,
  type ProfilMedyaTuru,
} from '../../src/moduller/kullanici-profili/islemler/ProfilMedyasiYukle';
import {
  OyunOyuncuIstatistikGetir,
  type OyunOyuncuIstatistik,
} from '../../src/moduller/oyunlar/ortak/servisler/OyunIstatistikServisi';
import { useGorunurOyunKodlari } from '../../src/moduller/oyunlar/ortak/hooks/useGorunurOyunKodlari';
import { KillSwitchAktifMi, OzellikBayragiAktifMi } from '../../src/moduller/ozellik-bayraklari/OzellikBayragiAktifMi';
import { PrestigeRozetSatiri } from '../../src/moduller/vip/bilesenler/PrestigeRozetSatiri';
import { useAjansYonetim } from '../../src/moduller/ajanslar/kancalar/useAjansYonetim';
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

const COVER_H = 152;
const AVATAR = 92;

/** Profil — tek ayarlar, tek düzenle; butonlar üst üste binmez */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, wallet, user, isGuest, refreshProfile, refreshWallet } = useAuth();
  const { yetkili: ajansYetkili, yonetimHref } = useAjansYonetim();
  const [upgradeAcik, setUpgradeAcik] = useState(false);
  const coverH = COVER_H + insets.top;
  const [stats, setStats] = useState<KullaniciProfilIstatistikleri | null>(null);
  const [oyunStats, setOyunStats] = useState<OyunOyuncuIstatistik | null>(null);
  const [medyaBusy, setMedyaBusy] = useState<ProfilMedyaTuru | null>(null);
  const [buyut, setBuyut] = useState<{ uri: string; tur: ProfilMedyaTuru } | null>(
    null,
  );
  const [medyaMenuTur, setMedyaMenuTur] = useState<ProfilMedyaTuru | null>(null);
  const [durumlar, setDurumlar] = useState<DurumOggesi[]>([]);
  const [durumYukleniyor, setDurumYukleniyor] = useState(false);
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
    }, [user?.id, refreshProfile, oyunProfiliAcik]),
  );

  const medyaUrl = (tur: ProfilMedyaTuru) =>
    tur === 'cover' ? profile?.cover_url ?? null : profile?.avatar_url ?? null;

  const medyaAc = (tur: ProfilMedyaTuru) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    setMedyaMenuTur(tur);
  };

  const medyaTikla = (tur: ProfilMedyaTuru) => {
    const url = medyaUrl(tur);
    if (url) {
      setBuyut({ uri: url, tur });
      return;
    }
    medyaAc(tur);
  };

  const medyaSec = async (tur: ProfilMedyaTuru) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    setMedyaMenuTur(null);
    setMedyaBusy(tur);
    const sonuc = await ProfilMedyasiYukle(tur);
    setMedyaBusy(null);
    if (!sonuc.ok) {
      if (sonuc.iptal) return;
      Alert.alert('Medya', sonuc.hata);
      return;
    }
    await refreshProfile();
  };

  const medyaSil = (tur: ProfilMedyaTuru) => {
    if (isGuest) {
      setUpgradeAcik(true);
      return;
    }
    const baslik = tur === 'cover' ? 'Kapak fotoğrafı' : 'Profil fotoğrafı';
    Alert.alert(baslik, 'Bu fotoğraf silinsin mi?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setMedyaMenuTur(null);
            setMedyaBusy(tur);
            const sonuc = await ProfilMedyasiSil(tur);
            setMedyaBusy(null);
            if (!sonuc.ok) {
              Alert.alert('Medya', sonuc.hata);
              return;
            }
            await refreshProfile();
          })();
        },
      },
    ]);
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
    router.navigate('/(tabs)/wallet');
  };

  const displayName =
    profile?.display_name ?? (isGuest ? 'Misafir' : 'Kullanıcı');
  const username = profile?.username ?? 'misafir';
  const bio =
    profile?.bio?.trim() ||
    (isGuest
      ? 'Misafir hesabın — tam profil için hesabını tamamla.'
      : 'Tamuso’da ses, hediye ve canlı yayın.');

  return (
    <Screen edges={[]}>
      <ModulHataSiniri modulAdi="kullanici-profili">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* Kapak — üst ekrana sıfır; tıkla büyüt; kamera menü; ayarlar sağda */}
          <View style={[styles.coverWrap, { height: coverH }]}>
            <Pressable
              onPress={() => medyaTikla('cover')}
              onLongPress={() => medyaAc('cover')}
              disabled={medyaBusy !== null}
              style={styles.coverPress}
              accessibilityLabel="Kapak fotoğrafı"
            >
              {profile?.cover_url ? (
                <Image
                  source={{ uri: profile.cover_url }}
                  style={[styles.cover, { height: coverH }]}
                />
              ) : (
                <LinearGradient
                  colors={['#3B1F4A', '#1A1228', '#121018']}
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

            <Pressable
              style={styles.coverHint}
              onPress={() => medyaAc('cover')}
              disabled={medyaBusy !== null}
              hitSlop={6}
              accessibilityLabel="Kapak fotoğrafı düzenle"
            >
              {medyaBusy === 'cover' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={14} color="#fff" />
                  <Text style={styles.coverHintText}>Kapak</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.gearBtn, { top: insets.top + BoslukTokenlari.sm }]}
              onPress={() => router.push('/profil-ayarlar' as any)}
              hitSlop={8}
              accessibilityLabel="Ayarlar"
            >
              <Ionicons name="settings-outline" size={20} color={RenkTokenlari.text} />
            </Pressable>
          </View>

          {/* Avatar — tıkla büyüt; kamera rozeti menü */}
          <View style={styles.avatarBand}>
            <View style={styles.avatarHit}>
              <Pressable
                onPress={() => medyaTikla('avatar')}
                onLongPress={() => medyaAc('avatar')}
                style={styles.avatarWrap}
                disabled={medyaBusy !== null}
                accessibilityLabel="Profil fotoğrafı"
              >
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPrimary]}
                    style={styles.avatar}
                  >
                    <Ionicons name="person" size={40} color="#12040C" />
                  </LinearGradient>
                )}
              </Pressable>
              <Pressable
                style={styles.avatarCam}
                onPress={() => medyaAc('avatar')}
                disabled={medyaBusy !== null}
                hitSlop={8}
                accessibilityLabel="Profil fotoğrafı düzenle"
              >
                {medyaBusy === 'avatar' ? (
                  <ActivityIndicator color="#12040C" size="small" />
                ) : (
                  <Ionicons name="camera" size={12} color="#12040C" />
                )}
              </Pressable>
            </View>
          </View>

          <TamusoBanner placement="PROFILE_TOP" screen="PROFILE" compact />

          {/* Kimlik */}
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
            {profile?.public_user_id ? (
              <Text style={styles.publicId}>ID {profile.public_user_id}</Text>
            ) : null}
            {isGuest ? (
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>MİSAFİR</Text>
              </View>
            ) : null}
            <Text style={styles.bio}>{bio}</Text>
            <PrestigeRozetSatiri
              vipLevel={stats?.vip_level ?? 0}
              gifterLevel={stats?.gifter_rank}
              charmLevel={stats?.charm_level ?? 1}
              rechargeLevel={stats?.recharge_rank}
            />
          </View>

          {/* Tek birincil aksiyon */}
          <View style={styles.primaryAction}>
            <Pressable
              onPress={profilDuzenle}
              style={({ pressed }) => [styles.editHit, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editBtn}
              >
                <Ionicons name="create-outline" size={18} color="#12040C" />
                <Text style={styles.editYazi}>Profili düzenle</Text>
              </LinearGradient>
            </Pressable>
          </View>

          <TamusoBanner placement="PROFILE_MIDDLE" screen="PROFILE" compact />

          {/* Takip */}
          <View style={styles.followRow}>
            <View style={styles.followItem}>
              <Text style={styles.followN}>{stats?.following_count ?? 0}</Text>
              <Text style={styles.followL}>Takip</Text>
            </View>
            <View style={styles.followDivider} />
            <View style={styles.followItem}>
              <Text style={styles.followN}>{stats?.followers_count ?? 0}</Text>
              <Text style={styles.followL}>Takipçi</Text>
            </View>
            <View style={styles.followDivider} />
            <View style={styles.followItem}>
              <Text style={styles.followN}>{stats?.charm_level ?? 1}</Text>
              <Text style={styles.followL}>Çekicilik</Text>
            </View>
          </View>

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

          {oyunStats && oyunProfiliAcik ? (
            <View style={styles.oyunKart}>
              <Text style={styles.oyunBaslik}>Oyun profili</Text>
              <Text style={styles.oyunLig}>{oyunStats.leagueLabel}</Text>
              <View style={styles.oyunGrid}>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>{formatSayi(oyunStats.trophies)}</Text>
                  <Text style={styles.oyunEtiket}>Kupa</Text>
                </View>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>{formatSayi(oyunStats.xp)}</Text>
                  <Text style={styles.oyunEtiket}>Oyun XP</Text>
                </View>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>{oyunStats.totalGames}</Text>
                  <Text style={styles.oyunEtiket}>Maç</Text>
                </View>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>{oyunStats.wins}</Text>
                  <Text style={styles.oyunEtiket}>Galibiyet</Text>
                </View>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>{formatSayi(oyunStats.highestScore)}</Text>
                  <Text style={styles.oyunEtiket}>En yüksek</Text>
                </View>
                <View style={styles.oyunHucre}>
                  <Text style={styles.oyunDeger}>×{oyunStats.highestCombo}</Text>
                  <Text style={styles.oyunEtiket}>Combo</Text>
                </View>
              </View>
              {oyunStats.totalGames > 0 ? (
                <Text style={styles.oyunAlt}>
                  Galibiyet oranı %{oyunStats.winRate}
                </Text>
              ) : (
                <Text style={styles.oyunAlt}>
                  Ses odasında Kristal Savaşı oyna — XP ve kupa kazan.
                </Text>
              )}
            </View>
          ) : null}

          {isGuest ? (
            <View style={styles.guestCta}>
              <GradientButton
                title="Hesabı tamamla"
                onPress={() => setUpgradeAcik(true)}
              />
            </View>
          ) : null}

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

          {/* Keşfet — düz modern satırlar */}
          <View style={styles.menu}>
            <Text style={styles.menuBaslik}>Keşfet</Text>
            <View style={styles.menuGrup}>
              <MenuSatiri
                icon="share-social-outline"
                label="Uygulamayı paylaş"
                alt="Davet linki · indirme"
                onPress={() => {
                  if (isGuest) {
                    setUpgradeAcik(true);
                    return;
                  }
                  router.push('/paylasim' as any);
                }}
              />
              <View style={styles.menuCizgi} />
              <MenuSatiri
                icon="radio-outline"
                label="Canlı yayın"
                alt="Yayına çık"
                onPress={() => router.push('/canli' as any)}
              />
              <View style={styles.menuCizgi} />
              <MenuSatiri
                icon="location-outline"
                label="Şehir"
                alt="Şehir odaları & lig"
                onPress={() => router.push('/sehir' as any)}
              />
              <View style={styles.menuCizgi} />
              <MenuSatiri
                icon="mic-outline"
                label="Ev sahibi"
                alt="Ev sahibi başvurusu"
                onPress={() => router.push('/host' as any)}
              />
              {ajansYetkili ? (
                <>
                  <View style={styles.menuCizgi} />
                  <MenuSatiri
                    icon="briefcase-outline"
                    label="Ajans Yönetim"
                    alt="Kurallar · ödeme · coin"
                    onPress={() => router.push(yonetimHref as any)}
                  />
                </>
              ) : null}
              <View style={styles.menuCizgi} />
              <MenuSatiri
                icon="compass-outline"
                label="Keşfet"
                alt="Odalar & yaratıcılar"
                onPress={() => router.push('/kesfet' as any)}
              />
            </View>
          </View>
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

        <ProfilMedyaBuyutucu
          uri={buyut?.uri ?? null}
          tur={buyut?.tur}
          onKapat={() => setBuyut(null)}
        />

        <ProfilMedyaSecenekleri
          visible={medyaMenuTur !== null}
          tur={medyaMenuTur}
          varMi={medyaMenuTur ? Boolean(medyaUrl(medyaMenuTur)) : false}
          busy={medyaBusy !== null}
          onKapat={() => setMedyaMenuTur(null)}
          onGoruntule={() => {
            if (!medyaMenuTur) return;
            const url = medyaUrl(medyaMenuTur);
            const tur = medyaMenuTur;
            setMedyaMenuTur(null);
            if (url) setBuyut({ uri: url, tur });
          }}
          onEkleVeyaDegistir={() => {
            if (medyaMenuTur) void medyaSec(medyaMenuTur);
          }}
          onSil={() => {
            if (medyaMenuTur) medyaSil(medyaMenuTur);
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

function formatSayi(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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

function MenuSatiri({
  icon,
  label,
  alt,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  alt: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuSatir, pressed && styles.menuSatirPressed]}
    >
      <Ionicons name={icon} size={20} color={RenkTokenlari.primarySoft} />
      <View style={styles.menuCopy}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuAlt}>{alt}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
    </Pressable>
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
    backgroundColor: 'rgba(18,4,12,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    zIndex: 2,
  },
  coverHint: {
    position: 'absolute',
    left: BoslukTokenlari.lg,
    bottom: BoslukTokenlari.md,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(18,4,12,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
  },
  coverHintText: { ...TipografiTokenlari.micro, color: '#fff' },
  avatarBand: {
    paddingHorizontal: BoslukTokenlari.xl,
    marginTop: -(AVATAR / 2),
    marginBottom: BoslukTokenlari.sm,
  },
  avatarHit: {
    width: AVATAR,
    height: AVATAR,
    position: 'relative',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    borderColor: RenkTokenlari.bg,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCam: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: RenkTokenlari.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: RenkTokenlari.bg,
    zIndex: 2,
  },
  identity: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: 4,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 26,
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  username: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  publicId: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  guestBadge: {
    alignSelf: 'flex-start',
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
  },
  primaryAction: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.lg,
  },
  editHit: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  editYazi: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: '#12040C',
  },
  pressed: { opacity: 0.9 },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.lg,
    paddingVertical: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
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
    borderColor: RenkTokenlari.border,
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
  oyunKart: {
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.lg,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 8,
  },
  oyunBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  oyunLig: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
  },
  oyunGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  oyunHucre: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  oyunDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  oyunEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  oyunAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  guestCta: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.lg,
  },
  menu: {
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  menuBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 1.2,
    marginBottom: 2,
    marginLeft: 4,
  },
  menuGrup: {
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  menuSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: 14,
    paddingHorizontal: BoslukTokenlari.md,
  },
  menuSatirPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  menuCizgi: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
    marginLeft: 48,
  },
  menuCopy: { flex: 1, minWidth: 0, gap: 2 },
  menuLabel: {
    ...TipografiTokenlari.body,
    fontWeight: '600',
    color: RenkTokenlari.text,
  },
  menuAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
});
