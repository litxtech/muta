/**
 * 1:1 görüşme oturumu — UI ekranından bağımsız yaşam döngüsü.
 * Minimize: sunum=minimized; LiveKit/DB bağlantısı açık kalır.
 * Bitir: GorusmeBitir + MedyaOdasiKes + oturumu temizle.
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { MedyaOdasiBaglan, MedyaOdasiKes } from '../../livekit/MedyaBaglantisi';
import { LiveKitBaglantiYoneticisi } from '../../livekit/baglanti/LiveKitBaglantiYoneticisi';
import {
  GorusmeBenimAktifleriBitir,
  GorusmeBitir,
  GorusmeGetir,
  MesajThreadKarsiProfil,
} from '../islemler/GorusmeIslemleri';
import { GorusmeEkranKorumaBaslat } from '../guvenlik/GorusmeEkranKoruma';
import type { DirectCall, ThreadKarsiProfil } from '../tipler';

const KEEP_TAG = 'gorusme-call';

export type GorusmeSunum = 'fullscreen' | 'minimized';

export type GorusmeOturumDurum = {
  callId: string;
  call: DirectCall;
  peer: ThreadKarsiProfil | null;
  muted: boolean;
  speaker: boolean;
  cameraOn: boolean;
  baglandi: boolean;
  mock: boolean;
  durumYazi: string;
  sunum: GorusmeSunum;
  /** Bağlantı kuruluyor / kuruldu */
  hazir: boolean;
  hata: string | null;
};

type Dinleyici = (d: GorusmeOturumDurum | null) => void;

let durum: GorusmeOturumDurum | null = null;
const dinleyiciler = new Set<Dinleyici>();
let kanal: RealtimeChannel | null = null;
let ringTimer: ReturnType<typeof setTimeout> | undefined;
let korumaStop: (() => void) | undefined;
let baslatmaSayaci = 0;

function yayinla() {
  dinleyiciler.forEach((fn) => fn(durum));
}

function patch(p: Partial<GorusmeOturumDurum>) {
  if (!durum) return;
  durum = { ...durum, ...p };
  yayinla();
}

export function GorusmeOturumAl(): GorusmeOturumDurum | null {
  return durum;
}

export function GorusmeOturumDinle(fn: Dinleyici): () => void {
  dinleyiciler.add(fn);
  fn(durum);
  return () => {
    dinleyiciler.delete(fn);
  };
}

function kanalTemizle() {
  if (ringTimer) {
    clearTimeout(ringTimer);
    ringTimer = undefined;
  }
  korumaStop?.();
  korumaStop = undefined;
  if (kanal) {
    void supabase.removeChannel(kanal);
    kanal = null;
  }
}

async function keepAc() {
  try {
    await activateKeepAwakeAsync(KEEP_TAG);
  } catch {
    /* ignore */
  }
}

function keepKapat() {
  void deactivateKeepAwake(KEEP_TAG);
}

/**
 * Tam temizlik — bağlantı + DB bitiş (isteğe bağlı) + state.
 * `dbBitir` false: karşı taraf zaten bitirdi / unmount ghost değil.
 */
export async function GorusmeOturumTamamenBitir(opts?: {
  reason?: string;
  dbBitir?: boolean;
}): Promise<void> {
  const callId = durum?.callId;
  const reason = opts?.reason ?? 'hangup';
  const dbBitir = opts?.dbBitir !== false;
  kanalTemizle();
  baslatmaSayaci += 1;
  durum = null;
  yayinla();
  keepKapat();
  if (dbBitir && callId) {
    try {
      await GorusmeBitir(callId, reason);
    } catch {
      /* DB fail olsa bile medyayı kes */
    }
  }
  await MedyaOdasiKes();
}

export function GorusmeOturumSunumAyarla(sunum: GorusmeSunum): void {
  if (!durum) return;
  // Minimize yalnızca aktif bağlantıda
  if (sunum === 'minimized' && !durum.baglandi) return;
  patch({ sunum });
}

export function GorusmeOturumMuteAyarla(muted: boolean): void {
  if (!durum) return;
  patch({ muted });
  LiveKitBaglantiYoneticisi.muteLocalAudio(muted);
}

