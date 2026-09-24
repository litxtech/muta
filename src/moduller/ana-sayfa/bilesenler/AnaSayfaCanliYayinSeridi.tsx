import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AnaSayfaCanliNokta } from './AnaSayfaCanliNokta';
import { AnaSayfaPremiumBolumBasligi } from './AnaSayfaPremiumBolumBasligi';
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { SayiKisaBicim } from '../../../tasarim-sistemi/premium/SeviyeXpHesap';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri, type CeviriAnahtari } from '../../../i18n/useCeviri';

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
  onTumunuGor?: () => void;
};

const KART_W = 148;
const KART_H = 210;

const MODE_KEY: Record<string, CeviriAnahtari> = {
  party: 'modlar.parti',
  dating: 'modlar.flort',
  karaoke: 'modlar.karaoke',
  game: 'modlar.oyun',
  private: 'modlar.ozel',
  solo: 'modlar.tekli',
  pk: 'pk.baslik',
};

/** Yatay portrait canlı yayın carousel */
export function AnaSayfaCanliYayinSeridi({ ogeler, onPress, onTumunuGor }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();

  if (ogeler.length === 0) {
    return (
      <View style={styles.wrap}>
        <AnaSayfaPremiumBolumBasligi
          baslik={t('anaSayfa.canliYayinlar')}
          emoji="🔥"
          onTumunuGor={onTumunuGor}
        />
        <View style={styles.bos}>
          <Text style={styles.bosBaslik}>{t('anaSayfa.canliBosBaslik')}</Text>
          <Text style={styles.bosAlt}>{t('anaSayfa.canliBosAlt')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AnaSayfaPremiumBolumBasligi
        baslik={t('anaSayfa.canliYayinlar')}
        emoji="🔥"
        onTumunuGor={onTumunuGor}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {ogeler.map((oge, i) => {
          const kapak = MedyaUriGuvenli(oge.cover_url);
          const hostAd =
            oge.host?.display_name ??
            (oge.host?.username ? `@${oge.host.username}` : t('anaSayfa.yayinci'));
          const modKey = oge.mode ? MODE_KEY[oge.mode] : null;
          const mod = modKey ? t(modKey) : null;

          return (
            <Pressable
              key={`${oge.id}-${i}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [styles.kartPress, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.canliA11y', { baslik: oge.title })}
            >
              <View style={styles.kart}>
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
                  locations={[0.2, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />

                <View style={styles.ust}>
                  <LinearGradient
                    colors={[RenkTokenlari.live, RenkTokenlari.magenta]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.canliBadge}
                  >
                    <AnaSayfaCanliNokta boyut={5} renk="#fff" nabiz={false} />
                    <Text style={styles.canliBadgeYazi}>{t('anaSayfa.canliRozet')}</Text>
                  </LinearGradient>
                  {oge.listener_count > 0 ? (
                    <View style={styles.viewer}>
                      <Ionicons name="person" size={10} color="#fff" />
                      <Text style={styles.viewerYazi}>
                        {SayiKisaBicim(oge.listener_count)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.alt}>
                  <Text style={styles.baslik} numberOfLines={2}>
                    {oge.title}
                  </Text>
                  <Text style={styles.host} numberOfLines={1}>
                    {hostAd}
                  </Text>
                  {mod ? (
                    <View style={styles.tagSatir}>
                      <View style={styles.tag}>
                        <Text style={styles.tagYazi}>{mod}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: BoslukTokenlari.lg },
  serit: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  kartPress: { width: KART_W },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  kart: {
    width: KART_W,
    height: KART_H,
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,64,145,0.35)',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  ust: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  canliBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  canliBadgeYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  viewer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  viewerYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  alt: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    gap: 3,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 17,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.85,
    fontSize: 11,
  },
  tagSatir: { flexDirection: 'row', gap: 4, marginTop: 2 },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tagYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontSize: 9,
    fontWeight: '700',
  },
  bos: {
    marginHorizontal: BoslukTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: 4,
  },
  bosBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 15,
  },
  bosAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
