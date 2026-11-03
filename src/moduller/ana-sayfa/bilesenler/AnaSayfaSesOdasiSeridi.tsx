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
import { AnaSayfaPremiumBolumBasligi } from './AnaSayfaPremiumBolumBasligi';
import { AnaSayfaSesCubuklari } from './AnaSayfaSesCubuklari';
import { OdaUyeAvatarYigini } from './OdaUyeAvatarYigini';
import type { FeedOggesi } from '../okuma/AnaSayfaIcerikleriniGetir';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { SayiKisaBicim } from '../../../tasarim-sistemi/premium/SeviyeXpHesap';
import { kullaniciTemaKodunuAl, temaAcikMi } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
  onTumunuGor?: () => void;
};

const MAKS_ICERIK_W = 480;

/** Yatay ses odası carousel — neon çerçeve + üye avatar önizleme */
export function AnaSayfaSesOdasiSeridi({
  ogeler,
  onPress,
  onTumunuGor,
}: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const acik = temaAcikMi(kullaniciTemaKodunuAl());
  const { width: ekranW } = useWindowDimensions();

  const icerikW = Math.min(ekranW, MAKS_ICERIK_W) - BoslukTokenlari.lg * 2;
  // Tasarım: iki kart tam, üçüncü kart sağdan görünür (peek)
  const kartW = Math.max(148, Math.round(icerikW * 0.43));
  const kartH = Math.round(kartW * 0.98);

  if (ogeler.length === 0) {
    return (
      <View style={styles.wrap}>
        <AnaSayfaPremiumBolumBasligi
          baslik={t('anaSayfa.sesliSohbetOdalari')}
          emoji="🎧"
          onTumunuGor={onTumunuGor}
        />
        <View style={styles.bos}>
          <Text style={styles.bosBaslik}>{t('anaSayfa.sesBosBaslik')}</Text>
          <Text style={styles.bosAlt}>{t('anaSayfa.sesBosAlt')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AnaSayfaPremiumBolumBasligi
        baslik={t('anaSayfa.sesliSohbetOdalari')}
        emoji="🎧"
        onTumunuGor={onTumunuGor}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {ogeler.map((oge, i) => {
          const hostAvatar = MedyaUriGuvenli(oge.host?.avatar_url);
          const hostAd =
            oge.host?.display_name ??
            (oge.host?.username ? `@${oge.host.username}` : t('anaSayfa.evSahibi'));
          const harf = (hostAd[0] ?? 'O').toUpperCase();
          const uyeAvatarlari =
            oge.uye_avatarlari && oge.uye_avatarlari.length > 0
              ? oge.uye_avatarlari
              : hostAvatar
                ? [hostAvatar]
                : [];

          return (
            <Pressable
              key={`${oge.id}-${i}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [
                styles.kartPress,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.sesA11y', { baslik: oge.title })}
            >
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cerceve, { width: kartW, minHeight: kartH }]}
              >
                <View style={styles.kart}>
                  <LinearGradient
                    colors={
                      acik
                        ? (['#FFFFFF', '#F8EEF5'] as const)
                        : ([...RenkTokenlari.gradientCard] as [string, string])
                    }
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.avatarBlok}>
                    <LinearGradient
                      colors={[
                        RenkTokenlari.primary,
                        RenkTokenlari.magenta,
                      ]}
                      style={styles.avatarRing}
                    >
                      <View
                        style={[
                          styles.avatarIc,
                          { backgroundColor: RenkTokenlari.bgElevated },
                        ]}
                      >
                        {hostAvatar ? (
                          <Image
                            source={{ uri: hostAvatar }}
                            style={styles.avatar}
                          />
                        ) : (
                          <LinearGradient
                            colors={[...RenkTokenlari.gradientPrimary]}
                            style={styles.avatar}
                          >
                            <Text style={styles.avatarHarf}>{harf}</Text>
                          </LinearGradient>
                        )}
                      </View>
                    </LinearGradient>
                  </View>

                  <Text style={styles.baslik} numberOfLines={1}>
                    {oge.title}
                  </Text>
                  <Text style={styles.host} numberOfLines={1}>
                    {hostAd.toLocaleUpperCase('tr-TR')}
                  </Text>

                  <View style={styles.meta}>
                    <View style={styles.metaOge}>
                      <Ionicons
                        name="gift"
                        size={11}
                        color={RenkTokenlari.primarySoft}
                      />
                      <Text style={styles.metaYazi}>
                        {SayiKisaBicim(oge.hediye_islem ?? 0)}
                      </Text>
                    </View>
                    {oge.listener_count > 0 ? (
                      <View style={styles.metaOge}>
                        <AnaSayfaSesCubuklari
                          yukseklik={11}
                          renk={RenkTokenlari.primarySoft}
                        />
                        <Text style={styles.metaYazi}>
                          {SayiKisaBicim(oge.listener_count)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.altSatir}>
                    <OdaUyeAvatarYigini
                      avatarlar={uyeAvatarlari}
                      max={5}
                      boyut={20}
                      overlap={7}
                      borderColor={acik ? '#FFFFFF' : RenkTokenlari.bgCard}
                    />
                  </View>
                </View>
              </LinearGradient>
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
    paddingVertical: 4,
  },
  kartPress: {},
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  cerceve: {
    borderRadius: YaricapTokenlari.lg,
    padding: 1.5,
    shadowColor: RenkTokenlari.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  kart: {
    flex: 1,
    borderRadius: YaricapTokenlari.lg - 1.5,
    overflow: 'hidden',
    padding: BoslukTokenlari.md,
    alignItems: 'center',
    gap: 3,
  },
  avatarBlok: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIc: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnPrimary,
    fontSize: 22,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },
  metaOge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 10.5,
  },
  altSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 'auto',
    paddingTop: 6,
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
