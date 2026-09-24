import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import type { OrtakTakipciOzeti } from '../TakipTipleri';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { useCeviri } from '../../../i18n/useCeviri';

const AVATAR = 22;
const OVERLAP = 8;

function etiket(
  p: OrtakTakipciOzeti['previews'][number],
  varsayilan: string,
): string {
  const u = p.username?.trim();
  if (u) return u;
  return p.display_name?.trim() || varsayilan;
}

/**
 * Instagram “Followed by …” —
 * yatay: örtüşen avatarlar + tek satır metin (isimler alt alta değil).
 * Örn: Takip eden: ayse, mehmet ve 4 kişi daha
 */
export function OrtakTakipciler({
  ozet,
  targetUserId,
}: {
  ozet: OrtakTakipciOzeti | null;
  targetUserId: string;
}) {
  const { t } = useCeviri();
  if (!ozet || ozet.count <= 0) return null;

  const varsayilanAd = t('ortak.kullanici');
  const yuzler = ozet.previews.slice(0, 3);
  const isimler = yuzler
    .map((p) => etiket(p, varsayilanAd))
    .filter(Boolean)
    .slice(0, 2);
  const diger = Math.max(0, ozet.count - isimler.length);

  const listeAc = () => {
    router.push(`/takip/ortak?userId=${targetUserId}` as any);
  };

  const erisim =
    isimler.length === 0
      ? `${t('takip.takipEdenOnEk')}${t('takip.kisiSayisi', { count: ozet.count })}`
      : diger > 0
        ? `${t('takip.takipEdenOnEk')}${isimler.join(', ')}${t('takip.veKisiDaha', { count: diger })}`
        : isimler.length === 1
          ? `${t('takip.takipEdenOnEk')}${isimler[0]}`
          : `${t('takip.takipEdenOnEk')}${isimler[0]}${t('takip.ayracVe')}${isimler[1]}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={listeAc}
      accessibilityRole="button"
      accessibilityLabel={erisim}
    >
      {yuzler.length > 0 ? (
        <View style={styles.avatars}>
          {yuzler.map((p, i) => {
            const avatar = MedyaUriGuvenli(p.avatar_url);
            const kaydir = i === 0 ? 0 : -OVERLAP;
            const z = yuzler.length - i;
            return avatar ? (
              <Image
                key={p.user_id}
                source={{ uri: avatar }}
                style={[
                  styles.av,
                  { marginLeft: kaydir, zIndex: z },
                ]}
              />
            ) : (
              <View
                key={p.user_id}
                style={[
                  styles.av,
                  styles.bos,
                  { marginLeft: kaydir, zIndex: z },
                ]}
              >
                <Text style={styles.harf}>
                  {etiket(p, varsayilanAd).slice(0, 1).toUpperCase()}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Tek Text ağacı = satır içi akış; alt alta isim listesi yok */}
      <Text style={styles.yazi} numberOfLines={1} ellipsizeMode="tail">
        <Text style={styles.onEk}>{t('takip.takipEdenOnEk')}</Text>
        {isimler.length === 0 ? (
          <Text style={styles.diger}>{t('takip.kisiSayisi', { count: ozet.count })}</Text>
        ) : (
          <>
            {isimler.map((ad, i) => (
              <React.Fragment key={`${ad}-${i}`}>
                {i > 0 ? (
                  <Text style={styles.ayrac}>
                    {i === isimler.length - 1 && diger <= 0
                      ? t('takip.ayracVe')
                      : ', '}
                  </Text>
                ) : null}
                <Text style={styles.ad}>{ad}</Text>
              </React.Fragment>
            ))}
            {diger > 0 ? (
              <Text style={styles.diger}>
                {t('takip.veKisiDaha', { count: diger })}
              </Text>
            ) : null}
          </>
        )}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: BoslukTokenlari.md,
    width: '100%',
    paddingHorizontal: BoslukTokenlari.sm,
  },
  pressed: { opacity: 0.75 },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  av: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.bg,
  },
  bos: {
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    ...TipografiTokenlari.caption,
    fontSize: 9,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  yazi: {
    ...TipografiTokenlari.caption,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    lineHeight: 16,
  },
  onEk: {
    color: RenkTokenlari.textDim,
    fontWeight: '500',
  },
  ad: {
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  ayrac: {
    color: RenkTokenlari.textMuted,
    fontWeight: '500',
  },
  diger: {
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
