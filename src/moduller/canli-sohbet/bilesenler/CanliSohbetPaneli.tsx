import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { KlavyeGuvenliAlan } from '../../../bilesenler/klavye/KlavyeGuvenliAlan';
import { supabase } from '../../../lib/supabase';
import {
  CanliSohbetListeFade,
  CanliSohbetMesajKarti,
  type CanliSohbetMesajGorunum,
} from './CanliSohbetMesajKarti';
import { KullaniciGuvenlikMenusu } from '../../moderasyon/bilesenler/KullaniciGuvenlikMenusu';
import {
  CanliYayinSohbetMesajiGonder,
  CanliYayinSohbetMesajlariniGetir,
  CanliYayinSohbetMesajiSil,
  OdaSohbetMesajiGonder,
  OdaSohbetMesajlariniGetir,
  OdaSohbetMesajiSil,
} from '../islemler/CanliSohbetIslemleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  kanal: { tur: 'oda'; id: string } | { tur: 'canli'; id: string };
  canSend: boolean;
  currentUserId?: string | null;
  baslik?: string;
  onNeedUpgrade?: () => void;
  onClose?: () => void;
  /**
   * dock: klasik panel
   * live: TikTok / Twitch / YT — overlay yorum + genis composer
   */
  varyant?: 'dock' | 'overlay' | 'live';
};

/**
 * Canli / sesli oda ortak sohbet.
 * live varyanti: rahat okuma + rahat yazma, sahneyi ezmez.
 */
