import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Wallet } from '../../../types/models';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../i18n/diller';
import { CanliCoinSimgesi } from './CanliCoinSimgesi';
import { OzellikBilgiDugmesi } from '../../../bilesenler/bilgi/OzellikBilgiDugmesi';
import {
  BilgiKarti,
  CuzdanOzetTablosu,
  CuzdanYasalBaglantiKarti,
} from './CuzdanBilgiKartlari';
import { YayinciKazancKarti } from './YayinciKazancKarti';
import type { YayinciKazancOzeti } from '../yayinci/YayinciKazancApi';

const sayi = (n: number | undefined, locale: string) => (n ?? 0).toLocaleString(locale);

function BolumEtiketi({ metin }: { metin: string }) {
  return (
    <View style={styles.bolumBaslikSatir}>
      <Text style={styles.bolumEtiket}>{metin}</Text>
      <View style={styles.bolumCizgi} />
    </View>
  );
}

/**
 * Cüzdanım üst kartı: satın alınan Coin bakiyesi + Coin Yükle.
 * Hareketler, hediye geçmişi ve kazançlar ayrı giriş noktalarından açılır.
 */
export function CuzdanHero({
  wallet,
  purchaseLocked,
  onCoinYukle,
}: {
  wallet: Wallet | null | undefined;
  purchaseLocked: boolean;
  onCoinYukle: () => void;
}) {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];

  return (
    <LinearGradient
      colors={[RenkTokenlari.primary, RenkTokenlari.magenta, RenkTokenlari.violet]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={[styles.isik, styles.isikBuyuk]} />
      <View pointerEvents="none" style={[styles.isik, styles.isikKucuk]} />
      <View pointerEvents="none" style={styles.halka} />
      <View pointerEvents="none" style={styles.altinCizgi} />

      <View style={styles.markaSatir}>
        <View style={styles.markaSimge}>
          <Ionicons name="sparkles" size={12} color={RenkTokenlari.accent} />
        </View>
        <Text style={styles.markaYazi} numberOfLines={1}>
          {t('cuzdan.baslik')}
        </Text>
        <OzellikBilgiDugmesi konu="cuzdan" style={styles.markaBilgi} />
      </View>

      <View style={styles.bakiyeBlok}>
        <Text style={styles.bakiyeEtiket} numberOfLines={1}>
          {t('cuzdanBilgi.satinBakiye')}
        </Text>
        <View style={styles.heroBakiyeSatir}>
          <View style={styles.coinHale}>
            <CanliCoinSimgesi size={40} seviye={0.7} />
          </View>
          <Text
            style={styles.heroBakiye}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            accessibilityLabel={`${sayi(wallet?.coins, locale)} ${t('cuzdanY.coin')}`}
          >
            {sayi(wallet?.coins, locale)}
          </Text>
          <Text style={styles.heroBirim}>{t('cuzdanY.coin')}</Text>
        </View>
        <Text style={styles.heroNot} numberOfLines={2}>
          {t('cuzdanY.heroNot')}
        </Text>
      </View>

      <Pressable
        onPress={onCoinYukle}
        disabled={purchaseLocked}
        style={({ pressed }) => [
          styles.heroDugme,
          (pressed || purchaseLocked) && { opacity: 0.75 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('cuzdanY.coinYukle')}
      >
        <LinearGradient
          colors={['#FFFFFF', 'rgba(255,255,255,0.86)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroDugmeIc}
        >
          <View style={styles.heroDugmeIkon}>
            <Ionicons name="add" size={17} color={RenkTokenlari.textOnPrimary} />
          </View>
          <Text style={styles.heroDugmeYazi}>{t('cuzdanY.coinYukle')}</Text>
          <Ionicons name="arrow-forward" size={16} color={RenkTokenlari.primary} />
        </LinearGradient>
      </Pressable>
    </LinearGradient>
  );
}

/** Oyun Coin'i, Ödül Coin'i ve Yayıncı Kazancım kartları. */
export function CuzdanBakiyeKartlari({
  wallet,
  yayinciOzet,
  onYayinciKazanc,
}: {
  wallet: Wallet | null | undefined;
  yayinciOzet?: YayinciKazancOzeti | null;
  onYayinciKazanc?: () => void;
}) {
  const { t, dil } = useCeviri();
  const locale = DIL_LOCALE_MAP[dil];
  const bonus = wallet?.bonus_coins ?? 0;
  const ikiKart = bonus > 0;

  return (
    <View style={styles.bolum}>
      <BolumEtiketi metin={t('cuzdanY.bolumBakiyeler')} />
      <View style={styles.miniSatir}>
        <View style={[styles.mini, !ikiKart && styles.miniTek]}>
          <View style={[styles.miniIkon, { backgroundColor: `${RenkTokenlari.violet}26` }]}>
            <Ionicons name="game-controller" size={16} color={RenkTokenlari.violet} />
          </View>
          <Text style={styles.miniEtiket} numberOfLines={1}>
            {t('cuzdanY.kaynakOyun')}
          </Text>
          <Text
            style={styles.miniDeger}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {sayi(wallet?.game_coins, locale)}
          </Text>
          <Text style={styles.miniAlt} numberOfLines={2}>
            {t('cuzdanY.oyunKartAlt')}
          </Text>
        </View>

        {ikiKart ? (
          <View style={styles.mini}>
            <View style={[styles.miniIkon, { backgroundColor: `${RenkTokenlari.accent}26` }]}>
              <Ionicons name="gift" size={16} color={RenkTokenlari.accent} />
            </View>
            <Text style={styles.miniEtiket} numberOfLines={1}>
              {t('cuzdanY.kaynakOdul')}
            </Text>
            <Text
              style={styles.miniDeger}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {sayi(bonus, locale)}
            </Text>
            <Text style={styles.miniAlt} numberOfLines={2}>
              {t('cuzdanY.odulKartAlt')}
            </Text>
          </View>
        ) : null}
      </View>

      {onYayinciKazanc ? (
        <YayinciKazancKarti
          ozet={yayinciOzet ?? null}
          elmas={wallet?.diamonds}
          onPress={onYayinciKazanc}
        />
      ) : null}
    </View>
  );
}

type ErisimOgesi = {
  key: string;
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  renk: string;
  baslik: string;
  alt: string;
  onPress: () => void;
};

/** Hesap hareketleri, hediye geçmişi ve coin yükleme girişleri — tek kart. */
export function CuzdanErisimListesi({
  hareketlerAlt,
  hediyeAlt,
  onHareketler,
  onHediyeGecmisi,
  onCoinYukle,
}: {
  hareketlerAlt: string;
  hediyeAlt: string;
  onHareketler: () => void;
  onHediyeGecmisi: () => void;
  onCoinYukle: () => void;
}) {
  const { t } = useCeviri();
  const ogeler: ErisimOgesi[] = [
    {
      key: 'hareket',
      ikon: 'swap-vertical',
      renk: RenkTokenlari.mint,
      baslik: t('cuzdanY.hareketlerKart'),
      alt: hareketlerAlt,
      onPress: onHareketler,
    },
    {
      key: 'hediye',
      ikon: 'gift-outline',
      renk: RenkTokenlari.accent,
      baslik: t('cuzdanY.hediyeKart'),
      alt: hediyeAlt,
      onPress: onHediyeGecmisi,
    },
    {
      key: 'yukle',
      ikon: 'card-outline',
      renk: RenkTokenlari.primarySoft,
      baslik: t('cuzdanY.yukleKart'),
      alt: t('cuzdanY.yukleKartAlt'),
      onPress: onCoinYukle,
    },
  ];

  return (
    <View style={styles.bolum}>
      <BolumEtiketi metin={t('cuzdanY.hizliErisim')} />
      <View style={styles.erisimKart}>
        {ogeler.map((o, i) => (
          <Pressable
            key={o.key}
            onPress={o.onPress}
            style={({ pressed }) => [
              styles.erisimSatir,
              i === ogeler.length - 1 && styles.erisimSatirSon,
              pressed && { opacity: 0.82 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={o.baslik}
          >
            <View style={[styles.erisimIkon, { backgroundColor: `${o.renk}22` }]}>
              <Ionicons name={o.ikon} size={17} color={o.renk} />
            </View>
            <View style={styles.erisimCopy}>
              <Text style={styles.erisimBaslik} numberOfLines={1}>
                {o.baslik}
              </Text>
              <Text style={styles.erisimAlt} numberOfLines={1}>
                {o.alt}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={RenkTokenlari.textDim} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Bakiye türleri, kazanç ve ödeme koşulları.
 * Varsayılan kapalı: cüzdanın asıl içeriği (bakiye + hareketler) üstte kalır.
 */
export function CuzdanBilgiBolumu() {
  const { t } = useCeviri();
  const [acik, setAcik] = useState(false);

  return (
    <View style={styles.bolum}>
      <Pressable
        onPress={() => setAcik((a) => !a)}
        style={({ pressed }) => [styles.bilgiBaslik, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: acik }}
        accessibilityLabel={t('cuzdanY.bilgiBolum')}
      >
        <View style={styles.bilgiBaslikIkon}>
          <Ionicons
            name="shield-checkmark-outline"
            size={15}
            color={RenkTokenlari.mint}
          />
        </View>
        <View style={styles.bilgiBaslikCopy}>
          <Text style={styles.bilgiBaslikYazi}>{t('cuzdanY.bilgiBolum')}</Text>
          <Text style={styles.bilgiBaslikAlt} numberOfLines={1}>
            {t('cuzdanY.bilgiBolumAlt')}
          </Text>
        </View>
        <Ionicons
          name={acik ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={RenkTokenlari.textDim}
        />
      </Pressable>

      {acik ? (
        <View style={styles.bilgiIcerik}>
          <CuzdanOzetTablosu />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikCuzdan"
            metinAnahtari="cuzdanBilgi.kartMetinCuzdan"
            ikon="wallet-outline"
            renk={RenkTokenlari.primarySoft}
          />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikSatin"
            metinAnahtari="cuzdanBilgi.kartMetinSatin"
            ikon="card-outline"
            renk={RenkTokenlari.accent}
          />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikOyun"
            metinAnahtari="cuzdanBilgi.kartMetinOyun"
            ikon="game-controller-outline"
            renk={RenkTokenlari.violet}
          />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikElmas"
            metinAnahtari="cuzdanBilgi.kartMetinElmas"
            ikon="diamond-outline"
            renk={RenkTokenlari.primarySoft}
          />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikKazanc"
            metinAnahtari="cuzdanBilgi.kartMetinKazanc"
            ikon="trending-up-outline"
            renk={RenkTokenlari.mint}
          />
          <BilgiKarti
            baslikAnahtari="cuzdanBilgi.kartBaslikOdeme"
            metinAnahtari="cuzdanBilgi.kartMetinOdeme"
            ikon="calendar-outline"
            renk={RenkTokenlari.mint}
          />
          <CuzdanYasalBaglantiKarti />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bolum: { gap: BoslukTokenlari.sm, paddingHorizontal: 20 },
  bolumBaslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  bolumEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 1.4,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 10,
  },
  bolumCizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    paddingTop: 20,
    gap: 18,
    marginHorizontal: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  isik: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  isikBuyuk: { width: 280, height: 280, top: -140, right: -90 },
  isikKucuk: {
    width: 170,
    height: 170,
    bottom: -100,
    left: -60,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  halka: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    right: -70,
    bottom: -90,
  },
  altinCizgi: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1.5,
    backgroundColor: 'rgba(240,180,41,0.6)',
  },
  markaSatir: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  markaBilgi: { marginLeft: 'auto', borderColor: 'rgba(255,255,255,0.45)' },
  markaSimge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  markaYazi: {
    color: RenkTokenlari.textOnPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    opacity: 0.92,
  },
  bakiyeBlok: { gap: 6 },
  bakiyeEtiket: {
    color: RenkTokenlari.textOnPrimary,
    opacity: 0.62,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroBakiyeSatir: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinHale: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  heroBakiye: {
    flexShrink: 1,
    color: RenkTokenlari.textOnPrimary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  heroBirim: {
    color: RenkTokenlari.textOnPrimary,
    opacity: 0.66,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
    letterSpacing: 0.4,
  },
  heroNot: {
    color: RenkTokenlari.textOnPrimary,
    opacity: 0.74,
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 14,
  },
  heroDugme: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroDugmeIc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  heroDugmeIkon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  heroDugmeYazi: {
    flex: 1,
    color: RenkTokenlari.primary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  miniSatir: { flexDirection: 'row', gap: 12 },
  mini: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    padding: 15,
    gap: 7,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  miniTek: { flex: 1 },
  miniIkon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniEtiket: {
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  miniDeger: {
    color: RenkTokenlari.text,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  miniAlt: { color: RenkTokenlari.textDim, fontSize: 11, lineHeight: 15 },
  erisimKart: {
    borderRadius: 20,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  erisimSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  erisimSatirSon: { borderBottomWidth: 0 },
  erisimIkon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  erisimCopy: { flex: 1, minWidth: 0, gap: 2 },
  erisimBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontSize: 13.5,
    fontWeight: '800',
  },
  erisimAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10.5,
  },
  bilgiBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bilgiBaslikIkon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.mint}1F`,
  },
  bilgiBaslikCopy: { flex: 1, minWidth: 0, gap: 1 },
  bilgiBaslikYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontSize: 13,
    fontWeight: '800',
  },
  bilgiBaslikAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10.5,
  },
  bilgiIcerik: { gap: 10 },
});
