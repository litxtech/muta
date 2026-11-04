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
  GolgeTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { SayiKisaBicim } from '../../../tasarim-sistemi/premium/SeviyeXpHesap';
import { kullaniciTemaKodunuAl, temaAcikMi } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';
import { ulkeBayragi } from '../sabitler/UlkeEtiketleri';
import { PremiumAvatarCercevesi } from '../../kullanici-profili/avatar-cerceve/PremiumAvatarCercevesi';
import { AvatarCerceveBasamagi } from '../../kullanici-profili/avatar-cerceve/AvatarCerceveVarliklari';

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
  onTumunuGor?: () => void;
};

const DOGRULANMIS_MAVI = '#3D9BFF';
const MAKS_ICERIK_W = 480;
const AVATAR = 52;
/** Küçük çerçeve kutusu 40 / 0.74 ≈ 54 px; eski 52 px halkayla aynı yeri kaplar. */
const CERCEVELI_AVATAR = 40;

/** Yatay canlı yayın şeridi — beyaz kart: avatar, ad, canlı durumu, CANLI etiketi */
export function AnaSayfaCanliYayinSeridi({ ogeler, onPress, onTumunuGor }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const acik = temaAcikMi(kullaniciTemaKodunuAl());
  const { width: ekranW } = useWindowDimensions();

  const icerikW = Math.min(ekranW, MAKS_ICERIK_W) - BoslukTokenlari.lg * 2;
  // İki kart tam, üçüncüsü kenardan görünür
  const kartW = Math.max(220, Math.round((icerikW - BoslukTokenlari.sm) / 2));

  if (ogeler.length === 0) {
    return (
      <View style={styles.wrap}>
        <AnaSayfaPremiumBolumBasligi
          baslik={t('anaSayfa.canliYayinlar')}
          emoji="🔥"
          onTumunuGor={onTumunuGor}
        />
        <View style={[styles.bos, acik && GolgeTokenlari.card]}>
          <View style={styles.bosIkon}>
            <Ionicons name="videocam-outline" size={20} color={RenkTokenlari.primary} />
          </View>
          <View style={styles.bosMetin}>
            <Text style={styles.bosBaslik}>{t('anaSayfa.canliBosBaslik')}</Text>
            <Text style={styles.bosAlt}>{t('anaSayfa.canliBosAlt')}</Text>
          </View>
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
          const avatar =
            MedyaUriGuvenli(oge.host?.avatar_url) ?? MedyaUriGuvenli(oge.cover_url);
          const hostAd =
            oge.host?.display_name?.trim() ||
            (oge.host?.username ? `@${oge.host.username}` : t('anaSayfa.yayinci'));
          const harf = (hostAd.replace('@', '')[0] ?? 'T').toUpperCase();
          const ulke = oge.host?.country_code ?? null;
          const seviye = oge.host?.level;
          const foto = avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={[...RenkTokenlari.gradientPrimary]}
              style={[styles.avatar, styles.avatarOrta]}
            >
              <Text style={styles.harf}>{harf}</Text>
            </LinearGradient>
          );

          return (
            <Pressable
              key={`${oge.id}-${i}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.canliA11y', { baslik: oge.title })}
            >
              <View
                style={[
                  styles.kart,
                  { width: kartW },
                  acik && GolgeTokenlari.card,
                ]}
              >
                {AvatarCerceveBasamagi(seviye) != null ? (
                  <PremiumAvatarCercevesi level={seviye} size={CERCEVELI_AVATAR} variant="kucuk">
                    {foto}
                  </PremiumAvatarCercevesi>
                ) : (
                  <LinearGradient
                    colors={[RenkTokenlari.primary, RenkTokenlari.magenta]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.halka}
                  >
                    <View style={[styles.avatarIc, { backgroundColor: RenkTokenlari.bgElevated }]}>
                      {foto}
                    </View>
                  </LinearGradient>
                )}

                <View style={styles.metin}>
                  <View style={styles.adSatir}>
                    <Text style={styles.ad} numberOfLines={1}>
                      {hostAd}
                    </Text>
                    {oge.host?.is_verified ? (
                      <Ionicons name="checkmark-circle" size={13} color={DOGRULANMIS_MAVI} />
                    ) : null}
                  </View>
                  <View style={styles.durumSatir}>
                    <AnaSayfaCanliNokta boyut={6} renk={RenkTokenlari.live} nabiz={false} />
                    <Text style={styles.durumYazi} numberOfLines={1}>
                      {oge.listener_count > 0
                        ? `${SayiKisaBicim(oge.listener_count)} · ${t('chain.canliYayinda')}`
                        : t('chain.canliYayinda')}
                    </Text>
                    {ulke ? <Text style={styles.bayrak}>{ulkeBayragi(ulke)}</Text> : null}
                  </View>
                </View>

                <View style={styles.rozet}>
                  <Ionicons name="radio-outline" size={12} color={RenkTokenlari.primary} />
                  <Text style={styles.rozetYazi}>{t('chain.canliEtiket')}</Text>
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
    paddingVertical: 4,
    gap: BoslukTokenlari.sm,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  halka: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    padding: 2,
  },
  avatarIc: {
    flex: 1,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarOrta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.textOnPrimary,
    fontSize: 20,
  },
  metin: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  adSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ad: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 15,
    flexShrink: 1,
  },
  durumSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  durumYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  bayrak: {
    fontSize: 11,
    lineHeight: 14,
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(214,46,130,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,46,130,0.3)',
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bos: {
    marginHorizontal: BoslukTokenlari.lg,
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bosIkon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,46,130,0.1)',
  },
  bosMetin: { flex: 1, gap: 2 },
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
