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
import type { SonGezilenGorunum } from '../depolama/SonGezilenDepolama';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { kullaniciTemaKodunuAl, temaAcikMi } from '../../../tasarim-sistemi/tema/TemaDurumu';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  ogeler: SonGezilenGorunum[];
  onPress: (oge: SonGezilenGorunum) => void;
};

const MAKS_ICERIK_W = 480;
const KART_H = 116;

/** Son gezilenler — neon çerçeveli geniş kart (avatar + başlık + mikrofon) */
export function AnaSayfaSonGezilenSeridi({ ogeler, onPress }: Props) {
  useTemayaAboneOl();
  const { t } = useCeviri();
  const { width: ekranW } = useWindowDimensions();
  const acik = temaAcikMi(kullaniciTemaKodunuAl());

  if (ogeler.length === 0) return null;

  const icerikW = Math.min(ekranW, MAKS_ICERIK_W) - BoslukTokenlari.lg * 2;
  const kartW = Math.min(232, Math.round(icerikW * 0.58));

  return (
    <View style={styles.wrap}>
      <View style={styles.baslikSatir}>
        <View style={styles.baslikSol}>
          <AnaSayfaCanliNokta boyut={6} nabiz={false} />
          <Text style={styles.baslik}>{t('anaSayfa.sonGezilenler')}</Text>
        </View>
        <Text style={styles.sayi}>{ogeler.length}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serit}
        decelerationRate="fast"
      >
        {ogeler.map((oge) => {
          const yayinMi = oge.tur === 'canli';
          const avatar = MedyaUriGuvenli(oge.hostAvatar ?? oge.coverUrl);
          const harf = (
            (oge.hostAd ?? oge.title ?? '?').trim()[0] ?? '?'
          ).toLocaleUpperCase('tr-TR');
          const rozet = yayinMi
            ? t('anaSayfa.canliRozet')
            : t('olusturTab.rozetSes');

          return (
            <Pressable
              key={`${oge.tur}:${oge.id}`}
              onPress={() => onPress(oge)}
              style={({ pressed }) => [
                styles.kartPress,
                pressed && styles.pressed,
                !oge.canli && styles.kartSoluk,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('anaSayfa.gezilenA11y', {
                baslik:
                  oge.title ||
                  (yayinMi ? t('anaSayfa.yayin') : t('olusturTab.oda')),
                tur: yayinMi ? t('anaSayfa.yayin') : t('anaSayfa.sesOdasiKisa'),
              })}
            >
              <LinearGradient
                colors={[...RenkTokenlari.gradientPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cerceve, { width: kartW }]}
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

                  <View style={styles.ust}>
                    <View
                      style={[
                        styles.rozet,
                        {
                          borderColor: `${RenkTokenlari.primarySoft}66`,
                          backgroundColor: acik
                            ? 'rgba(232,64,145,0.08)'
                            : 'rgba(232,64,145,0.14)',
                        },
                      ]}
                    >
                      {oge.canli ? (
                        <AnaSayfaCanliNokta
                          boyut={5}
                          renk={RenkTokenlari.primarySoft}
                          nabiz={false}
                        />
                      ) : null}
                      <Text style={styles.rozetYazi}>{rozet}</Text>
                    </View>
                  </View>

                  <View style={styles.orta}>
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
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={styles.avatar} />
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

                    <View style={styles.metin}>
                      <Text style={styles.baslikKart} numberOfLines={2}>
                        {oge.title ||
                          (yayinMi ? t('anaSayfa.yayin') : t('olusturTab.oda'))}
                      </Text>
                      {oge.hostAd ? (
                        <Text style={styles.host} numberOfLines={1}>
                          {oge.hostAd.toLocaleUpperCase('tr-TR')}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.ikon}>
                      <Ionicons
                        name={yayinMi ? 'videocam' : 'mic'}
                        size={13}
                        color={RenkTokenlari.primarySoft}
                      />
                    </View>
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
  wrap: { marginBottom: BoslukTokenlari.md },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: BoslukTokenlari.sm,
  },
  baslikSol: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
  },
  serit: {
    paddingHorizontal: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    paddingVertical: 2,
  },
  kartPress: {},
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  kartSoluk: { opacity: 0.72 },
  cerceve: {
    height: KART_H,
    borderRadius: YaricapTokenlari.md + 2,
    padding: 1.5,
    shadowColor: RenkTokenlari.primary,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  kart: {
    flex: 1,
    borderRadius: YaricapTokenlari.md,
    overflow: 'hidden',
    padding: BoslukTokenlari.sm + 2,
    justifyContent: 'space-between',
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: RenkTokenlari.primarySoft,
  },
  orta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIc: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
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
    fontSize: 18,
  },
  metin: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  baslikKart: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 17,
  },
  host: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  ikon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,64,145,0.14)',
  },
});
