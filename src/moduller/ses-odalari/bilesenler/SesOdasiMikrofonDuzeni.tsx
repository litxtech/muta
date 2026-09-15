import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { RoomSeat } from '../../../types/models';
import { OdaDuzeniniCoz } from '../duzen/OdaDuzeniniCoz';
import { KonusmaciKarti } from './KonusmaciKarti';

type Props = {
  seats: RoomSeat[];
  layoutCode?: string | null;
};

/** Room Layout Engine — klasik sabit 8 yuvarlak tasarim degil */
export function SesOdasiMikrofonDuzeni({ seats, layoutCode }: Props) {
  const duzen = OdaDuzeniniCoz(layoutCode);
  const visible = seats.slice(0, Math.max(seats.length, duzen.kolon * 2));

  return (
    <View
      style={[
        styles.grid,
        duzen.sahneOdakli && styles.stage,
      ]}
    >
      {visible.map((seat) => (
        <KonusmaciKarti key={seat.id} seat={seat} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    gap: 16,
    paddingHorizontal: 16,
    flex: 1,
    minHeight: 0,
  },
  stage: {
    paddingTop: 12,
  },
});
