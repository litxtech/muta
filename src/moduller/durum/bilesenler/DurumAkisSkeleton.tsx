import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

function Kemik({
  w,
  h,
  r = 6,
}: {
  w: number | `${number}%`;
  h: number;
  r?: number;
}) {
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        backgroundColor: RenkTokenlari.surface,
      }}
    />
  );
}

function Satir() {
  return (
    <View style={styles.satir}>
      <Kemik w={46} h={46} r={23} />
      <View style={styles.govde}>
        <Kemik w="42%" h={12} />
        <Kemik w="70%" h={10} />
        <Kemik w="100%" h={160} r={14} />
        <View style={styles.aksiyon}>
          <Kemik w={28} h={12} />
          <Kemik w={28} h={12} />
          <Kemik w={28} h={12} />
          <Kemik w={28} h={12} />
        </View>
      </View>
    </View>
  );
}

/** İlk yükleme — dark/light surface tokenları */
export function DurumAkisSkeleton({ adet = 3 }: { adet?: number }) {
  useTemayaAboneOl();
  return (
    <View style={styles.wrap}>
      {Array.from({ length: adet }, (_, i) => (
        <Satir key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: BoslukTokenlari.sm },
  satir: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: BoslukTokenlari.lg,
    paddingVertical: 16,
  },
  govde: { flex: 1, gap: 10, minWidth: 0 },
  aksiyon: { flexDirection: 'row', gap: 18, marginTop: 4 },
});
