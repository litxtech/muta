import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from '../../../contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../misafir-hesabi/islemler/useMisafirIslemKapisi';
import { useCoinYuklePaneli } from '../../cuzdan/islemler/useCoinYuklePaneli';
import type { Gift } from '../../../types/models';
import { HediyeKatalogunuGetir } from '../okuma/HediyeKatalogunuGetir';
import { HEDIYE_FALLBACK_50 } from '../katalog/HediyeFallback50';
import { HediyeGonder } from './HediyeGonder';
import { HediyeAnimasyonuKuyrugu } from '../animasyon/HediyeAnimasyonuKuyrugu';
import type { HediyePkAlici } from './HediyeMagazaTipleri';

/** Nested Modal (hediye → coin) Android/iOS'ta açılmaz — önce kapat, sonra aç */
const MODAL_GECIS_MS = Platform.OS === 'android' ? 140 : 90;

type GonderBaglam = {
  receiverId: string;
  roomId?: string | null;
  statusId?: string | null;
  liveSessionId?: string | null;
  pkAlicilar?: HediyePkAlici[];
  animasyon?: boolean;
  onBasarili?: (gift: Gift, adet: number) => void;
};

/**
 * Sesli oda / canlı / mesaj / profil / durum — ortak hediye mağazası.
 * Panel açık kalır; peş peşe gönderim (TikTok) — başarı Alert yok.
 */
