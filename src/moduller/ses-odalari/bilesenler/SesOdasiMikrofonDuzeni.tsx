/**
 * SesOdasiMikrofonDuzeni — taht + mikrofon ızgarası.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RoomSeat } from '../../../types/models';
import { OdaDuzeniniCoz } from '../duzen/OdaDuzeniniCoz';
import { KonusmaciKarti } from './KonusmaciKarti';

type Props = {
  seats: RoomSeat[];
  hostId?: string | null;
  layoutCode?: string | null;
  onSeatPress?: (seat: RoomSeat) => void;
};

/** Room Layout Engine — üstte sahip tahtı, altta mikrofon ızgarası */
function SesOdasiMikrofonDuzeniIc({
  seats,
  hostId,
  layoutCode,
  onSeatPress,
}: Props) {
  const duzen = OdaDuzeniniCoz(layoutCode);
  const seat0 = seats.find((s) => s.seat_index === 0) ?? null;
  const hostSeat =
    hostId != null ? seats.find((s) => s.user_id === hostId) ?? null : null;
  // seat 0 boş ama host başka koltuktaysa tahtta host göster (boş taht bug'ı)
  const taht = (seat0?.user_id ? seat0 : null) ?? hostSeat ?? seat0;
  const diger = seats
    .filter((s) => s.seat_index !== 0 && s.id !== taht?.id)
    .sort((a, b) => a.seat_index - b.seat_index)
    .slice(0, Math.max(seats.length - 1, duzen.kolon * 2));
  const hucre = `${Math.floor(100 / duzen.kolon)}%` as `${number}%`;

  return (
    <View style={[styles.root, duzen.sahneOdakli && styles.stage]}>
      <View style={styles.tahtBolum}>
        <View style={styles.tahtKartWrap}>
          {taht ? (
            <KonusmaciKarti
              seat={taht}
              hostId={hostId}
              tahtMi
              onPress={onSeatPress}
            />
          ) : (
            <View style={styles.tahtBosPlaceholder} />
          )}
        </View>
      </View>

      <View style={styles.gridWrap}>
        <View style={styles.grid}>
          {diger.map((seat) => (
            <View key={seat.id} style={[styles.hucre, { width: hucre }]}>
              <KonusmaciKarti
                seat={seat}
                hostId={hostId}
                onPress={onSeatPress}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export const SesOdasiMikrofonDuzeni = memo(SesOdasiMikrofonDuzeniIc);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: 8,
  },
  stage: {
    paddingTop: 2,
  },
  tahtBolum: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 2,
  },
  tahtKartWrap: {
    position: 'relative',
    alignItems: 'center',
    minWidth: 140,
  },
  tahtBosPlaceholder: {
    height: 118,
    width: 120,
  },
  gridWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    paddingHorizontal: 6,
    flex: 1,
    minHeight: 0,
  },
  hucre: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    overflow: 'visible',
  },
});
