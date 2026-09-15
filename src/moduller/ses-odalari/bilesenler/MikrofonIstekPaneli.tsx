import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  MikrofonIstekleriniGetir,
  type MikrofonIstegi,
} from '../mikrofon/MikrofonIstekleriniGetir';
import { MikrofonIstegiYanitla } from '../mikrofon/MikrofonIstegiYanitla';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  roomId: string;
  onDegisti?: () => void;
};

/** Host: bekleyen mikrofon istekleri — kabul / red */
export function MikrofonIstekPaneli({ roomId, onDegisti }: Props) {
  const [liste, setListe] = useState<MikrofonIstegi[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      setListe(await MikrofonIstekleriniGetir(roomId));
    } catch {
      setListe([]);
    }
  }, [roomId]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
      const t = setInterval(() => void yukle(), 4000);
      return () => clearInterval(t);
    }, [yukle]),
  );

  if (liste.length === 0) return null;

  const yanitla = async (id: string, kabul: boolean) => {
    setBusy(id);
    const r = await MikrofonIstegiYanitla({ requestId: id, kabul });
    setBusy(null);
    if (r.ok) {
      setListe((p) => p.filter((x) => x.id !== id));
      onDegisti?.();
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.baslik}>Mikrofon istekleri ({liste.length})</Text>
      {liste.map((istek) => {
        const ad =
          istek.profile?.display_name ??
          istek.profile?.username ??
          istek.user_id.slice(0, 8);
        return (
          <View key={istek.id} style={styles.satir}>
            {istek.profile?.avatar_url ? (
              <Image
                source={{ uri: istek.profile.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarBos]}>
                <Text style={styles.harf}>
                  {ad.charAt(0).toLocaleUpperCase('tr-TR')}
                </Text>
              </View>
            )}
            <Text style={styles.ad} numberOfLines={1}>
              {ad}
            </Text>
            {busy === istek.id ? (
              <ActivityIndicator color={RenkTokenlari.accent} />
            ) : (
              <View style={styles.aksiyonlar}>
                <Pressable
                  onPress={() => void yanitla(istek.id, false)}
                  style={[styles.btn, styles.red]}
                >
                  <Text style={styles.btnYazi}>Red</Text>
                </Pressable>
                <Pressable
                  onPress={() => void yanitla(istek.id, true)}
                  style={[styles.btn, styles.kabul]}
                >
                  <Text style={styles.btnYazi}>Kabul</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.md,
    marginBottom: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: BoslukTokenlari.sm,
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarBos: {
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: { color: RenkTokenlari.text, fontWeight: '800' },
  ad: { flex: 1, ...TipografiTokenlari.body, color: RenkTokenlari.text },
  aksiyonlar: { flexDirection: 'row', gap: 8 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
  },
  red: { backgroundColor: 'rgba(239,68,68,0.25)' },
  kabul: { backgroundColor: 'rgba(16,185,129,0.3)' },
  btnYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
