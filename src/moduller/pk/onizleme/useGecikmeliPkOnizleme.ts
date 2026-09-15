import { useEffect, useRef, useState } from 'react';

export type PkOnizlemeAnlik = {
  score_a: number;
  score_b: number;
  at: number;
};

/**
 * Canli skoru tamponlar; UI her zaman ~3 sn geriden gosterir.
 * Gercek video akisi yoksa bile "onizleme gecikmesi" hissi verir.
 */
export function useGecikmeliPkOnizleme(
  scoreA: number,
  scoreB: number,
  gecikmeMs = 3000,
): PkOnizlemeAnlik {
  const tampon = useRef<PkOnizlemeAnlik[]>([]);
  const [gorunen, setGorunen] = useState<PkOnizlemeAnlik>({
    score_a: scoreA,
    score_b: scoreB,
    at: Date.now() - gecikmeMs,
  });

  useEffect(() => {
    const now = Date.now();
    tampon.current.push({ score_a: scoreA, score_b: scoreB, at: now });
    // 6 sn'den eskiyi at
    tampon.current = tampon.current.filter((x) => now - x.at < gecikmeMs + 3000);
  }, [scoreA, scoreB, gecikmeMs]);

  useEffect(() => {
    const id = setInterval(() => {
      const hedef = Date.now() - gecikmeMs;
      const buf = tampon.current;
      if (!buf.length) return;
      let secili = buf[0];
      for (const s of buf) {
        if (s.at <= hedef) secili = s;
        else break;
      }
      setGorunen(secili);
    }, 200);
    return () => clearInterval(id);
  }, [gecikmeMs]);

  return gorunen;
}
