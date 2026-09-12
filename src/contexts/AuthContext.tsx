import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Wallet } from '../types/models';
import { EmailIleGirisYap } from '../moduller/kimlik-dogrulama/giris/EmailIleGirisYap';
import { EmailIleKayitOl } from '../moduller/kimlik-dogrulama/giris/EmailIleKayitOl';
import { AppleIleGirisYap } from '../moduller/kimlik-dogrulama/giris/AppleIleGirisYap';
import { MisafirOlarakDevamEt } from '../moduller/misafir-hesabi/islemler/MisafirOlarakDevamEt';
import { CihazOturumuKaydet } from '../moduller/kimlik-dogrulama/oturum/CihazOturumuKaydet';
import { GuvenlikOlayiKaydet } from '../moduller/guvenlik/olaylar/GuvenlikOlayiKaydet';
import { CihazPushTokeniniKaydet } from '../moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import { OrtamDegiskenleri } from '../yapilandirma/OrtamDegiskenleri';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  isGuest: boolean;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string; cancelled?: boolean }>;
  signUp: (input: {
    email: string;
    password: string;
    username: string;
    displayName: string;
    gender?: string;
  }) => Promise<{ error?: string; needsConfirm?: boolean }>;
  continueAsGuest: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const isGuest =
    profile?.is_guest === true ||
    session?.user?.is_anonymous === true ||
    session?.user?.app_metadata?.provider === 'anonymous';

  const refreshProfile = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  const refreshWallet = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) {
      setWallet(null);
      return;
    }
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    setWallet((data as Wallet) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' && next) {
        GuvenlikOlayiKaydet('login_success', { event });
        void CihazOturumuKaydet();
        void CihazPushTokeniniKaydet();
      }
      if (event === 'SIGNED_OUT') {
        GuvenlikOlayiKaydet('logout');
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setWallet(null);
      return;
    }
    void refreshProfile();
    void refreshWallet();
    void CihazOturumuKaydet();
  }, [session?.user?.id, refreshProfile, refreshWallet]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await EmailIleGirisYap(email, password);
    if (result.error) {
      GuvenlikOlayiKaydet('login_failed');
    }
    return result;
  }, []);

  const signInWithApple = useCallback(async () => {
    const sonuc = await AppleIleGirisYap();
    if (!sonuc.ok) {
      if (sonuc.iptal) return { cancelled: true };
      GuvenlikOlayiKaydet('login_failed', { provider: 'apple' });
      return { error: sonuc.hata };
    }
    return {};
  }, []);

  const signUp = useCallback(
    async (input: {
      email: string;
      password: string;
      username: string;
      displayName: string;
      gender?: string;
    }) => EmailIleKayitOl(input),
    [],
  );

  const continueAsGuest = useCallback(async () => {
    const sonuc = await MisafirOlarakDevamEt();
    if (!sonuc.ok) return { error: sonuc.hata };
    GuvenlikOlayiKaydet('guest_continue');
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${OrtamDegiskenleri.uygulamaSemasi}://reset-password`,
    });
    return { error: error?.message };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      wallet,
      loading,
      isGuest: !!isGuest,
      refreshProfile,
      refreshWallet,
      signIn,
      signInWithApple,
      signUp,
      continueAsGuest,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      session,
      profile,
      wallet,
      loading,
      isGuest,
      refreshProfile,
      refreshWallet,
      signIn,
      signInWithApple,
      signUp,
      continueAsGuest,
      signOut,
      resetPassword,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