export function GorusmeOturumSpeakerAyarla(speaker: boolean): void {
  if (!durum) return;
  patch({ speaker });
  void LiveKitBaglantiYoneticisi.setSpeakerphone(speaker);
}

export function GorusmeOturumKameraAyarla(cameraOn: boolean): void {
  if (!durum) return;
  patch({ cameraOn });
  if (durum.call.call_type === 'video') {
    LiveKitBaglantiYoneticisi.setLocalVideoEnabled(cameraOn);
  }
}

function realtimeKur(callId: string) {
  kanalTemizle();
  kanal = supabase
    .channel(`gorusme-oturum-${callId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        filter: `id=eq.${callId}`,
        table: 'direct_calls',
      },
      (payload) => {
        const next = payload.new as DirectCall;
        if (!durum || durum.callId !== callId) return;
        patch({ call: next });
        if (next.status === 'active') {
          if (ringTimer) {
            clearTimeout(ringTimer);
            ringTimer = undefined;
          }
          patch({ baglandi: true, durumYazi: 'Bağlandı' });
          if (next.call_type === 'video') {
            LiveKitBaglantiYoneticisi.setLocalVideoEnabled(true);
          }
          LiveKitBaglantiYoneticisi.muteLocalAudio(
            !!GorusmeOturumAl()?.muted,
          );
        }
        if (['ended', 'rejected', 'missed', 'cancelled'].includes(next.status)) {
          void GorusmeOturumTamamenBitir({
            reason: next.end_reason ?? 'remote_end',
            dbBitir: false,
          });
        }
      },
    )
    .subscribe();
}

/**
 * Ekran mount — mevcut oturum varsa yeniden bağlanma; yoksa kur.
 * Aynı callId için ikinci mount = fullscreen geri dönüş.
 */
export async function GorusmeOturumEkranAc(input: {
  callId: string;
  userId: string | undefined;
}): Promise<'reuse' | 'started' | 'ended' | 'error'> {
  const { callId, userId } = input;

  GorusmeOturumEkranKapandiIptal();

  if (durum?.callId === callId) {
    patch({ sunum: 'fullscreen' });
    return 'reuse';
  }

  // Farklı görüşme açıkken yenisini başlatma — eskisini kapat
  if (durum && durum.callId !== callId) {
    await GorusmeOturumTamamenBitir({ reason: 'replaced' });
  }

  const ticket = ++baslatmaSayaci;
  kanalTemizle();
  await keepAc();

  try {
    void (async () => {
      try {
        await supabase.rpc('gorusme_stale_temizle');
      } catch {
        /* RPC yoksa sorun değil */
      }
    })();

    const c = await GorusmeGetir(callId);
    if (ticket !== baslatmaSayaci) return 'error';

    if (['ended', 'rejected', 'missed', 'cancelled'].includes(c.status)) {
      keepKapat();
      return 'ended';
    }

    const isVideo = c.call_type === 'video';
    const benArayan = c.caller_id === userId;

    durum = {
      callId,
      call: c,
      peer: null,
      muted: false,
      speaker: isVideo,
      cameraOn: isVideo,
      baglandi: c.status === 'active',
      mock: false,
      durumYazi:
        c.status === 'ringing'
          ? benArayan
            ? 'Çalıyor…'
            : 'Bağlanıyor…'
          : c.status === 'active'
            ? 'Bağlandı'
            : 'Bağlanıyor…',
      sunum: 'fullscreen',
      hazir: false,
      hata: null,
    };
    yayinla();
    realtimeKur(callId);

    if (c.status === 'ringing' && benArayan) {
      ringTimer = setTimeout(() => {
        void GorusmeOturumTamamenBitir({ reason: 'ring_timeout' });
      }, 55_000);
    }

    if (isVideo) {
      await new Promise((r) => setTimeout(r, 120));
    }
    if (ticket !== baslatmaSayaci) return 'error';

    const [, medya] = await Promise.all([
      MesajThreadKarsiProfil(c.thread_id).then((p) => {
        if (ticket === baslatmaSayaci && durum?.callId === callId) {
          patch({ peer: p });
        }
      }),
      MedyaOdasiBaglan({
        roomName: c.channel_name,
        role: 'host',
        video: isVideo,
        gorusmeModu: true,
      }),
    ]);

    if (ticket !== baslatmaSayaci || !durum || durum.callId !== callId) {
      return 'error';
    }

    if (!medya.ok) {
      patch({ hata: medya.hata ?? 'Bağlanılamadı', durumYazi: medya.hata ?? 'Hata' });
      return 'error';
    }

    if (medya.mock) {
      patch({
        mock: true,
        hazir: true,
        durumYazi: 'Demo — ses/görüntü yok',
      });
      return 'started';
    }

    void LiveKitBaglantiYoneticisi.setSpeakerphone(isVideo);
    LiveKitBaglantiYoneticisi.muteLocalAudio(false);
    if (isVideo) {
      LiveKitBaglantiYoneticisi.setLocalVideoEnabled(true);
    }

    if (c.status === 'active' || durum.baglandi) {
      patch({ baglandi: true, durumYazi: 'Bağlandı', hazir: true, mock: false });
    } else {
      patch({ hazir: true, mock: false });
    }

    korumaStop = await GorusmeEkranKorumaBaslat(c.id);
    return 'started';
  } catch (e) {
    if (ticket === baslatmaSayaci) {
      const msg = e instanceof Error ? e.message : 'Açılamadı';
      patch({ hata: msg, durumYazi: msg });
      await GorusmeOturumTamamenBitir({ reason: 'start_error', dbBitir: true });
    }
    return 'error';
  }
}

/**
 * Ekran unmount:
 * - minimized → dokunma
 * - baglandi → otomatik minimize
 * - ringing → kısa gecikme (Strict Mode remount iptal eder), sonra bitir
 */
let kapandiZamanlayici: ReturnType<typeof setTimeout> | null = null;
let kapandiNesil = 0;

export function GorusmeOturumEkranKapandiIptal(): void {
  kapandiNesil += 1;
  if (kapandiZamanlayici) {
    clearTimeout(kapandiZamanlayici);
    kapandiZamanlayici = null;
  }
}

export function GorusmeOturumEkranKapandi(callId: string): void {
  if (!durum || durum.callId !== callId) return;
  if (durum.sunum === 'minimized') return;
  if (durum.baglandi) {
    patch({ sunum: 'minimized' });
    return;
  }

  const nesil = ++kapandiNesil;
  if (kapandiZamanlayici) clearTimeout(kapandiZamanlayici);
  kapandiZamanlayici = setTimeout(() => {
    kapandiZamanlayici = null;
    if (nesil !== kapandiNesil) return;
    if (!durum || durum.callId !== callId) return;
    if (durum.sunum === 'minimized' || durum.baglandi) return;
    void GorusmeOturumTamamenBitir({ reason: 'client_unmount' });
  }, 450);
}

/**
 * JS process ilk açılış (uygulama tamamen kapatılıp açılınca).
 * Background→foreground'da ÇALIŞMAZ — flag process ömrü boyunca kalır.
 * Takılı DB ringing/active + yerel session + LiveKit temizlenir.
 */
let acilisTemizligiYapildi = false;

export async function GorusmeUygulamaAcilisTemizligi(): Promise<void> {
  if (acilisTemizligiYapildi) return;
  acilisTemizligiYapildi = true;

  // Yerel ghost (HMR / kill sonrasi bellek)
  if (durum) {
    kanalTemizle();
    baslatmaSayaci += 1;
    durum = null;
    yayinla();
    keepKapat();
  }

  try {
    // Yalnızca birkaç saniyeden eski kayıtlar — yeni arama yarışını ezme
    await supabase.rpc('gorusme_stale_temizle');
    await GorusmeBenimAktifleriBitir('app_closed');
  } catch {
    /* ignore */
  }
  // Yeni arama başladıysa LiveKit'i kesme
  if (durum) return;
  try {
    await MedyaOdasiKes();
  } catch {
    /* ignore */
  }
}
