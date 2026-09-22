import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { ProfilAvatarKucuk } from '../../../canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import {
  OturumGecmisiListesiniGetir,
  OturumGecmisindenKaldir,
} from '../OturumGecmisiDepolama';
import type { OturumGecmisiKaydi } from '../tipler';

type Props = {
  onSec: (kayit: OturumGecmisiKaydi) => void | Promise<void>;
  busyUserId?: string | null;
};

/**
 * Instagram tarzı kayıtlı oturum avatarları — tıkla gir, × ile kalıcı sil.
 */
export function GirisLobiOturumGecmisi({ onSec, busyUserId }: Props) {
  const [liste, setListe] = useState<OturumGecmisiKaydi[]>([]);

  const yenile = useCallback(async () => {
    const rows = await OturumGecmisiListesiniGetir();
    setListe(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void yenile();
    }, [yenile]),
  );

  if (liste.length === 0) return null;

  const kaldirIste = (kayit: OturumGecmisiKaydi) => {
    const ad =
      kayit.displayName?.trim() ||
      kayit.username?.trim() ||
      'Bu hesap';
    Alert.alert(
      'Oturumu kaldır',
      `${ad} bu cihazdaki oturum geçmişinden silinsin mi? Lobide bir daha görünmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await OturumGecmisindenKaldir(kayit.userId);
              await yenile();
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.baslik}>Kayıtlı hesaplar</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {liste.map((kayit) => {
          const etiket =
            kayit.username?.trim() ||
            kayit.displayName?.trim() ||
            'Hesap';
          const busy = busyUserId === kayit.userId;
          return (
            <View key={kayit.userId} style={styles.item}>
              <Pressable
                onPress={() => void onSec(kayit)}
                onLongPress={() => kaldirIste(kayit)}
                disabled={!!busyUserId}
                style={({ pressed }) => [
                  styles.avatarBtn,
                  pressed && styles.pressed,
                  busy && styles.busy,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${etiket} hesabına giriş yap`}
              >
                <View style={styles.avatarRing}>
                  <ProfilAvatarKucuk
                    size={64}
                    avatarUrl={kayit.avatarUrl}
                    displayName={kayit.displayName}
                    username={kayit.username}
                  />
                  {busy ? (
                    <View style={styles.busyMask}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.etiket} numberOfLines={1}>
                  {etiket}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => kaldirIste(kayit)}
                style={styles.silBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${etiket} oturumunu kaldır`}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.sm,
    marginBottom: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 2,
  },
  row: {
    gap: BoslukTokenlari.md,
    paddingVertical: 4,
    paddingRight: BoslukTokenlari.md,
  },
  item: {
    width: 76,
    alignItems: 'center',
    position: 'relative',
  },
  avatarBtn: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  pressed: { opacity: 0.85 },
  busy: { opacity: 0.7 },
  avatarRing: {
    borderRadius: 36,
    borderWidth: 2,
    borderColor: RenkTokenlari.border,
    padding: 2,
  },
  busyMask: {
    ...StyleSheet.absoluteFill,
    borderRadius: 34,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    textAlign: 'center',
    width: '100%',
  },
  silBtn: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(20,12,28,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
