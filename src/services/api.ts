import { supabase } from '../lib/supabase';
import type { CoinPackage, Gift, Room, RoomSeat } from '../types/models';

export async function fetchLiveRooms(limit = 30): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('is_live', true)
    .order('listener_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Room[]) ?? [];
}

export async function createRoom(input: {
  hostId: string;
  title: string;
  topic?: string;
  mode: Room['mode'];
  maxSeats?: number;
  layoutCode?: string;
  themeCode?: string;
  capacityTierCode?: string;
  audienceCapacity?: number;
  microphoneCapacity?: number;
}): Promise<Room> {
  const maxSeats = Math.min(
    Math.max(input.maxSeats ?? input.microphoneCapacity ?? 8, 2),
    20,
  );

  const temel = {
    host_id: input.hostId,
    title: input.title,
    topic: input.topic ?? null,
    mode: input.mode,
    max_seats: maxSeats,
    is_live: true,
  };

  const genis = {
    ...temel,
    layout_code: input.layoutCode ?? 'floating_glass',
    theme_code: input.themeCode ?? 'midnight_plum',
    capacity_tier_code: input.capacityTierCode ?? 'social',
    audience_capacity: input.audienceCapacity ?? 250,
    microphone_capacity: input.microphoneCapacity ?? maxSeats,
  };

  let data: Room | null = null;
  let error: { message: string; code?: string } | null = null;

  const genisDeneme = await supabase.from('rooms').insert(genis).select('*').single();
  if (genisDeneme.error) {
    // Kolon yoksa (migration eksik) temel alanlarla dene
    const kod = genisDeneme.error.code ?? '';
    const mesaj = genisDeneme.error.message ?? '';
    if (kod === 'PGRST204' || /column|schema cache/i.test(mesaj)) {
      const temelDeneme = await supabase.from('rooms').insert(temel).select('*').single();
      data = (temelDeneme.data as Room) ?? null;
      error = temelDeneme.error;
    } else {
      error = genisDeneme.error;
    }
  } else {
    data = genisDeneme.data as Room;
  }

  if (error || !data) {
    throw new Error(error?.message ?? 'Oda olusturulamadi');
  }

  const seats = Array.from({ length: maxSeats }, (_, seat_index) => ({
    room_id: data!.id,
    seat_index,
    user_id: seat_index === 0 ? input.hostId : null,
  }));

  // Koltuk + üyelik paralel — oda açma süresini kısaltır
  const [seatsRes, memberRes] = await Promise.all([
    supabase.from('room_seats').insert(seats),
    supabase.from('room_members').insert({
      room_id: data.id,
      user_id: input.hostId,
      role: 'host',
    }),
  ]);

  if (seatsRes.error) {
    await supabase.from('rooms').delete().eq('id', data.id);
    throw new Error(seatsRes.error.message || 'Koltuklar olusturulamadi');
  }

  if (memberRes.error) {
    // Host zaten uye olabilir — kritik degil; oda kalsin
    const tekrar = await supabase
      .from('room_members')
      .select('room_id')
      .eq('room_id', data.id)
      .eq('user_id', input.hostId)
      .maybeSingle();
    if (!tekrar.data) {
      await supabase.from('rooms').delete().eq('id', data.id);
      throw new Error(memberRes.error.message || 'Host uyeligi olusturulamadi');
    }
  }

  return data;
}

export async function fetchRoom(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, host:profiles!rooms_host_id_fkey(*)')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  return data as Room | null;
}

export async function fetchRoomSeats(roomId: string): Promise<RoomSeat[]> {
  const { data, error } = await supabase
    .from('room_seats')
    .select('*, profile:profiles(*)')
    .eq('room_id', roomId)
    .order('seat_index');
  if (error) throw error;
  return (data as RoomSeat[]) ?? [];
}

export async function joinRoom(
  roomId: string,
  userId: string,
  role: 'host' | 'listener' = 'listener',
) {
  const { data: oda } = await supabase
    .from('rooms')
    .select('is_live')
    .eq('id', roomId)
    .maybeSingle();
  if (oda && oda.is_live === false) {
    throw new Error('Bu ses odası kapatıldı');
  }

  const { data: mevcut } = await supabase
    .from('room_members')
    .select('room_id, role')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  // Upsert UPDATE policy yok — mevcut uyeyi tekrar yazma
  if (mevcut) return;

  const { error } = await supabase.from('room_members').insert({
    room_id: roomId,
    user_id: userId,
    role,
  });
  if (error) {
    // Yarış: başka istek aynı anda eklediyse yok say
    if (error.code === '23505') return;
    throw error;
  }
}

/** Odadan güvenli çıkış — koltuk + üyelik temizliği */
export async function leaveRoom(roomId: string, userId: string) {
  await supabase
    .from('room_seats')
    .update({ user_id: null })
    .eq('room_id', roomId)
    .eq('user_id', userId);
  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

export async function fetchGifts(): Promise<Gift[]> {
  const { HediyeKatalogunuGetir } = await import(
    '../moduller/hediyeler/okuma/HediyeKatalogunuGetir'
  );
  return HediyeKatalogunuGetir();
}

export async function fetchCoinPackages(): Promise<CoinPackage[]> {
  const { CoinPaketleriniGetir } = await import(
    '../moduller/cuzdan/okuma/CoinPaketleriniGetir'
  );
  return CoinPaketleriniGetir();
}

/** @deprecated HediyeGonder kullan — uyumluluk */
export async function sendGift(input: {
  roomId?: string | null;
  receiverId: string;
  giftId: string;
  quantity?: number;
}) {
  const { HediyeGonder } = await import('../moduller/hediyeler/islemler/HediyeGonder');
  const sonuc = await HediyeGonder(input);
  if (!sonuc.ok) throw new Error(sonuc.hata);
  return sonuc.transaction;
}
