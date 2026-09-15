import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../misafir-hesabi/islemler/useMisafirIslemKapisi';
import type { Gift } from '../../../types/models';
import { HediyeKatalogunuGetir } from '../okuma/HediyeKatalogunuGetir';
import { HEDIYE_FALLBACK_50 } from '../katalog/HediyeFallback50';
import { HediyeGonder } from './HediyeGonder';
import { HediyeAnimasyonuKuyrugu } from '../animasyon/HediyeAnimasyonuKuyrugu';

type GonderBaglam = {
  receiverId: string;
  roomId?: string | null;
  statusId?: string | null;
  animasyon?: boolean;
  onBasarili?: (gift: Gift, adet: number) => void;
};

/**
 * Sesli oda / canlı / mesaj / profil / durum — ortak hediye mağazası.
 */
export function useHediyeMagaza() {
  const { wallet, adjustWallet, refreshWallet, isGuest, user, profile } = useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc, islemiDene } =
    useMisafirIslemKapisi(isGuest);
  const [acik, setAcik] = useState(false);
  const [gifts, setGifts] = useState<Gift[]>(HEDIYE_FALLBACK_50);
  const [hedef, setHedef] = useState<{
    receiverId: string;
    roomId?: string | null;
    statusId?: string | null;
    aliciAdi?: string | null;
    animasyon?: boolean;
    onBasarili?: (gift: Gift, adet: number) => void;
  } | null>(null);

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
      animasyon?: boolean;
      onBasarili?: (gift: Gift, adet: number) => void;
    }) => {
      if (!opts.receiverId) {
        Alert.alert('Hediye', 'Alıcı bulunamadı.');
        return;
      }
      if (user?.id && opts.receiverId === user.id) {
        Alert.alert('Hediye', 'Kendine hediye gönderemezsin.');
        return;
      }
      islemiDene('hediye_gonder', () => {
        setHedef({
          receiverId: opts.receiverId,
          roomId: opts.roomId ?? null,
          statusId: opts.statusId ?? null,
          aliciAdi: opts.aliciAdi,
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
  }, []);

  const gonder = useCallback(
    (gift: Gift, quantity = 1) => {
      if (!hedef) return;
      const adet = Math.max(1, quantity);
      const baglam: GonderBaglam = hedef;

      islemiDene('hediye_gonder', async () => {
        if (gift.id.startsWith('fb_')) {
          Alert.alert('Hediye', 'Katalog yükleniyor — biraz sonra dene.');
          return;
        }
        const sonuc = await HediyeGonder({
          roomId: baglam.roomId ?? null,
          receiverId: baglam.receiverId,
          giftId: gift.id,
          quantity: adet,
          statusId: baglam.statusId ?? null,
        });
        if (!sonuc.ok) {
          Alert.alert('Hediye gönderilemedi', sonuc.hata);
          return;
        }
        if (sonuc.coinsSpent > 0) {
          adjustWallet({ coins: -sonuc.coinsSpent });
        }
        void refreshWallet();
        if (baglam.animasyon !== false) {
          HediyeAnimasyonuKuyrugu.ekle({
            giftId: gift.id,
            emoji: gift.emoji,
            name: adet > 1 ? `${gift.name} x${adet}` : gift.name,
            senderName: profile?.display_name ?? profile?.username ?? 'Sen',
            animationUrl: gift.animation_url,
            animationType: gift.animation_type,
            durationMs: gift.duration_ms ?? 2400,
            fullScreen:
              !!gift.full_screen || gift.coin_cost >= 999 || adet >= 77,
            coinCost: gift.coin_cost,
            quantity: adet,
          });
        }
        baglam.onBasarili?.(gift, adet);
        if (!baglam.onBasarili) {
          Alert.alert(
            'Hediye gönderildi',
            `${gift.emoji} ${gift.name}${adet > 1 ? ` ×${adet}` : ''}`,
          );
        }
        kapat();
      });
    },
    [hedef, islemiDene, adjustWallet, refreshWallet, kapat, profile],
  );

  const coinYukle = useCallback(() => {
    kapat();
    router.push('/(tabs)/wallet' as any);
  }, [kapat]);

  return {
    acik,
    ac,
    kapat,
    gonder,
    gifts,
    coins: wallet?.coins,
    aliciAdi: hedef?.aliciAdi,
    coinYukle,
    upgradeAcik,
    upgradeKapat,
    upgradeAc,
    isGuest,
  };
}
