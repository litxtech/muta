import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { KonusmaciSesSeviyesi } from '../../livekit/ses/KonusmaciSesSeviyesi';

type Props = {
  userId: string | null;
  size?: number;
  children: React.ReactNode;
};

/** Premium audio-reactive halo — sadece bu komponent re-render olur */
export function KonusmaciAktiflikEfekti({ userId, size = 72, children }: Props) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const unsub = KonusmaciSesSeviyesi.dinle((id, lvl) => {
      if (id === userId) setLevel(lvl);
    });
    return () => {
      unsub();
    };
  }, [userId]);

  const scale = 1 + level * 0.12;
  const opacity = 0.25 + level * 0.45;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {userId ? (
        <View
          style={[
            styles.halo,
            {
              width: size + 14,
              height: size + 14,
              borderRadius: (size + 14) / 2,
              opacity,
              transform: [{ scale }],
              borderColor: RenkTokenlari.primarySoft,
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    borderWidth: 2,
  },
});
