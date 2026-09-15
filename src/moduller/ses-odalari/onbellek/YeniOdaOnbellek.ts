import type { Room, RoomSeat } from '../../../types/models';

type OnbellekKayit = {
  room: Room;
  seats: RoomSeat[];
  createdAt: number;
};

const TTL_MS = 30_000;
const cache = new Map<string, OnbellekKayit>();

/** Oda açılır açılmaz UI göstersin — room ekranı refetch beklemesin */
export function YeniOdaOnbellegeYaz(room: Room, seats: RoomSeat[]) {
  cache.set(room.id, { room, seats, createdAt: Date.now() });
}

export function YeniOdaOnbellektenAl(roomId: string): {
  room: Room;
  seats: RoomSeat[];
} | null {
  const kayit = cache.get(roomId);
  if (!kayit) return null;
  if (Date.now() - kayit.createdAt > TTL_MS) {
    cache.delete(roomId);
    return null;
  }
  cache.delete(roomId);
  return { room: kayit.room, seats: kayit.seats };
}
