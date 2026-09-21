import React from 'react';
import { useGorusmeOturumu } from '../oturum/useGorusmeOturumu';
import { GorusmeMiniBaloncuk } from './GorusmeMiniBaloncuk';

/** Root overlay — minimize + bağlı görüşmede baloncuk */
export function GorusmeGlobalKatman() {
  const oturum = useGorusmeOturumu();
  if (!oturum) return null;
  if (oturum.sunum !== 'minimized') return null;
  if (!oturum.baglandi) return null;
  return <GorusmeMiniBaloncuk oturum={oturum} />;
}
