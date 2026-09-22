import { useEffect, useRef } from 'react';
import { KonusmaciSesSeviyesi } from '../../livekit/ses/KonusmaciSesSeviyesi';
import {
  OdaMuzikDuckBaslat,
  OdaMuzikDuckBitir,
  OdaMuzikDuckHoldMs,
} from '../oynatici/OdaMuzikOynatici';

/**
 * LiveKit ActiveSpeakers → müzik ducking.
 * activeSpeakers set boş değilken kıs; hold sonrası yükselt.
 */
export function useOdaMuzikDucking(enabled: boolean) {
  const speakingIds = useRef(new Set<string>());
  const ducked = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      speakingIds.current.clear();
      ducked.current = false;
      OdaMuzikDuckBitir();
      return;
    }

    const sync = () => {
      const any = speakingIds.current.size > 0;
      if (any) {
        if (holdTimer.current) {
          clearTimeout(holdTimer.current);
          holdTimer.current = null;
        }
        if (!ducked.current) {
          ducked.current = true;
          OdaMuzikDuckBaslat();
        }
      } else if (ducked.current) {
        if (holdTimer.current) clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
          if (speakingIds.current.size === 0) {
            ducked.current = false;
            OdaMuzikDuckBitir();
          }
          holdTimer.current = null;
        }, OdaMuzikDuckHoldMs());
      }
    };

    const unsub = KonusmaciSesSeviyesi.dinle((userId, level) => {
      if (level > 0.05) speakingIds.current.add(userId);
      else speakingIds.current.delete(userId);
      sync();
    });

    return () => {
      unsub();
      if (holdTimer.current) clearTimeout(holdTimer.current);
      speakingIds.current.clear();
      ducked.current = false;
      OdaMuzikDuckBitir();
    };
  }, [enabled]);
}
