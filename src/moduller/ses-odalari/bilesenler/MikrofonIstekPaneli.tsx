import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  MikrofonIstekleriniGetir,
  type MikrofonIstegi,
} from '../mikrofon/MikrofonIstekleriniGetir';
import { MikrofonIstegiYanitla } from '../mikrofon/MikrofonIstegiYanitla';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { ODA_DOCK_BTN, ODA_DOCK_ICON } from './OdaButonOlculeri';

type Props = {
  roomId: string;
  onDegisti?: () => void;
};

const KART_W = 280;

/** Host/yardımcı: dock butonu — koltuk izinleri kartı */
export function MikrofonIstekPaneli({ roomId, onDegisti }: Props) {
  const [liste, setListe] = useState<MikrofonIstegi[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [acik, setAcik] = useState(false);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    w: number;
  } | null>(null);
  const btnRef = useRef<View>(null);

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

  useEffect(() => {
    const imza = `oda-mic-istek-${roomId}`;
    for (const ch of supabase.getChannels()) {
      const topic = ch.topic ?? '';
      if (topic === imza || topic === `realtime:${imza}` || topic.includes(imza)) {
        void supabase.removeChannel(ch);
      }
    }

    const kanal = supabase
      .channel(`${imza}-${Date.now().toString(36)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_mic_requests',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void yukle();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [roomId, yukle]);

  const yanitla = async (id: string, kabul: boolean) => {
    setBusy(id);
    const r = await MikrofonIstegiYanitla({ requestId: id, kabul });
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Koltuk izni', r.hata ?? 'Yanıtlanamadı');
      void yukle();
      return;
    }
    const kalan = liste.filter((x) => x.id !== id);
    setListe(kalan);
    if (kalan.length === 0) setAcik(false);
    onDegisti?.();
  };

  const kapat = useCallback(() => setAcik(false), []);

  const acKapa = useCallback(() => {
    if (acik) {
      setAcik(false);
      return;
    }
    btnRef.current?.measureInWindow((x, y, w) => {
      setAnchor({ x, y, w });
      setAcik(true);
    });
  }, [acik]);

  const sayi = liste.length;
  const rozetYazi = sayi > 9 ? '9+' : String(sayi);
  const win = Dimensions.get('window');
  const kartLeft = anchor
    ? Math.min(
        Math.max(10, anchor.x + anchor.w / 2 - KART_W / 2),
        win.width - KART_W - 10,
      )
    : 10;
  const kartBottom = anchor ? Math.max(72, win.height - anchor.y + 8) : 96;

  return (
    <View ref={btnRef} collapsable={false}>
      <Pressable
        onPress={acKapa}
        style={[styles.buton, acik && styles.butonAcik]}
        accessibilityRole="button"
        accessibilityLabel="Koltuk izinleri"
        accessibilityHint={
          sayi > 0 ? `${sayi} bekleyen istek` : 'Bekleyen istek yok'
        }
      >
        <Ionicons
          name={acik ? 'hand-left' : 'hand-left-outline'}
          size={ODA_DOCK_ICON}
          color={acik ? RenkTokenlari.primarySoft : RenkTokenlari.textMuted}
        />
        {sayi > 0 ? (
          <View style={styles.rozet} pointerEvents="none">
            <Text style={styles.rozetYazi}>{rozetYazi}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        visible={acik}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={kapat}
      >
        <Pressable style={styles.backdrop} onPress={kapat}>
          <Pressable
            style={[
              styles.kart,
              { left: kartLeft, bottom: kartBottom },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.kartBaslik}>
              <Text style={styles.baslik}>Koltuk izinleri</Text>
              <Text style={styles.sayiEtiket}>{sayi}</Text>
            </View>
            {sayi === 0 ? (
              <Text style={styles.bos}>Bekleyen istek yok</Text>
            ) : (
              <ScrollView
                style={styles.liste}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {liste.map((istek) => {
                  const ad =
                    istek.profile?.display_name?.trim() ||
                    istek.profile?.username?.trim() ||
                    istek.user_id.slice(0, 8);
                  const koltuk =
                    typeof istek.requested_seat_index === 'number'
                      ? `Koltuk ${istek.requested_seat_index + 1}`
                      : 'İlk boş koltuk';
                  return (
                    <View key={istek.id} style={styles.satir}>
                      {MedyaUriGuvenli(istek.profile?.avatar_url) ? (
                        <Image
                          source={{
                            uri: MedyaUriGuvenli(istek.profile?.avatar_url)!,
                          }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={[styles.avatar, styles.avatarBos]}>
                          <Text style={styles.harf}>
                            {ad.charAt(0).toLocaleUpperCase('tr-TR')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.metin}>
                        <Text style={styles.ad} numberOfLines={1}>
                          {ad}
                        </Text>
                        <Text style={styles.koltuk} numberOfLines={1}>
                          {koltuk}
                        </Text>
                      </View>
                      {busy === istek.id ? (
                        <ActivityIndicator color={RenkTokenlari.accent} />
                      ) : (
                        <View style={styles.aksiyonlar}>
                          <Pressable
                            onPress={() => void yanitla(istek.id, false)}
                            style={[styles.btn, styles.red]}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`${ad} isteğini reddet`}
                          >
                            <Text style={styles.btnYazi}>Reddet</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void yanitla(istek.id, true)}
                            style={[styles.btn, styles.kabul]}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`${ad} isteğini onayla`}
                          >
                            <Text style={styles.btnYazi}>Onayla</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  buton: {
    width: ODA_DOCK_BTN,
    height: ODA_DOCK_BTN,
    borderRadius: ODA_DOCK_BTN / 2,
    backgroundColor: 'rgba(42, 36, 56, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
  },
  butonAcik: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(232, 64, 145, 0.28)',
  },
  rozet: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: RenkTokenlari.live,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  rozetYazi: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  kart: {
    position: 'absolute',
    width: KART_W,
    maxWidth: KART_W,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: BoslukTokenlari.sm,
    elevation: 16,
  },
  kartBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  sayiEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  liste: {
    maxHeight: 260,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
    paddingVertical: 6,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarBos: {
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: { color: RenkTokenlari.text, fontWeight: '800', fontSize: 12 },
  metin: { flex: 1, minWidth: 0 },
  ad: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700' },
  koltuk: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted },
  aksiyonlar: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
  },
  red: { backgroundColor: 'rgba(239,68,68,0.28)' },
  kabul: { backgroundColor: 'rgba(16,185,129,0.32)' },
  btnYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
