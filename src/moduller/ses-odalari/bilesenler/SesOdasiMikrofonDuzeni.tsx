/**
 * SesOdasiMikrofonDuzeni — taht + mikrofon ızgarası (kaydırılabilir).
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

/** Üstte sahip tahtı, altta kompakt mikrofon ızgarası */
function SesOdasiMikrofonDuzeniIc({
  seats,
  hostId,
  layoutCode,
  onSeatPress,
}: Props) {
  const duzen = OdaDuzeniniCoz(layoutCode);
  const kolon = Math.min(Math.max(duzen.kolon, 4), 5);
  const seat0 = seats.find((s) => s.seat_index === 0) ?? null;
  const hostSeat =
    hostId != null ? seats.find((s) => s.user_id === hostId) ?? null : null;
  const taht = (seat0?.user_id ? seat0 : null) ?? hostSeat ?? seat0;
  const diger = seats
    .filter((s) => s.seat_index !== 0 && s.id !== taht?.id)
    .sort((a, b) => a.seat_index - b.seat_index);
  const hucre = `${Math.floor(100 / kolon)}%` as `${number}%`;

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
  );
}

export const SesOdasiMikrofonDuzeni = memo(SesOdasiMikrofonDuzeniIc);

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 6,
    paddingBottom: 12,
  },
  stage: {
    paddingTop: 2,
  },
  tahtBolum: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
  },
  tahtKartWrap: {
    position: 'relative',
    alignItems: 'center',
    minWidth: 120,
    overflow: 'visible',
  },
  tahtBosPlaceholder: {
    height: 130,
    width: 110,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    paddingHorizontal: 4,
  },
  hucre: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 1,
    overflow: 'visible',
  },
});
