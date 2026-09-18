/** Bildirim tıklanınca gidecek rota */
export function BildirimHedefYolu(input: {
  deep_link?: string | null;
  category?: string;
  payload?: Record<string, unknown> | null;
  actor_id?: string | null;
}): string | null {
  const p = input.payload ?? {};
  const str = (k: string) => {
    const v = p[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  const ham = (input.deep_link ?? '').trim();
  if (
    ham &&
    ham !== '/(tabs)/profile' &&
    ham !== '/profile' &&
    ham !== '/bildirimler'
  ) {
    return ham;
  }

  const thread = str('thread_id');
  if (thread) return `/mesaj/${thread}`;

  const live = str('live_id');
  if (live) return `/canli/${live}`;

  const status = str('status_id');
  if (status) return `/durum/${status}`;

  const room = str('room_id');
  if (room) return `/lobi/${room}`;

  const election = str('election_id');
  if (election) return `/sehir/secim/${election}`;

  const type = (str('type') ?? '').toLowerCase();
  if (
    type === 'city_election_start' ||
    type === 'city_election_voting' ||
    type === 'city_election_winner'
  ) {
    if (election) return `/sehir/secim/${election}`;
    return '/sehir/secim';
  }
  const actor =
    str('follower_id') ||
    str('sender_id') ||
    str('host_id') ||
    str('actor_id') ||
    input.actor_id ||
    null;

  if (type === 'follow_request') return '/takip/istekler';
  if ((type === 'follow' || type === 'new_follower' || type === 'follow_request_accepted') && actor) {
    return `/kullanici/${actor}`;
  }
  if (type === 'agency_host_approved') return '/ajans/uye';
  const agency = str('agency_id');
  if (type === 'agency_host_apply' && agency) return `/ajans/${agency}`;
  if (type === 'agency_host_rejected') return '/ajans';
  if (
    type === 'trade_offer_new' ||
    type === 'trade_offer_accepted' ||
    type === 'trade_offer_rejected'
  ) {
    return str('agency_id') ? '/ajans/teklifler' : '/cuzdan/takas?sekme=teklifler';
  }
  if (type === 'coin_purchase' || input.category === 'wallet') {
    return '/(tabs)/wallet';
  }
  if (actor) return `/kullanici/${actor}`;
  if (ham) return ham;
  return null;
}

export function BildirimTarihSaat(iso: string): { tarih: string; saat: string; kisa: string } {
  try {
    const d = new Date(iso);
    const tarih = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const saat = d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const fark = Date.now() - d.getTime();
    let kisa = `${tarih} · ${saat}`;
    if (fark < 60_000) kisa = 'Az önce';
    else if (fark < 3_600_000) kisa = `${Math.floor(fark / 60_000)} dk önce`;
    else if (fark < 86_400_000) kisa = `${Math.floor(fark / 3_600_000)} sa önce`;
    return { tarih, saat, kisa };
  } catch {
    return { tarih: '', saat: '', kisa: '' };
  }
}
