/**
 * Canlı oda yorum akışı — mesaj listesi (alt panelde composer üstünde).
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
import { OdaModerasyonUygula } from '../../moderasyon/islemler/ModerasyonIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  roomId: string;
  currentUserId?: string | null;
  /** Host ise başkalarının yorumunu silebilir / kullanıcıyı yasaklayabilir */
  hostId?: string | null;
  /** Host veya cohost */
  moderatorMu?: boolean;
  /** Composer gönderince artırılır — remount etmeden yeniler */
  yenileSinyali?: number;
  /** true: üst başlık gizlenir (çekilebilir kart kendi başlığını gösterir) */
  baslikGizle?: boolean;
  onClose?: () => void;
  /** Avatar / isme tık — profil sheet */
  onProfil?: (item: CanliSohbetMesajGorunum) => void;
};

export function OdaCanliYorumAkisi({
  roomId,
  currentUserId,
  hostId,
  moderatorMu = false,
  yenileSinyali = 0,
  baslikGizle = false,
  onClose,
  onProfil,
}: Props) {
  const { t } = useCeviri();
  const [messages, setMessages] = useState<CanliSohbetMesajGorunum[]>([]);
  const [hedef, setHedef] = useState<CanliSohbetMesajGorunum | null>(null);
  const listRef = useRef<FlatList<CanliSohbetMesajGorunum>>(null);
  const isHost = !!currentUserId && !!hostId && currentUserId === hostId;
  const canModerate = isHost || moderatorMu;

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
      const timer = setInterval(() => void load(), 12_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  useEffect(() => {
    if (yenileSinyali > 0) void load();
  }, [yenileSinyali, load]);

  useEffect(() => {
    const imza = `oda-yorum-${roomId}`;
    for (const ch of supabase.getChannels()) {
      const topic = ch.topic ?? '';
      if (topic === imza || topic === `realtime:${imza}` || topic.includes(imza)) {
        void supabase.removeChannel(ch);
      }
    }

    const channel = supabase
      .channel(`${imza}-${Date.now().toString(36)}`)
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
    Alert.alert(t('canliYayin.yorumSilBaslik'), t('canliYayin.yorumSilBody'), [
      { text: t('ortak.vazgec'), style: 'cancel' },
      {
        text: t('ortak.sil'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const r = await OdaSohbetMesajiSil(item.id);
            if (!r.ok) Alert.alert(t('canliYayin.yorum'), r.hata);
            else void load();
          })();
        },
      },
    ]);
  };

  const kullaniciyiYasakla = (item: CanliSohbetMesajGorunum) => {
    const ad =
      item.display_name?.trim() ||
      item.username?.trim() ||
      t('ortak.kullanici');
    Alert.alert(
      t('sesOda.yorumYazmayiEngelle'),
      t('sesOda.yorumYazmayiEngelleBody', { ad }),
      [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('canliYayin.engelle'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await OdaModerasyonUygula({
                roomId,
                targetUserId: item.user_id,
                action: 'ban',
                reason: 'oda_sohbet',
              });
              if (!r.ok) {
                Alert.alert(
                  t('sesOda.engelleme'),
                  r.hata ?? t('sesOda.uygulanamadi'),
                );
                return;
              }
              await OdaSohbetMesajiSil(item.id).catch(() => undefined);
              Alert.alert(t('ortak.tamam'), t('sesOda.yasaklandiMesaj'));
              void load();
            })();
          },
        },
      ],
    );
  };

  const uzunBas = (item: CanliSohbetMesajGorunum) => {
    if (!currentUserId) return;
    const mine = item.user_id === currentUserId;
    if (mine) {
      yorumSil(item);
      return;
    }
    if (canModerate) {
      Alert.alert(
        item.display_name || item.username || t('ortak.kullanici'),
        t('sesOda.neYapmakIstersin'),
        [
          {
            text: t('canliYayin.yorumSilBaslik'),
            style: 'destructive',
            onPress: () => yorumSil(item),
          },
          {
            text: t('sesOda.yorumYazmayiEngelle'),
            style: 'destructive',
            onPress: () => kullaniciyiYasakla(item),
          },
          { text: t('canliYayin.bildirEngelle'), onPress: () => setHedef(item) },
          { text: t('ortak.vazgec'), style: 'cancel' },
        ],
      );
      return;
    }
    setHedef(item);
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {!baslikGizle ? (
        <View style={styles.header} pointerEvents="box-none">
          <Text style={styles.title}>{t('canliYayin.yorumlar')}</Text>
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={12} style={styles.close}>
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          ListEmptyComponent={
            <Text style={styles.empty}>{t('canliYayin.yorumBos')}</Text>
          }
          renderItem={({ item }) => (
            <CanliSohbetMesajKarti
              item={item}
              mine={!!currentUserId && item.user_id === currentUserId}
              varyant="live"
              onLongPress={currentUserId ? () => uzunBas(item) : undefined}
              onProfilPress={onProfil}
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
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  title: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  list: { flex: 1 },
  listContent: {
    gap: 4,
    paddingBottom: 2,
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
