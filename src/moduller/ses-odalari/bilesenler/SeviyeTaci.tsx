/**
 * Oda / sohbet — avatarı saran seviye çerçevesi.
 */
import React from 'react';
import { PremiumAvatarCercevesi } from '../../kullanici-profili/avatar-cerceve/PremiumAvatarCercevesi';

type Props = {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  animasyonluMu?: boolean;
  gizli?: boolean;
  /** Avatar çapı — varsayılan size etiketinden */
  avatarBoy?: number;
  children: React.ReactNode;
};

const BOY: Record<'sm' | 'md' | 'lg', number> = {
  sm: 40,
  md: 52,
  lg: 72,
};

/** Avatarı saran seviye çerçevesi — children zorunlu (avatarla bütün) */
export function SeviyeTaci({
  level,
  size = 'sm',
  animasyonluMu = true,
  gizli = false,
  avatarBoy,
  children,
}: Props) {
  return (
    <PremiumAvatarCercevesi
      size={avatarBoy ?? BOY[size]}
      level={level}
      gizli={gizli}
      variant={size === 'sm' ? 'kucuk' : 'orta'}
      disableAnimation={!animasyonluMu}
    >
      {children}
    </PremiumAvatarCercevesi>
  );
}
