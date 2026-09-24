import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { premiumCtaGradient } from '../../../tasarim-sistemi/premium/PremiumAmbient';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { DogrulanmisTik } from '../../kullanici-profili/bilesenler/DogrulanmisTik';

export function AjansKart({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <View style={[styles.kart, accent && styles.kartAccent]}>
      {children}
    </View>
  );
}

export function AjansBolumBaslik({ children }: { children: string }) {
  return <Text style={styles.bolum}>{children}</Text>;
}

export function AjansHint({ children }: { children: string }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function AjansBos({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.bos}>
      <Ionicons name="ellipse-outline" size={28} color={RenkTokenlari.textDim} />
      <Text style={styles.bosBaslik}>{title}</Text>
      {body ? <Text style={styles.hint}>{body}</Text> : null}
    </View>
  );
}

export function AjansInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={RenkTokenlari.textDim}
      style={styles.input}
      {...props}
    />
  );
}

export function AjansCta({
  label,
  onPress,
  ghost,
  loading,
}: {
  label: string;
  onPress: () => void;
  ghost?: boolean;
  loading?: boolean;
}) {
  if (ghost) {
    return (
      <Pressable style={[styles.cta, styles.ctaGhost]} onPress={onPress}>
        <Text style={[styles.ctaYazi, styles.ctaGhostYazi]}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} disabled={loading}>
      <LinearGradient
        colors={[...premiumCtaGradient()]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.cta}
      >
        <Text style={styles.ctaYazi}>{loading ? '…' : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function AjansKpiHucre({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={[styles.kpi, emphasize && styles.kpiEmph]}>
      <Text style={[styles.kpiDeger, emphasize && styles.kpiDegerEmph]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function AjansCanliNokta({ aktif }: { aktif?: boolean }) {
  return (
    <View
      style={[
        styles.nokta,
        { backgroundColor: aktif ? RenkTokenlari.live : RenkTokenlari.textDim },
      ]}
    />
  );
}

export function AjansListeSatir({
  title,
  subtitle,
  avatarUrl,
  leading,
  trailing,
  onPress,
  live,
}: {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  live?: boolean;
}) {
  const uri = avatarUrl ? MedyaUriGuvenli(avatarUrl) : null;
  return (
    <Pressable
      style={styles.satir}
      onPress={onPress}
      disabled={!onPress}
    >
      {leading ?? (
        uri ? (
          <Image source={{ uri } as ImageSourcePropType} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarBos]}>
            <Ionicons name="person" size={14} color={RenkTokenlari.textDim} />
          </View>
        )
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.satirBaslikSatir}>
          {live ? <AjansCanliNokta aktif /> : null}
          <Text style={styles.satirBaslik} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.satirAlt} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
        ) : null)}
    </Pressable>
  );
}

export function AjansHeroKapak({
  name,
  subtitle,
  logoUrl,
  bannerUrl,
  levelLabel,
  verified,
  meta,
  actionLabel,
  onAction,
  children,
}: {
  name: string;
  subtitle?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  levelLabel?: string | null;
  verified?: boolean;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  const banner = bannerUrl ? MedyaUriGuvenli(bannerUrl) : null;
  const logo = logoUrl ? MedyaUriGuvenli(logoUrl) : null;

  return (
    <View style={styles.heroWrap}>
      <LinearGradient
        colors={[...RenkTokenlari.gradientPlaceholder]}
        style={styles.hero}
      >
        {banner ? (
          <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} />
        ) : null}
        <LinearGradient
          colors={[...RenkTokenlari.overlayGradient]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroIcerik}>
          <View style={styles.heroSatir}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoBos]}>
                <Ionicons name="business" size={22} color={RenkTokenlari.primarySoft} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.heroAd} numberOfLines={1}>
                {name}
              </Text>
              {subtitle ? (
                <Text style={styles.heroAlt} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
              <View style={styles.badgeSatir}>
                {levelLabel ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeYazi}>{levelLabel}</Text>
                  </View>
                ) : null}
                {verified ? (
                  <View style={[styles.badge, styles.badgeOk]}>
                    <DogrulanmisTik size={12} />
                    <Text style={styles.badgeYazi}>Doğrulandı</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          {meta ? <Text style={styles.heroMeta}>{meta}</Text> : null}
          {actionLabel && onAction ? (
            <Pressable style={styles.heroBtn} onPress={onAction}>
              <Text style={styles.heroBtnYazi}>{actionLabel}</Text>
            </Pressable>
          ) : null}
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.md,
    gap: 8,
    overflow: 'hidden',
  },
  kartAccent: {
    borderColor: RenkTokenlari.borderAccent,
  },
  bolum: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
    marginTop: 4,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  bos: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: BoslukTokenlari.xl,
  },
  bosBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.surface,
  },
  cta: {
    borderRadius: YaricapTokenlari.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  ctaYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '700',
  },
  ctaGhostYazi: { color: RenkTokenlari.text },
  kpi: {
    flexGrow: 1,
    flexBasis: '22%',
    maxWidth: '48%',
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  kpiEmph: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  kpiDeger: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  kpiDegerEmph: { color: RenkTokenlari.primarySoft },
  kpiLabel: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
  },
  nokta: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.divider,
  },
  satirBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  satirBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  satirAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RenkTokenlari.surface,
  },
  avatarBos: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWrap: {
    marginHorizontal: -BoslukTokenlari.lg,
    marginTop: -4,
  },
  hero: {
    minHeight: 168,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroIcerik: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  heroSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoBos: {
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAd: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '800',
  },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(247,242,248,0.72)',
  },
  heroMeta: {
    ...TipografiTokenlari.caption,
    color: 'rgba(247,242,248,0.6)',
  },
  badgeSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
  },
  badgeOk: {
    borderWidth: 1,
    borderColor: 'rgba(61,207,176,0.35)',
  },
  badgeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
  heroBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroBtnYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '700',
  },
});
