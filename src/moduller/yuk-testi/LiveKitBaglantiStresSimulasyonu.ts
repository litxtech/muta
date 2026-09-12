import { LiveKitBaglantiYoneticisi } from '../livekit/baglanti/LiveKitBaglantiYoneticisi';
import { GuvenlikOlayiKaydet } from '../guvenlik/olaylar/GuvenlikOlayiKaydet';
import { GracefulDegradationKarariVer } from '../ag-baglantisi/GracefulDegradationKarariVer';
import { AgBaglantiDurumunuGetir } from '../ag-baglantisi/okuma/AgBaglantiDurumunuGetir';
import { SertifikasyonKontrolGuncelle } from '../sertifikasyon/okuma/SertifikasyonKontrolleriniGetir';
import { supabase } from '../../lib/supabase';

/**
 * LiveKit baglanti izolasyon stres simulasyonu (mock token).
 * Gercek oda spam'i yapmaz; reconnect kapisini dogrular.
 */
export async function LiveKitBaglantiStresSimulasyonu(
  deneme = 5,
): Promise<{
  ok: boolean;
  basarili: number;
  basarisiz: number;
  sureMs: number;
  hata?: string;
}> {
  const ag = await AgBaglantiDurumunuGetir();
  const deg = GracefulDegradationKarariVer(ag);
  const basla = Date.now();
  let basarili = 0;
  let basarisiz = 0;

  if (!deg.livekitYenidenBaglanIzinli) {
    const sureMs = Date.now() - basla;
    await SertifikasyonKontrolGuncelle({
      code: 'livekit_reconnect',
      status: 'skip',
      details: { sebep: deg.sebep, sureMs },
    }).catch(() => undefined);
    return {
      ok: true,
      basarili: 0,
      basarisiz: 0,
      sureMs,
      hata: 'reconnect kapali (graceful)',
    };
  }

  const n = Math.min(Math.max(deneme, 1), 15);
  for (let i = 0; i < n; i++) {
    const r = await LiveKitBaglantiYoneticisi.baglan({
      url: 'wss://mock.local',
      token: 'mock.stress',
      roomName: `stress_${i}`,
      mock: true,
    });
    if (r.ok) basarili += 1;
    else basarisiz += 1;
    await LiveKitBaglantiYoneticisi.baglantiyiKes();
  }

  const sureMs = Date.now() - basla;
  GuvenlikOlayiKaydet('load_signal', {
    kind: 'livekit_stress',
    basarili,
    basarisiz,
    sureMs,
  });
  try {
    await supabase.rpc('yuk_sinyali_kaydet', {
      p_kind: 'livekit_stress',
      p_metadata: { basarili, basarisiz, sureMs },
    });
  } catch {
    /* migration 011 */
  }

  const ok = basarisiz === 0 && basarili === n;
  await SertifikasyonKontrolGuncelle({
    code: 'livekit_reconnect',
    status: ok ? 'pass' : 'fail',
    details: { basarili, basarisiz, sureMs },
  }).catch(() => undefined);

  return { ok, basarili, basarisiz, sureMs };
}
