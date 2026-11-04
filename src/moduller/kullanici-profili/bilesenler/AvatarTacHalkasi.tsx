/**
 * Eski taç halkası API'si — PremiumAvatarCercevesi'ne yönlendirir.
 */

import React from 'react';
import { PremiumAvatarCercevesi } from '../avatar-cerceve/PremiumAvatarCercevesi';

export type AvatarTacYogunluk = 'oda' | 'profil';

type Props = {
  size: number;
  level?: number | null;
  gizli?: boolean;
  yogunluk?: AvatarTacYogunluk;
  animasyonlu?: boolean;
  children: React.ReactNode;
};

export function AvatarTacHalkasi({
  size,
  level,
  gizli = false,
  yogunluk = 'profil',
  animasyonlu = true,
  children,
}: Props) {
  return (
    <PremiumAvatarCercevesi
      size={size}
      level={level}
      gizli={gizli}
      variant={yogunluk === 'profil' ? 'buyuk' : 'orta'}
      disableAnimation={!animasyonlu}
    >
      {children}
    </PremiumAvatarCercevesi>
  );
}

export function ProfilAvatarCerceve({
  size,
  level,
  gizli,
  children,
}: {
  size: number;
  level?: number | null;
  gizli?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AvatarTacHalkasi size={size} level={level} gizli={gizli} yogunluk="profil">
      {children}
    </AvatarTacHalkasi>
  );
}
