import { AgBaglantiDurumunuGetir } from '../../ag-baglantisi/okuma/AgBaglantiDurumunuGetir';
import {
  KillSwitchAktifMi,
  OzellikBayragiAktifMi,
} from '../../ozellik-bayraklari/OzellikBayragiAktifMi';
import { MesajGonder, type MesajGonderGirdi } from './MesajGonder';
import {
  MesajOutboxEkle,
  MesajOutboxFlush,
} from '../depolama/MesajOutboxDepolama';
import type { DirektMesaj } from '../okuma/MesajlariGetir';

function outboxAcikMi(): boolean {
  if (KillSwitchAktifMi('kill_offline_outbox')) return false;
  return OzellikBayragiAktifMi('offline_outbox_enabled');
}

async function onlineMu(): Promise<boolean> {
  const d = await AgBaglantiDurumunuGetir();
  if (!d.bagli) return false;
  if (d.internetErisilebilir === false) return false;
  return true;
}

/**
 * Online → MesajGonder SSOT.
 * Offline + outbox flag → local queue (QUEUED), idempotent client_id.
 */
export async function MesajGonderVeyaKuyruk(input: {
  userId: string;
  girdi: MesajGonderGirdi & { clientId: string };
}): Promise<
  | { ok: true; mesaj: DirektMesaj; queued: false }
  | { ok: true; queued: true; clientId: string }
  | { ok: false; hata: string }
> {
  const { userId, girdi } = input;
  if (!girdi.clientId) {
    return { ok: false, hata: 'client_id required' };
  }

  const online = await onlineMu();
  if (!online && outboxAcikMi()) {
    await MesajOutboxEkle(userId, {
      client_id: girdi.clientId,
      thread_id: girdi.threadId,
      payload: girdi,
      status: 'QUEUED',
    });
    // last_error stored via update if needed
    return { ok: true, queued: true, clientId: girdi.clientId };
  }

  const sonuc = await MesajGonder(girdi);
  if (sonuc.ok) return { ok: true, mesaj: sonuc.mesaj, queued: false };

  // Transient failure → outbox for retry
  if (outboxAcikMi()) {
    await MesajOutboxEkle(userId, {
      client_id: girdi.clientId,
      thread_id: girdi.threadId,
      payload: girdi,
      status: 'QUEUED',
    });
    void MesajOutboxFlush(userId);
    return { ok: true, queued: true, clientId: girdi.clientId };
  }

  return { ok: false, hata: sonuc.hata };
}
