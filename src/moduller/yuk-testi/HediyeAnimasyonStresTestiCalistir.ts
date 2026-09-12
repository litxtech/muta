import { GuvenlikOlayiKaydet } from '../guvenlik/olaylar/GuvenlikOlayiKaydet';
import { supabase } from '../../lib/supabase';
import {
  HediyeAnimasyonuKuyrugu,
  type HediyeAnimasyonIslemi,
} from '../hediyeler/animasyon/HediyeAnimasyonuKuyrugu';
import { DusukCihazAnimasyonSiniri } from '../performans/DusukCihazModuAktifMi';
import { SertifikasyonKontrolGuncelle } from '../sertifikasyon/okuma/SertifikasyonKontrolleriniGetir';

/**
 * Hediye animasyon kuyrugu stres — LiveKit/mic thread'ini bloklamadan.
 * Gercek CDN asset indirmez; kuyruk/throughput olcer.
 */
export async function HediyeAnimasyonStresTestiCalistir(adet = 40): Promise<{
  ok: boolean;
  eklenen: number;
  dusuruldu: number;
  maxKuyruk: number;
  sureMs: number;
  hata?: string;
}> {
  const sinir = DusukCihazAnimasyonSiniri();
  const basla = Date.now();
  let eklenen = 0;
  let dusuruldu = 0;
  const hedef = Math.min(Math.max(adet, 1), 200);

  HediyeAnimasyonuKuyrugu.temizle();

  for (let i = 0; i < hedef; i++) {
    const fullScreen = sinir.fullScreenIzinli && i % 7 === 0;
    const islem: Omit<HediyeAnimasyonIslemi, 'id'> = {
      giftId: `stress_${i}`,
      emoji: '🎁',
      name: `Stress ${i}`,
      durationMs: Math.min(400, sinir.maxDurationMs),
      fullScreen,
    };
    const onceki = HediyeAnimasyonuKuyrugu.kuyrukBoyu();
    HediyeAnimasyonuKuyrugu.ekle(islem);
    const sonra = HediyeAnimasyonuKuyrugu.kuyrukBoyu();
    if (sonra > onceki || HediyeAnimasyonuKuyrugu.aktifVarMi()) {
      eklenen += 1;
    } else {
      dusuruldu += 1;
    }
    if (sonra > sinir.maxKuyruk) {
      // Kuyruk limiti HediyeAnimasyonuKuyrugu icinde uygulanir
      dusuruldu += 1;
    }
  }

  const sureMs = Date.now() - basla;
  GuvenlikOlayiKaydet('load_signal', {
    kind: 'gift_anim_stress',
    eklenen,
    dusuruldu,
    sureMs,
  });
  try {
    await supabase.rpc('yuk_sinyali_kaydet', {
      p_kind: 'gift_anim_stress',
      p_metadata: { eklenen, dusuruldu, sureMs, maxKuyruk: sinir.maxKuyruk },
    });
  } catch {
    /* migration 011 */
  }

  const ok = eklenen > 0 && sureMs < 5000;
  await SertifikasyonKontrolGuncelle({
    code: 'gift_stress',
    status: ok ? 'pass' : 'fail',
    details: { eklenen, dusuruldu, sureMs, maxKuyruk: sinir.maxKuyruk },
  }).catch(() => undefined);
  await SertifikasyonKontrolGuncelle({
    code: 'load_gift_queue',
    status: ok ? 'pass' : 'fail',
    details: { eklenen, dusuruldu, sureMs },
  }).catch(() => undefined);

  // Stres sonrasi temizle — UI'da uzun kuyruk birikmesin
  setTimeout(() => HediyeAnimasyonuKuyrugu.temizle(), 1500);

  return {
    ok,
    eklenen,
    dusuruldu,
    maxKuyruk: sinir.maxKuyruk,
    sureMs,
  };
}
