import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import {
  GorusmeCevapla,
  GorusmeReddet,
} from '../islemler/GorusmeIslemleri';
import { KullanicilarEngelliMi } from '../../moderasyon/islemler/ModerasyonIslemleri';
import type { DirectCall } from '../tipler';
import { GorusmeOturumAl } from '../oturum/GorusmeOturumYoneticisi';

/** LiveKit VideoView zincirini app acilisinda yukleme */
function GorusmeGelenEkraniLazy(
  props: React.ComponentProps<
    typeof import('./GorusmeEkranlari').GorusmeGelenEkrani
  >,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GorusmeGelenEkrani } = require('./GorusmeEkranlari') as typeof import('./GorusmeEkranlari');
  return <GorusmeGelenEkrani {...props} />;
}

type Ctx = {
  gelen: DirectCall | null;
};

const GorusmeCtx = createContext<Ctx>({ gelen: null });

export function useGorusmeGelen() {
  return useContext(GorusmeCtx);
}

async function arayanProfilYukle(callerId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', callerId)
    .maybeSingle();
  return {
    name:
      data?.display_name?.trim() ||
      data?.username?.trim() ||
      'Arayan',
    avatar: data?.avatar_url ?? null,
  };
}

/** Uygulama genelinde gelen arama dinleyicisi (WhatsApp/iOS tarzi) */
export function GorusmeGelenSaglayici({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [gelen, setGelen] = useState<DirectCall | null>(null);
  const [peerName, setPeerName] = useState('Arayan');
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const gelenIdRef = useRef<string | null>(null);

  useEffect(() => {
    gelenIdRef.current = gelen?.id ?? null;
  }, [gelen?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const goster = async (c: DirectCall) => {
      if (c.status !== 'ringing') return;
      if (gelenIdRef.current === c.id) return;
      // Aktif görüşme varken ikinci arama UI'sı açma
      const aktif = GorusmeOturumAl();
      if (aktif && aktif.callId !== c.id) return;

      // Once UI — profili bekleme
      setGelen(c);
      setPeerName('Arayan');
      setPeerAvatar(null);

      // Engelli / profil arka planda
      void (async () => {
        if (await KullanicilarEngelliMi(c.caller_id)) {
          await GorusmeReddet(c.id).catch(() => undefined);
          setGelen((cur) => (cur?.id === c.id ? null : cur));
          return;
        }
        const p = await arayanProfilYukle(c.caller_id);
        if (gelenIdRef.current !== c.id) return;
        setPeerName(p.name);
        setPeerAvatar(p.avatar);
      })();
    };

    // Kacirilan realtime icin acik ringing cagriyi cek
    void (async () => {
      const { data } = await supabase
        .from('direct_calls')
        .select('*')
        .eq('callee_id', user.id)
        .eq('status', 'ringing')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) await goster(data as DirectCall);
    })();

    const topic = `incoming-calls-${user.id}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${topic}` || ch.topic === topic) {
        void supabase.removeChannel(ch);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel: any = supabase.channel(topic);
    channel
      .on(
        'broadcast',
        { event: 'incoming_call' },
        (payload: { payload?: DirectCall }) => {
          const c = payload.payload;
          if (c?.id) void goster(c);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_calls',
          filter: `callee_id=eq.${user.id}`,
        },
        (payload: { new: DirectCall }) => {
          void goster(payload.new);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_calls',
          filter: `callee_id=eq.${user.id}`,
        },
        (payload: { new: DirectCall }) => {
          const c = payload.new;
          if (
            gelenIdRef.current === c.id &&
            ['ended', 'cancelled', 'missed', 'rejected', 'active'].includes(
              c.status,
            )
          ) {
            if (c.status !== 'active') setGelen(null);
          }
        },
      )
      .subscribe();

    // Ayrica arayanin dogrudan broadcast kanali
    const ringTopic = `call-ring-${user.id}`;
    for (const ch of supabase.getChannels()) {
      if (ch.topic === `realtime:${ringTopic}` || ch.topic === ringTopic) {
        void supabase.removeChannel(ch);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ringCh: any = supabase.channel(ringTopic);
    ringCh
      .on(
        'broadcast',
        { event: 'incoming_call' },
        (payload: { payload?: DirectCall }) => {
          const c = payload.payload;
          if (c?.id) void goster(c);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(ringCh);
    };
  }, [user?.id]);

  const kabul = useCallback(async () => {
    if (!gelen) return;
    Keyboard.dismiss();
    const r = await GorusmeCevapla(gelen.id);
    setGelen(null);
    if (!r.ok) return;
    router.push(`/gorusme/${gelen.id}` as any);
  }, [gelen]);

  const red = useCallback(async () => {
    if (!gelen) return;
    Keyboard.dismiss();
    await GorusmeReddet(gelen.id);
    setGelen(null);
  }, [gelen]);

  const value = useMemo(() => ({ gelen }), [gelen]);

  return (
    <GorusmeCtx.Provider value={value}>
      {children}
      <Modal
        visible={!!gelen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        transparent={false}
        onRequestClose={() => void red()}
      >
        {/* Modal kendi window'unda inset kaybeder — provider şart */}
        <SafeAreaProvider>
          {gelen ? (
            <GorusmeGelenEkraniLazy
              peerName={peerName}
              peerAvatar={peerAvatar}
              callType={gelen.call_type}
              onAccept={() => void kabul()}
              onReject={() => void red()}
            />
          ) : null}
        </SafeAreaProvider>
      </Modal>
    </GorusmeCtx.Provider>
  );
}
