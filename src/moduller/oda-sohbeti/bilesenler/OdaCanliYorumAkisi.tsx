/**
 * Canlı oda yorum akışı — sadece mesaj listesi (TikTok/YT overlay).
 * Composer sahne altında ayrı tutulur; klavye input'u ezmez.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  CanliSohbetListeFade,
  CanliSohbetMesajKarti,
  type CanliSohbetMesajGorunum,
} from '../../canli-sohbet/bilesenler/CanliSohbetMesajKarti';
import { KullaniciGuvenlikMenusu } from '../../moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import {
  OdaSohbetMesajlariniGetir,
  OdaSohbetMesajiSil,
} from '../../canli-sohbet/islemler/CanliSohbetIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  roomId: string;
  currentUserId?: string | null;
  /** Host ise başkalarının yorumunu da silebilir */
  hostId?: string | null;
  /** Composer gönderince artırılır — remount etmeden yeniler */
  yenileSinyali?: number;
  onClose?: () => void;
};

export function OdaCanliYorumAkisi({
  roomId,
  currentUserId,
  hostId,
  yenileSinyali = 0,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<CanliSohbetMesajGorunum[]>([]);
  const [hedef, setHedef] = useState<CanliSohbetMesajGorunum | null>(null);
  const listRef = useRef<FlatList<CanliSohbetMesajGorunum>>(null);
  const isHost = !!currentUserId && !!hostId && currentUserId === hostId;

  const load = useCallback(async () => {
    try {
      const rows = await OdaSohbetMesajlariniGetir(roomId);
      setMessages(rows);
    } catch {
      /* tablo/migration yoksa sessiz */
    }
  }, [roomId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const t = setInterval(() => void load(), 12_000);
      return () => clearInterval(t);
    }, [load]),
  );

  useEffect(() => {
    if (yenileSinyali > 0) void load();
  }, [yenileSinyali, load]);

  useEffect(() => {
    const channel = supabase
      .channel(`oda-yorum-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, roomId]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const yorumSil = (item: CanliSohbetMesajGorunum) => {
    Alert.alert('Yorumu sil', 'Bu yorum kaldırılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await OdaSohbetMesajiSil(item.id);
            if (!r.ok) Alert.alert('Yorum', r.hata);
            else void load();
          })();
        },
      },
    ]);
  };

  const uzunBas = (item: CanliSohbetMesajGorunum) => {
    if (!currentUserId) return;
    const mine = item.user_id === currentUserId;
    if (mine) {
      yorumSil(item);
      return;
    }
    if (isHost) {
      Alert.alert(
        item.display_name || item.username || 'Kullanıcı',
        'Ne yapmak istersin?',
        [
          {
            text: 'Yorumu sil',
            style: 'destructive',
            onPress: () => yorumSil(item),
          },
          { text: 'Bildir / engelle…', onPress: () => setHedef(item) },
          { text: 'Vazgeç', style: 'cancel' },
        ],
      );
      return;
    }
    setHedef(item);
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.header} pointerEvents="box-none">
        <Text style={styles.title}>Yorumlar</Text>
        {onClose ? (
          <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
            <Ionicons name="chevron-down" size={16} color={RenkTokenlari.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.listWrap}>
        <CanliSohbetListeFade />
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>İlk yorumu yaz — herkes görsün.</Text>
          }
          renderItem={({ item }) => (
            <CanliSohbetMesajKarti
              item={item}
              mine={!!currentUserId && item.user_id === currentUserId}
              varyant="live"
              onLongPress={currentUserId ? () => uzunBas(item) : undefined}
            />
          )}
        />
      </View>

      {hedef ? (
        <KullaniciGuvenlikMenusu
          visible
          targetUserId={hedef.user_id}
          targetName={hedef.display_name || hedef.username}
          roomId={roomId}
          contentType="room_chat"
          contentId={hedef.id}
          contentPreview={hedef.body}
          onClose={() => setHedef(null)}
          onBlocked={() => {
            setHedef(null);
            void load();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  title: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  list: { flex: 1 },
  listContent: {
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 0,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  empty: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: 4,
  },
});
