/**
 * Canlı yayın yorum akışı — sadece mesaj listesi.
 * Composer alt barda; klavye input'u ezmez.
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
  CanliYayinSohbetMesajlariniGetir,
  CanliYayinSohbetMesajiSil,
} from '../../canli-sohbet/islemler/CanliSohbetIslemleri';
import { CanliYayinModerasyon } from '../islemler/CanliYayinIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  sessionId: string;
  currentUserId?: string | null;
  hostId?: string | null;
  yenileSinyali?: number;
  /** true: üst başlık gizlenir (çekilebilir kart kendi başlığını gösterir) */
  baslikGizle?: boolean;
  onClose?: () => void;
};

export function CanliYorumAkisi({
  sessionId,
  currentUserId,
  hostId,
  yenileSinyali = 0,
  baslikGizle = false,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<CanliSohbetMesajGorunum[]>([]);
  const [hedef, setHedef] = useState<CanliSohbetMesajGorunum | null>(null);
  const listRef = useRef<FlatList<CanliSohbetMesajGorunum>>(null);
  const isHost = !!currentUserId && !!hostId && currentUserId === hostId;

  const load = useCallback(async () => {
    try {
      setMessages(await CanliYayinSohbetMesajlariniGetir(sessionId));
    } catch {
      /* migration yoksa sessiz */
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const t = setInterval(() => void load(), 10_000);
      return () => clearInterval(t);
    }, [load]),
  );

  useEffect(() => {
    if (yenileSinyali > 0) void load();
  }, [yenileSinyali, load]);

  useEffect(() => {
    const channel = supabase
      .channel(`canli-yorum-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, sessionId]);

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
            const r = await CanliYayinSohbetMesajiSil(item.id);
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

    if (!isHost) {
      setHedef(item);
      return;
    }

    Alert.alert(
      item.display_name || item.username || 'Kullanıcı',
      'Moderasyon',
      [
        {
          text: 'Yorumu sil',
          style: 'destructive',
          onPress: () => yorumSil(item),
        },
        {
          text: 'Yayından at',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await CanliYayinModerasyon({
                sessionId,
                targetUserId: item.user_id,
                action: 'kick',
              });
              if (!r.ok) Alert.alert('Atma', r.hata);
              else Alert.alert('Atıldı', 'Kullanıcı yayından çıkarıldı.');
            })();
          },
        },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await CanliYayinModerasyon({
                sessionId,
                targetUserId: item.user_id,
                action: 'ban',
              });
              if (!r.ok) Alert.alert('Engelle', r.hata);
              else Alert.alert('Engellendi', 'Bu yayına tekrar giremez.');
            })();
          },
        },
        {
          text: 'Bildir / engelle…',
          onPress: () => setHedef(item),
        },
        { text: 'Vazgeç', style: 'cancel' },
      ],
    );
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {!baslikGizle ? (
        <View style={styles.header} pointerEvents="box-none">
          <Text style={styles.title}>Yorumlar</Text>
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.close}
              accessibilityLabel="Yorumları gizle"
            >
              <Ionicons name="chevron-down" size={16} color={RenkTokenlari.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.listWrap}>
        <CanliSohbetListeFade />
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listEmpty,
          ]}
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
          contentType="live_chat"
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
  root: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
    flexShrink: 0,
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
  listWrap: { flex: 1, minHeight: 0, position: 'relative' },
  list: { flex: 1 },
  listContent: { gap: 5, paddingBottom: 4, paddingRight: 2 },
  listEmpty: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  empty: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: 2,
  },
});
