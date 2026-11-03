import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { ulkeAdi, ulkeBayragi } from '../sabitler/UlkeEtiketleri';

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
  onTumunuGor?: () => void;
};

const MODE_KEY: Record<string, CeviriAnahtari> = {
  party: 'modlar.parti',
  dating: 'modlar.flort',
  karaoke: 'modlar.karaoke',
  game: 'modlar.oyun',
  private: 'modlar.ozel',
  solo: 'modlar.tekli',
  pk: 'pk.baslik',
};

const DOGRULANMIS_MAVI = '#3D9BFF';
const MAKS_ICERIK_W = 480;

/** Yatay canlı yayın carousel — 3 kart görünür (tasarım: üçlü ızgara) */
export function AnaSayfaCanliYayinSeridi({ ogeler, onPress, onTumunuGor }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const { width: ekranW } = useWindowDimensions();

  const icerikW = Math.min(ekranW, MAKS_ICERIK_W) - BoslukTokenlari.lg * 2;
  const kartW = Math.max(96, Math.floor((icerikW - BoslukTokenlari.sm * 2) / 3));
  const kartH = Math.round(kartW * 1.2);

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
            oge.host?.display_name?.trim() ||
            (oge.host?.username ? `@${oge.host.username}` : t('anaSayfa.yayinci'));
          const modKey = oge.mode ? MODE_KEY[oge.mode] : null;
          const mod = modKey ? t(modKey) : null;
          const ulke = oge.host?.country_code ?? null;
          const ulkeMetni = ulkeAdi(ulke);
          const altMetin = ulkeMetni || mod;

          return (
            <Pressable
              key={`${oge.id}-${i}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [styles.kartPress, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.canliA11y', { baslik: oge.title })}
            >
              <View style={[styles.kart, { width: kartW, height: kartH }]}>
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
                    <Text style={styles.canliBadgeYazi}>
                      {t('anaSayfa.canliRozet')}
                    </Text>
                  </LinearGradient>
                  {oge.listener_count > 0 ? (
                    <View style={styles.viewer}>
                      <Ionicons name="eye" size={10} color="#fff" />
                      <Text style={styles.viewerYazi}>
                        {SayiKisaBicim(oge.listener_count)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.alt}>
                  <View style={styles.adSatir}>
                    <Text style={styles.ad} numberOfLines={1}>
                      {hostAd}
                    </Text>
                    {oge.host?.is_verified ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={13}
                        color={DOGRULANMIS_MAVI}
                      />
                    ) : null}
                  </View>
                  {altMetin ? (
                    <View style={styles.ulkeSatir}>
                      <Text style={styles.bayrak}>{ulkeBayragi(ulke)}</Text>
                      <Text style={styles.ulkeYazi} numberOfLines={1}>
                        {altMetin}
                      </Text>
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
    gap: BoslukTokenlari.sm,
  },
  kartPress: {},
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  kart: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232,64,145,0.42)',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  ust: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  canliBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
  },
  canliBadgeYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewerYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  alt: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    gap: 2,
  },
  adSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ad: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '800',
    fontSize: 12.5,
    lineHeight: 16,
    flexShrink: 1,
  },
  ulkeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bayrak: {
    fontSize: 10,
    lineHeight: 13,
  },
  ulkeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    opacity: 0.8,
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
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