export function useHediyeMagaza() {
  const { wallet, adjustWallet, refreshWallet, isGuest, user, profile } =
    useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } =
    useMisafirIslemKapisi(isGuest);
  const coinYuklePaneli = useCoinYuklePaneli();
  const coinYukleAc = coinYuklePaneli.ac;
  const [acik, setAcik] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const gonderKilit = useRef(false);
  const [gifts, setGifts] = useState<Gift[]>(HEDIYE_FALLBACK_50);
  const [hedef, setHedef] = useState<{
    receiverId: string;
    roomId?: string | null;
    statusId?: string | null;
    liveSessionId?: string | null;
    pkAlicilar?: HediyePkAlici[];
    aliciAdi?: string | null;
    animasyon?: boolean;
    onBasarili?: (gift: Gift, adet: number) => void;
  } | null>(null);
  const [seciliPkAliciId, setSeciliPkAliciId] = useState<string | null>(null);
  /** Coin paneli kapanınca hediyeyi geri aç */
  const hediyeGeriAcRef = useRef(false);

  useEffect(() => {
    void HediyeKatalogunuGetir()
      .then((rows) => {
        if (rows.length) setGifts(rows);
      })
      .catch(() => undefined);
  }, []);

  const ac = useCallback(
    (opts: {
      receiverId: string;
      aliciAdi?: string | null;
      roomId?: string | null;
      statusId?: string | null;
      liveSessionId?: string | null;
      pkAlicilar?: HediyePkAlici[];
      animasyon?: boolean;
      onBasarili?: (gift: Gift, adet: number) => void;
    }) => {
      const pkListe = (opts.pkAlicilar ?? []).filter(
        (a) => a.id && (!user?.id || a.id !== user.id),
      );
      const varsayilanId =
        pkListe.find((a) => a.id === opts.receiverId)?.id ??
        pkListe[0]?.id ??
        opts.receiverId;

      if (!varsayilanId) {
        Alert.alert('Hediye', 'Alıcı bulunamadı.');
        return;
      }
      if (user?.id && varsayilanId === user.id && pkListe.length === 0) {
        Alert.alert('Hediye', 'Kendine hediye gönderemezsin.');
        return;
      }
      islemiDene('hediye_gonder', () => {
        const secili = pkListe.find((a) => a.id === varsayilanId);
        setSeciliPkAliciId(varsayilanId);
        setHedef({
          receiverId: varsayilanId,
          roomId: opts.roomId ?? null,
          statusId: opts.statusId ?? null,
          liveSessionId: secili?.liveSessionId ?? opts.liveSessionId ?? null,
          pkAlicilar: pkListe.length > 1 ? pkListe : undefined,
          aliciAdi: secili?.ad ?? opts.aliciAdi,
          animasyon: opts.animasyon !== false,
          onBasarili: opts.onBasarili,
        });
        setAcik(true);
      });
    },
    [islemiDene, user?.id],
  );

  const kapat = useCallback(() => {
    setAcik(false);
    setHedef(null);
    setSeciliPkAliciId(null);
    gonderKilit.current = false;
    setGonderiyor(false);
  }, []);

  const gonder = useCallback(
    (gift: Gift, quantity = 1) => {
      if (!hedef || gonderKilit.current) return;
      const adet = Math.max(1, quantity);
      const seciliPk =
        hedef.pkAlicilar?.find((a) => a.id === seciliPkAliciId) ??
        hedef.pkAlicilar?.[0];
      const receiverId = seciliPk?.id ?? hedef.receiverId;
      const liveSessionId =
        seciliPk?.liveSessionId ?? hedef.liveSessionId ?? null;
      const baglam: GonderBaglam = {
        ...hedef,
        receiverId,
        liveSessionId,
      };
      const maliyet = gift.coin_cost * adet;
      const bakiye = wallet?.coins ?? 0;

      if (user?.id && receiverId === user.id) {
        Alert.alert('Hediye', 'Kendine hediye gönderemezsin.');
        return;
      }

      if (maliyet > bakiye) {
        hediyeGeriAcRef.current = true;
        setAcik(false);
        setTimeout(() => coinYukleAc(), MODAL_GECIS_MS);
        return;
      }

      if (gift.id.startsWith('fb_')) {
        Alert.alert('Hediye', 'Katalog yükleniyor — biraz sonra dene.');
        return;
      }

      islemiDene('hediye_gonder', () => {
        if (gonderKilit.current) return;
        gonderKilit.current = true;
        setGonderiyor(true);

        void (async () => {
          try {
            if (baglam.animasyon !== false) {
              HediyeAnimasyonuKuyrugu.ekle({
                giftId: gift.id,
                emoji: gift.emoji,
                name: gift.name,
                senderName:
                  profile?.display_name ?? profile?.username ?? 'Sen',
                animationUrl: gift.animation_url,
                animationType: gift.animation_type,
                durationMs: gift.duration_ms ?? (adet > 1 ? 2800 : 2400),
                fullScreen:
                  !!gift.full_screen || gift.coin_cost >= 999 || adet >= 77,
                coinCost: gift.coin_cost,
                quantity: adet,
              });
            }

            const sonuc = await HediyeGonder({
              roomId: baglam.roomId ?? null,
              receiverId,
              giftId: gift.id,
              quantity: adet,
              statusId: baglam.statusId ?? null,
              liveSessionId,
            });
            if (!sonuc.ok) {
              const yetersiz = /insufficient|yetersiz/i.test(sonuc.hata);
              if (yetersiz) {
                hediyeGeriAcRef.current = true;
                setAcik(false);
                setTimeout(() => coinYukleAc(), MODAL_GECIS_MS);
                return;
              }
              Alert.alert('Hediye gönderilemedi', sonuc.hata);
              return;
            }
            if (sonuc.coinsSpent > 0) {
              adjustWallet({ coins: -sonuc.coinsSpent });
            }
            void refreshWallet();
            baglam.onBasarili?.(gift, adet);
          } finally {
            gonderKilit.current = false;
            setGonderiyor(false);
          }
        })();
      });
    },
    [
      hedef,
      seciliPkAliciId,
      islemiDene,
      adjustWallet,
      refreshWallet,
      profile,
      wallet?.coins,
      coinYukleAc,
      user?.id,
    ],
  );

  const coinYukle = useCallback(() => {
    // Hediye Modal açıkken ikinci Modal açılmaz — önce kapat
    hediyeGeriAcRef.current = true;
    setAcik(false);
    setTimeout(() => coinYukleAc(), MODAL_GECIS_MS);
  }, [coinYukleAc]);

  const hediyeyiGeriAc = useCallback(() => {
    if (!hediyeGeriAcRef.current || !hedef) {
      hediyeGeriAcRef.current = false;
      return;
    }
    hediyeGeriAcRef.current = false;
    setTimeout(() => setAcik(true), MODAL_GECIS_MS);
  }, [hedef]);

  // Satın alma sonrası da (onClose tetiklenmez) hediyeyi geri aç
  useEffect(() => {
    if (coinYuklePaneli.acik) return;
    hediyeyiGeriAc();
  }, [coinYuklePaneli.acik, hediyeyiGeriAc]);

  const seciliPk =
    hedef?.pkAlicilar?.find((a) => a.id === seciliPkAliciId) ??
    hedef?.pkAlicilar?.[0];

  return {
    acik,
    ac,
    kapat,
    gonder,
    gonderiyor,
    gifts,
    coins: wallet?.coins,
    aliciAdi: seciliPk?.ad ?? hedef?.aliciAdi,
    pkAlicilar: hedef?.pkAlicilar,
    seciliPkAliciId,
    setSeciliPkAliciId,
    coinYukle,
    coinYuklePaneli,
    hediyeyiGeriAc,
    upgradeAcik,
    upgradeKapat,
    upgradeAc,
    isGuest,
  };
}
