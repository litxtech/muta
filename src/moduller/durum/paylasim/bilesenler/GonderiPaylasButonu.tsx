import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import { GonderiPaylasSheet } from './GonderiPaylasSheet';

type Props = {
  statusId: string;
  /** Sayı göster (opsiyonel) */
  shareCount?: number;
  onBasarili?: (sentCount: number) => void;
  /** Sadece ikon (kart aksiyon sırası) */
  kompakt?: boolean;
  disabled?: boolean;
  onPressGate?: (open: () => void) => void;
};

/**
 * Ortak paylaş butonu — Feed / PostDetail / profil aynı action.
 */
export function GonderiPaylasButonu({
  statusId,
  shareCount,
  onBasarili,
  kompakt = true,
  disabled,
  onPressGate,
}: Props) {
  const [acik, setAcik] = useState(false);

  const ac = () => {
    if (disabled) return;
    if (onPressGate) {
      onPressGate(() => setAcik(true));
      return;
    }
    setAcik(true);
  };

  return (
    <View>
      <Pressable
        style={styles.aksiyon}
        onPress={(e) => {
          e.stopPropagation?.();
          ac();
        }}
        hitSlop={10}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Gönderiyi paylaş"
      >
        <Ionicons
          name="paper-plane-outline"
          size={18}
          color={RenkTokenlari.textDim}
        />
        {!kompakt ? <Text style={styles.yazi}>Paylaş</Text> : null}
        {kompakt && shareCount != null && shareCount > 0 ? (
          <Text style={styles.sayi}>{shareCount}</Text>
        ) : null}
      </Pressable>

      <GonderiPaylasSheet
        visible={acik}
        statusId={statusId}
        onClose={() => setAcik(false)}
        onBasarili={onBasarili}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aksiyon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  yazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
  sayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
  },
});
