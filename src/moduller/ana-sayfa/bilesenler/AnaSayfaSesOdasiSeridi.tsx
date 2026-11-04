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

type Props = {
  ogeler: FeedOggesi[];
  onPress: (oge: FeedOggesi) => void;
  onTumunuGor?: () => void;
};

const MAKS_ICERIK_W = 480;
const AVATAR = 54;

/** Yatay ses odası şeridi — beyaz kart: oda avatarı, ad, sahibi, katılımcı sayısı */
export function AnaSayfaSesOdasiSeridi({ ogeler, onPress, onTumunuGor }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const acik = temaAcikMi(kullaniciTemaKodunuAl());
  const { width: ekranW } = useWindowDimensions();

  const icerikW = Math.min(ekranW, MAKS_ICERIK_W) - BoslukTokenlari.lg * 2;
  // İki kart tam, üçüncüsü kenardan görünür
  const kartW = Math.max(220, Math.round(icerikW * 0.62));

  if (ogeler.length === 0) {
    return (
      <View style={styles.wrap}>
        <AnaSayfaPremiumBolumBasligi
          baslik={t('anaSayfa.sesliSohbetOdalari')}
          emoji="🎧"
          onTumunuGor={onTumunuGor}
        />
        <View style={[styles.bos, acik && GolgeTokenlari.card]}>
          <View style={styles.bosIkon}>
            <Ionicons name="headset-outline" size={20} color={RenkTokenlari.magenta} />
          </View>
          <View style={styles.bosMetin}>
            <Text style={styles.bosBaslik}>{t('anaSayfa.sesBosBaslik')}</Text>
            <Text style={styles.bosAlt}>{t('anaSayfa.sesBosAlt')}</Text>
          </View>
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
          const avatar =
            MedyaUriGuvenli(oge.cover_url) ?? MedyaUriGuvenli(oge.host?.avatar_url);
          const hostAd =
            oge.host?.display_name?.trim() ||
            (oge.host?.username ? `@${oge.host.username}` : t('anaSayfa.evSahibi'));
          const harf = ((oge.title || hostAd).replace('@', '')[0] ?? 'O').toUpperCase();

          return (
            <Pressable
              key={`${oge.id}-${i}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.sesA11y', { baslik: oge.title })}
            >
              <View
                style={[styles.kart, { width: kartW }, acik && GolgeTokenlari.card]}
              >
                <View style={styles.avatarDis}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatar} />
                  ) : (
                    <LinearGradient
                      colors={[...RenkTokenlari.gradientPrimary]}
                      style={[styles.avatar, styles.avatarOrta]}
                    >
                      <Text style={styles.harf}>{harf}</Text>
                    </LinearGradient>
                  )}
                </View>

                <View style={styles.metin}>
                  <Text style={styles.baslik} numberOfLines={1}>
                    {oge.title}
                  </Text>
                  <Text style={styles.host} numberOfLines={1}>
                    {hostAd}
                  </Text>
                  <View style={styles.altSatir}>
                    <View style={styles.sayiHap}>
                      <Ionicons name="person" size={11} color={RenkTokenlari.primary} />
                      <Text style={styles.sayiYazi}>{SayiKisaBicim(oge.listener_count)}</Text>
                    </View>
                    <AnaSayfaSesCubuklari
                      yukseklik={16}
                      renk={acik ? 'rgba(122,26,184,0.35)' : 'rgba(196,59,255,0.5)'}
                    />
                  </View>
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
    paddingVertical: 4,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(122,26,184,0.16)',
  },
  avatarDis: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
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
    gap: 2,
  },
  baslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 14.5,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
  },
  altSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  sayiHap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(214,46,130,0.1)',
  },
  sayiYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primary,
    fontWeight: '800',
    fontSize: 11,
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
    backgroundColor: 'rgba(122,26,184,0.1)',
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
