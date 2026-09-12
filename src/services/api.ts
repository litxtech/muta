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
}): Promise<Room> {
  const maxSeats = input.maxSeats ?? 8;
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      host_id: input.hostId,
      title: input.title,
      topic: input.topic ?? null,
      mode: input.mode,
      max_seats: maxSeats,
      is_live: true,
    })
    .select('*')
    .single();

  if (error) throw error;

  const seats = Array.from({ length: maxSeats }, (_, seat_index) => ({
    room_id: data.id,
    seat_index,
    user_id: seat_index === 0 ? input.hostId : null,
  }));

  await supabase.from('room_seats').insert(seats);
  await supabase.from('room_members').upsert({
    room_id: data.id,
    user_id: input.hostId,
    role: 'host',
  });

  return data as Room;
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

export async function joinRoom(roomId: string, userId: string) {
  const { error } = await supabase.from('room_members').upsert({
    room_id: roomId,
    user_id: userId,
    role: 'listener',
  });
  if (error) throw error;
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
