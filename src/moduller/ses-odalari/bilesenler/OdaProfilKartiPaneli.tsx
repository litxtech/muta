/**
 * Ses odası — profil kartı (aşağıdan yukarı kayar).
 * Kendi profil veya oda sahibi / yorum yazarı için kullanılır.
 */

import React, { memo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfilAvatarKucuk } from '../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { SeviyeTaci } from './SeviyeTaci';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  visible: boolean;
  onClose: () => void;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  level?: number | null;
  coins?: number | null;
  diamonds?: number | null;
  /** Sheet başlığı — örn. "Oda sahibi" */
  baslik?: string;
  onProfilAc?: () => void;
};

const SHEET_GIRIS = SlideInDown.duration(300).easing(Easing.out(Easing.cubic));
const SHEET_CIKIS = SlideOutDown.duration(220).easing(Easing.in(Easing.cubic));
const PERDE_GIRIS = FadeIn.duration(180);
const PERDE_CIKIS = FadeOut.duration(140);

const ALTIN = ['#FFF1B8', '#F0B429', '#C99214'] as const;

function formatSayi(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function OdaProfilKartiPaneliInner({
  visible,
  onClose,
  displayName,
  username,
  avatarUrl,
  bio,
  level,
  coins,
  diamonds,
  baslik = 'Profil bilgileri',
  onProfilAc,
}: Props) {
  const insets = useSafeAreaInsets();
  const ad = displayName?.trim() || username?.trim() || 'Profil';
  const handle = username?.trim() ? `@${username.trim()}` : null;
  const seviye = level && level > 0 ? level : 0;
  const cuzdanGoster = coins != null || diamonds != null;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          entering={PERDE_GIRIS}
          exiting={PERDE_CIKIS}
          style={styles.perde}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          />
        </Animated.View>

        <Animated.View
          entering={SHEET_GIRIS}
          exiting={SHEET_CIKIS}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8 },
          ]}
        >
          <LinearGradient
            colors={['#2A1C08', '#141018', '#0C0A10']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <View style={styles.baslikSatir}>
            <Text style={styles.baslik}>{baslik}</Text>
            <Pressable
              onPress={onClose}
              style={styles.kapatBtn}
              accessibilityLabel="Kapat"
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#FFE08A" />
            </Pressable>
          </View>

          <LinearGradient
            colors={[...ALTIN]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.kartCerceve}
          >
            <View style={styles.kartIc}>
              <View style={styles.avatarWrap}>
                <SeviyeTaci level={seviye} size="lg" avatarBoy={72}>
                  <ProfilAvatarKucuk
                    size={72}
                    displayName={displayName}
                    username={username}
                    avatarUrl={avatarUrl}
                  />
                </SeviyeTaci>
              </View>

              <Text style={styles.ad}>{ad}</Text>
              {handle ? <Text style={styles.handle}>{handle}</Text> : null}

              {seviye > 0 ? (
                <View style={styles.seviyePill}>
                  <Text style={styles.seviyeText}>Seviye {seviye}</Text>
                </View>
              ) : null}

              {bio?.trim() ? (
                <Text style={styles.bio} numberOfLines={3}>
                  {bio.trim()}
                </Text>
              ) : null}

              {cuzdanGoster ? (
                <View style={styles.istatistikler}>
                  <View style={styles.stat}>
                    <Text style={styles.statEmoji}>🪙</Text>
                    <Text style={styles.statDeger}>
                      {formatSayi(Math.max(0, coins ?? 0))}
                    </Text>
                    <Text style={styles.statEtiket}>Coin</Text>
                  </View>
                  <View style={styles.statAyir} />
                  <View style={styles.stat}>
                    <Text style={styles.statEmoji}>💎</Text>
                    <Text style={styles.statDeger}>
                      {formatSayi(Math.max(0, diamonds ?? 0))}
                    </Text>
                    <Text style={styles.statEtiket}>Elmas</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {onProfilAc ? (
            <Pressable
              onPress={() => {
                onClose();
                onProfilAc();
              }}
              style={styles.cta}
              accessibilityRole="button"
              accessibilityLabel="Tam profili aç"
            >
              <LinearGradient
                colors={[...ALTIN]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaIc}
              >
                <Text style={styles.ctaText}>Profil sayfasına git</Text>
                <Ionicons name="arrow-forward" size={18} color="#2A1800" />
              </LinearGradient>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

export const OdaProfilKartiPaneli = memo(OdaProfilKartiPaneliInner);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  perde: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: BoslukTokenlari.md,
    paddingTop: 10,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(240,180,41,0.35)',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,224,138,0.45)',
    marginBottom: 12,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: '#FFE08A',
    fontSize: 18,
    fontWeight: '800',
  },
  kapatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,180,41,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.28)',
  },
  kartCerceve: {
    borderRadius: 20,
    padding: 1.5,
  },
  kartIc: {
    borderRadius: 18.5,
    backgroundColor: 'rgba(18, 12, 6, 0.96)',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarWrap: {
    marginBottom: 12,
    position: 'relative',
  },
  ad: {
    ...TipografiTokenlari.title,
    color: '#FFF6D6',
    fontWeight: '900',
    fontSize: 22,
    textAlign: 'center',
  },
  handle: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,224,138,0.75)',
    marginTop: 4,
    fontWeight: '600',
  },
  seviyePill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(240,180,41,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.4)',
  },
  seviyeText: {
    ...TipografiTokenlari.micro,
    color: '#FFE08A',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bio: {
    ...TipografiTokenlari.body,
    color: 'rgba(255,246,214,0.72)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  istatistikler: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 8,
  },
  stat: {
    alignItems: 'center',
    minWidth: 88,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(240,180,41,0.1)',
  },
  statAyir: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(240,180,41,0.25)',
  },
  statEmoji: {
    fontSize: 16,
  },
  statDeger: {
    ...TipografiTokenlari.body,
    color: '#FFE08A',
    fontWeight: '800',
    marginTop: 4,
  },
  statEtiket: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,224,138,0.6)',
    marginTop: 2,
  },
  cta: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaIc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  ctaText: {
    ...TipografiTokenlari.body,
    color: '#2A1800',
    fontWeight: '800',
  },
});