export function CanliSohbetPaneli({
  kanal,
  canSend,
  currentUserId,
  baslik,
  onNeedUpgrade,
  onClose,
  varyant = 'dock',
}: Props) {
  const [messages, setMessages] = useState<CanliSohbetMesajGorunum[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [hedef, setHedef] = useState<CanliSohbetMesajGorunum | null>(null);
  const listRef = useRef<FlatList<CanliSohbetMesajGorunum>>(null);
  const inputRef = useRef<TextInput>(null);
  const live = varyant === 'live' || varyant === 'overlay';

  const load = useCallback(async () => {
    try {
      const rows =
        kanal.tur === 'oda'
          ? await OdaSohbetMesajlariniGetir(kanal.id)
          : await CanliYayinSohbetMesajlariniGetir(kanal.id);
      setMessages(rows);
      setHata(null);
    } catch (e) {
      setMessages([]);
      setHata(e instanceof Error ? e.message : 'Sohbet yüklenemedi');
    }
  }, [kanal.id, kanal.tur]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const t = setInterval(() => void load(), 8000);
      return () => clearInterval(t);
    }, [load]),
  );

  useEffect(() => {
    const table =
      kanal.tur === 'oda' ? 'room_chat_messages' : 'live_chat_messages';
    const filter =
      kanal.tur === 'oda'
        ? `room_id=eq.${kanal.id}`
        : `session_id=eq.${kanal.id}`;

    const channel = supabase
      .channel(`sohbet-${kanal.tur}-${kanal.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [kanal.id, kanal.tur, load]);

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const gonder = async () => {
    if (!canSend) {
      onNeedUpgrade?.();
      return;
    }
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const optimistic: CanliSohbetMesajGorunum = {
      id: `local-${Date.now()}`,
      user_id: currentUserId ?? 'me',
      body,
      created_at: new Date().toISOString(),
      display_name: 'Sen',
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    const r =
      kanal.tur === 'oda'
        ? await OdaSohbetMesajiGonder({ roomId: kanal.id, body })
        : await CanliYayinSohbetMesajiGonder({
            sessionId: kanal.id,
            body,
          });
    setBusy(false);
    if (!r.ok) {
      setHata(r.hata ?? 'Gönderilemedi');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
      return;
    }
    await load();
    inputRef.current?.focus();
  };

  return (
    <KlavyeGuvenliAlan style={[styles.shell, live && styles.shellLive]}>
      <View style={[styles.card, live && styles.cardLive]}>
        <View style={[styles.cardInner, live && styles.cardInnerLive]}>
          {!live ? (
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.liveDot} />
                <Text style={styles.title} numberOfLines={1}>
                  {baslik ??
                    (kanal.tur === 'canli' ? 'Canlı sohbet' : 'Oda sohbeti')}
                </Text>
                <Text style={styles.count}>{messages.length}</Text>
              </View>
              {onClose ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  style={styles.closeBtn}
                  accessibilityLabel="Sohbeti kapat"
                >
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={RenkTokenlari.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.liveHeader}>
              <Text style={styles.liveHeaderTitle}>
                {baslik ?? 'Yorumlar'}
              </Text>
              {onClose ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.liveClose}
                  accessibilityLabel="Yorumları gizle"
                >
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={RenkTokenlari.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
          )}

          {hata ? <Text style={styles.error}>{hata}</Text> : null}

          <View style={styles.listWrap}>
            {live ? <CanliSohbetListeFade /> : null}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={[
                styles.listContent,
                live && styles.listContentLive,
                messages.length === 0 && styles.listContentEmpty,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.empty}>
                    İlk yorumu yaz — herkes görsün.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const mine =
                  !!currentUserId && item.user_id === currentUserId;
                return (
                  <CanliSohbetMesajKarti
                    item={item}
                    mine={mine}
                    varyant={live ? 'live' : 'kart'}
                    onLongPress={
                      currentUserId
                        ? () => {
                            if (mine) {
                              Alert.alert(
                                'Yorumu sil',
                                'Bu yorum kaldırılsın mı?',
                                [
                                  { text: 'Vazgeç', style: 'cancel' },
                                  {
                                    text: 'Sil',
                                    style: 'destructive',
                                    onPress: () => {
                                      void (async () => {
                                        const r =
                                          kanal.tur === 'oda'
                                            ? await OdaSohbetMesajiSil(item.id)
                                            : await CanliYayinSohbetMesajiSil(
                                                item.id,
                                              );
                                        if (!r.ok) {
                                          Alert.alert('Yorum', r.hata);
                                        } else void load();
                                      })();
                                    },
                                  },
                                ],
                              );
                            } else {
                              setHedef(item);
                            }
                          }
                        : undefined
                    }
                  />
                );
              }}
            />
          </View>

          <View style={[styles.composer, live && styles.composerLive]}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={
                canSend ? 'Yorum yaz…' : 'Yorum için hesabını tamamla'
              }
              placeholderTextColor={RenkTokenlari.textDim}
              style={[styles.input, live && styles.inputLive]}
              maxLength={500}
              editable={canSend}
              multiline
              blurOnSubmit={false}
              onSubmitEditing={() => void gonder()}
              returnKeyType="send"
              textAlignVertical="center"
            />
            <Pressable
              onPress={() => void gonder()}
              disabled={busy || !text.trim()}
              style={[
                styles.send,
                live && styles.sendLive,
                (busy || !text.trim()) && styles.sendDisabled,
              ]}
              accessibilityLabel="Gönder"
            >
              <Ionicons
                name="send"
                size={live ? 18 : 16}
                color={
                  busy || !text.trim()
                    ? RenkTokenlari.textDim
                    : RenkTokenlari.text
                }
              />
            </Pressable>
          </View>
        </View>
      </View>

      {hedef ? (
        <KullaniciGuvenlikMenusu
          visible
          targetUserId={hedef.user_id}
          targetName={hedef.display_name || hedef.username}
          roomId={kanal.tur === 'oda' ? kanal.id : undefined}
          contentType={kanal.tur === 'oda' ? 'room_chat' : 'live_chat'}
          contentId={hedef.id}
          contentPreview={hedef.body}
          onClose={() => setHedef(null)}
          onBlocked={() => {
            setHedef(null);
            void load();
          }}
        />
      ) : null}
    </KlavyeGuvenliAlan>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
  },
  shellLive: {
    backgroundColor: 'transparent',
  },
  card: {
    flex: 1,
    minHeight: 0,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgGlass,
  },
  cardLive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },
  cardInner: {
    flex: 1,
    minHeight: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  cardInnerLive: {
    paddingTop: 4,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexShrink: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 6,
    flexShrink: 0,
  },
  liveHeaderTitle: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  liveClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RenkTokenlari.mint,
  },
  title: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 15,
    flexShrink: 1,
  },
  count: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.surface,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  error: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    marginBottom: 6,
    flexShrink: 0,
    paddingHorizontal: 4,
  },
  listWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  list: { flex: 1 },
  listContent: {
    paddingBottom: 6,
    gap: 8,
  },
  listContentLive: {
    gap: 6,
    paddingBottom: 8,
    paddingRight: 48,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  emptyBox: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  empty: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: RenkTokenlari.border,
    flexShrink: 0,
  },
  composerLive: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 0,
    gap: 10,
  },
  input: {
    flex: 1,
    maxHeight: 88,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    color: RenkTokenlari.text,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    ...TipografiTokenlari.body,
  },
  inputLive: {
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(12, 10, 18, 0.82)',
    paddingHorizontal: 16,
    fontSize: 15,
    lineHeight: 20,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.primary,
  },
  sendLive: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sendDisabled: {
    backgroundColor: RenkTokenlari.surface,
  },
});
