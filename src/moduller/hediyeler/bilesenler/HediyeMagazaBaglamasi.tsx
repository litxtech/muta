import React from 'react';
import { HediyeMagazaPaneli } from './HediyeMagazaPaneli';
import { HediyeAnimasyonKatmani } from './HediyeAnimasyonKatmani';
import { HesabiTamamlaKarti } from '../../misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useAuth } from '../../../contexts/AuthContext';
import type { useHediyeMagaza } from '../islemler/useHediyeMagaza';

type Magaza = ReturnType<typeof useHediyeMagaza>;

type Props = {
  magaza: Magaza;
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

  return (
    <>
      <HediyeMagazaPaneli
        visible={magaza.acik}
        gifts={magaza.gifts}
        coins={magaza.coins}
        aliciAdi={magaza.aliciAdi}
        onSend={magaza.gonder}
        onClose={magaza.kapat}
        onCoinYukle={magaza.coinYukle}
      />
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
