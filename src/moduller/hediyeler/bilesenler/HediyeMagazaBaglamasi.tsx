import React from 'react';
import { HediyeMagazaPaneli } from './HediyeMagazaPaneli';
import { HediyeAnimasyonKatmani } from './HediyeAnimasyonKatmani';
import { HesabiTamamlaKarti } from '../../misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { CoinYuklePaneli } from '../../cuzdan/bilesenler/CoinYuklePaneli';
import { useAuth } from '../../../contexts/AuthContext';
import type { HediyeMagazaDurumu } from '../islemler/HediyeMagazaTipleri';

type Props = {
  magaza: HediyeMagazaDurumu;
  /** Animasyon katmanı (oda / canlı için true) */
  animasyon?: boolean;
  /** Misafir upgrade kartı (ekran zaten varsa false) */
  misafirKart?: boolean;
};

/** Ortak hediye paneli + misafir kartı + opsiyonel animasyon */
export function HediyeMagazaBaglamasi({
  magaza,
  animasyon = true,
  misafirKart = true,
}: Props) {
  const { refreshProfile, refreshWallet } = useAuth();
  const yukle = magaza.coinYuklePaneli;

  return (
    <>
      <HediyeMagazaPaneli
        visible={magaza.acik}
        gifts={magaza.gifts}
        coins={magaza.coins}
        aliciAdi={magaza.aliciAdi}
        pkAlicilar={magaza.pkAlicilar}
        seciliPkAliciId={magaza.seciliPkAliciId}
        onPkAliciSec={magaza.setSeciliPkAliciId}
        onSend={magaza.gonder}
        onClose={magaza.kapat}
        onCoinYukle={magaza.coinYukle}
        gonderiyor={magaza.gonderiyor}
      />
      {yukle ? (
        <CoinYuklePaneli
          visible={yukle.acik}
          packages={yukle.packages}
          locked={yukle.purchaseLocked}
          coins={magaza.coins}
          onBuy={yukle.satinAl}
          onClose={yukle.kapat}
          upgradeAcik={yukle.upgradeAcik}
          upgradeKapat={yukle.upgradeKapat}
        />
      ) : null}
      {animasyon ? <HediyeAnimasyonKatmani /> : null}
      {misafirKart ? (
        <HesabiTamamlaKarti
          visible={magaza.upgradeAcik}
          onClose={magaza.upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      ) : null}
    </>
  );
}
