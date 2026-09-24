import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  GolgeTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { Room } from '../../../types/models';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { useCeviri, type CeviriAnahtari } from '../../../i18n/useCeviri';

const MODE_KEY: Record<Room['mode'], CeviriAnahtari> = {
  party: 'modlar.parti',
  dating: 'modlar.flort',
  karaoke: 'modlar.karaoke',
  game: 'modlar.oyun',
  private: 'modlar.ozel',
};

type Props = {
  room: Room;
  onPress: () => void;
  onKesfet?: () => void;
};

/** Ana viewport’un görsel çapa sahnesi — markanın ürün yüzü */
export function AnaSayfaSahneKarti({ room, onPress, onKesfet }: Props) {
  const { t } = useCeviri();
  const kapak = MedyaUriGuvenli(room.cover_url ?? room.host?.avatar_url);

  return (
    <View style={styles.dis}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.press, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('anaSayfa.sahneyeGirA11y', { baslik: room.title })}
      >
        <View style={styles.sahne}>
          {kapak ? (
            <Image source={{ uri: kapak }} style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient
              colors={[...RenkTokenlari.gradientPlaceholder]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}

          <LinearGradient
            colors={[...RenkTokenlari.overlayGradient]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.atmosfera} pointerEvents="none">
            <View style={[styles.leke, styles.lekeSol]} />
            <View style={[styles.leke, styles.lekeSag]} />
          </View>

          <View style={styles.ustSerit}>
            <View style={styles.canliRozet}>
              <AnaSayfaCanliNokta boyut={6} />
              <Text style={styles.canliYazi}>{t('anaSayfa.simdiSahnede')}</Text>
            </View>
            <Text style={styles.mod}>{t(MODE_KEY[room.mode])}</Text>
          </View>

          <View style={styles.alt}>
            <Text style={styles.baslik} numberOfLines={2}>
              {room.title}
            </Text>
            {room.topic ? (
              <Text style={styles.aciklama} numberOfLines={2}>
                {room.topic}
              </Text>
            ) : null}
            {room.room_code ? (
              <Text style={styles.odaKod} numberOfLines={1}>
                {room.room_code}
              </Text>
            ) : null}
            <View style={styles.metaSatir}>
              <View style={styles.hostSatir}>
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPrimary]}
                  style={styles.avatar}
                >
                  <Ionicons name="person" size={12} color={RenkTokenlari.textOnPrimary} />
                </LinearGradient>
                <Text style={styles.host} numberOfLines={1}>
                  {room.host?.display_name ?? t('anaSayfa.evSahibi')}
                </Text>
              </View>
              <View style={styles.dinleyici}>
                <Ionicons name="headset" size={13} color={RenkTokenlari.primarySoft} />
                <Text style={styles.dinleyiciYazi}>{room.listener_count}</Text>
              </View>
            </View>

            <View style={styles.cta}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaIc}
              >
                <Text style={styles.ctaYazi}>{t('anaSayfa.sahneyeGir')}</Text>
                <Ionicons name="arrow-forward" size={16} color={RenkTokenlari.textOnPrimary} />
              </LinearGradient>
            </View>
          </View>
        </View>
      </Pressable>

      {onKesfet ? (
        <Pressable onPress={onKesfet} style={styles.kesfetBag} hitSlop={6}>
          <Text style={styles.kesfetYazi}>{t('anaSayfa.tumSahneleriKesfet')}</Text>
          <Ionicons name="compass-outline" size={14} color={RenkTokenlari.primarySoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

type BosProps = {
  onKesfet: () => void;
  onOlustur?: () => void;
};

export function AnaSayfaSahneBos({ onKesfet, onOlustur }: BosProps) {
  const { t } = useCeviri();
  return (
    <View style={styles.dis}>
      <LinearGradient
        colors={[...RenkTokenlari.gradientPlaceholder]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bosSahne}
      >
        <View style={styles.bosIcerik}>
          <Text style={styles.bosEyebrow}>{t('anaSayfa.sahneBekliyor')}</Text>
          <Text style={styles.bosBaslik}>{t('anaSayfa.ilkSahneyiSenAc')}</Text>
          <Text style={styles.bosAlt}>
            {t('anaSayfa.sahneBosAlt')}
          </Text>
          <View style={styles.bosAksiyonlar}>
            <Pressable onPress={onKesfet} style={styles.bosBtnAna}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                style={styles.bosBtnAnaIc}
              >
                <Text style={styles.bosBtnAnaYazi}>{t('kesfet.baslik')}</Text>
              </LinearGradient>
            </Pressable>
            {onOlustur ? (
              <Pressable onPress={onOlustur} style={styles.bosBtnIkincil}>
                <Text style={styles.bosBtnIkincilYazi}>{t('anaSayfa.odaKur')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    marginHorizontal: BoslukTokenlari.xl,
    marginBottom: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
  },
  press: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    ...GolgeTokenlari.soft,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  sahne: {
    minHeight: 248,
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
    justifyContent: 'space-between',
  },
  atmosfera: {
    ...StyleSheet.absoluteFill,
  },
  leke: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  lekeSol: {
    top: -30,
    left: -20,
    backgroundColor: 'rgba(232, 64, 145, 0.22)',
  },
  lekeSag: {
    bottom: 40,
    right: -30,
    backgroundColor: 'rgba(196, 59, 255, 0.18)',
  },
  ustSerit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.lg,
    paddingTop: BoslukTokenlari.lg,
  },
  canliRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: RenkTokenlari.chipFill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: 'rgba(232, 64, 145, 0.35)',
  },
  canliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  mod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  alt: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.textOnOverlay,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  aciklama: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.78,
    marginTop: 2,
    marginBottom: 2,
  },
  odaKod: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginTop: 2,
    marginBottom: 4,
  },
  metaSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.md,
  },
  hostSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.82,
    flex: 1,
  },
  dinleyici: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: RenkTokenlari.chipFill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
  },
  dinleyiciYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
  },
  cta: {
    marginTop: BoslukTokenlari.xs,
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  ctaIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ctaYazi: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: RenkTokenlari.textOnPrimary,
  },
  kesfetBag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingVertical: 2,
  },
  kesfetYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '600',
  },
  bosSahne: {
    minHeight: 220,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bosIcerik: {
    padding: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  bosEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
  },
  bosBaslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
  },
  bosAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: BoslukTokenlari.sm,
  },
  bosAksiyonlar: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    alignItems: 'center',
  },
  bosBtnAna: {
    borderRadius: YaricapTokenlari.pill,
    overflow: 'hidden',
  },
  bosBtnAnaIc: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bosBtnAnaYazi: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
    color: RenkTokenlari.textOnPrimary,
  },
  bosBtnIkincil: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  bosBtnIkincilYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
});
