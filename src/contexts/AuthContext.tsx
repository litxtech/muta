import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Wallet } from '../types/models';
import { EmailIleGirisYap } from '../moduller/kimlik-dogrulama/giris/EmailIleGirisYap';
import { EmailIleKayitOl } from '../moduller/kimlik-dogrulama/giris/EmailIleKayitOl';
import { AppleIleGirisYap } from '../moduller/kimlik-dogrulama/giris/AppleIleGirisYap';
import { MisafirOlarakDevamEt } from '../moduller/misafir-hesabi/islemler/MisafirOlarakDevamEt';
import { CihazOturumuKaydet } from '../moduller/kimlik-dogrulama/oturum/CihazOturumuKaydet';
import { ManuelCikisYap } from '../moduller/kimlik-dogrulama/oturum/ManuelCikisYap';
import { OturumKorumaDurumunuGetir } from '../moduller/kimlik-dogrulama/oturum/OturumKorumaDurumunuGetir';
import { HesapSil } from '../moduller/kimlik-dogrulama/hesap/HesapSil';
import { GuvenlikOlayiKaydet } from '../moduller/guvenlik/olaylar/GuvenlikOlayiKaydet';
import { CihazPushTokeniniKaydet } from '../moduller/bildirimler/kayit/CihazPushTokeniniKaydet';
import {
  EmailOtpDogrula,
  type EmailOtpAmaci,
} from '../moduller/kimlik-dogrulama/dogrulama/EmailOtpDogrula';
import { EmailOtpYenidenGonder } from '../moduller/kimlik-dogrulama/dogrulama/EmailOtpYenidenGonder';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  isGuest: boolean;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  /** Hesap tamamlandıktan sonra UI'yı anında misafir olmaktan çıkar */
  misafirBayraginiKaldir: () => void;
  /** Harcama / yukleme sonrasi UI aninda guncelle (realtime gelene kadar) */
  patchWallet: (patch: Partial<Pick<Wallet, 'coins' | 'diamonds'>>) => void;
  /** Relatif degisim — hizli art arda islemlerde stale bakiye riski yok */
  adjustWallet: (delta: Partial<Pick<Wallet, 'coins' | 'diamonds'>>) => void;
  signIn: (kimlik: string, password: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string; cancelled?: boolean }>;
  signInWithSpotify: () => Promise<{ error?: string; cancelled?: boolean }>;
  signUp: (input: {
    email?: string;
    phone: string;
    password: string;
    username: string;
    displayName: string;
    gender?: string;
    birthDate?: string;
  }) => Promise<{ error?: string; needsConfirm?: boolean }>;
  continueAsGuest: () => Promise<{ error?: string }>;
  /** Sadece manuel cikis — otomatik sonlandirma yok */
  signOut: () => Promise<void>;
  deleteAccount: (reason?: string) => Promise<{ error?: string }>;
  /** Şifre sıfırlama: e-postaya 6 haneli kod gönderir (link değil) */
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  verifyEmailOtp: (
    email: string,
    kod: string,
    amac: EmailOtpAmaci,
  ) => Promise<{ ok: boolean; hata?: string }>;
  resendEmailOtp: (
    email: string,
    amac: EmailOtpAmaci,
  ) => Promise<{ ok: boolean; hata?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const korumaKontrolRef = useRef(false);

  /**
   * Misafir mi?
   * Kaynak: yalnızca profiles.is_guest.
   * Auth is_anonymous, e-posta bağlandıktan sonra bile kalabiliyor;
   * profile yüklenmeden buna bakmak tamamlanmış hesapta şifre/hesap kartını
   * yanlış açıyordu (özellikle yavaş Android ağında).
   */
  const isGuest = profile?.is_guest === true;

  const oturumuEngelDurumundaKapat = useCallback(async () => {
    if (korumaKontrolRef.current) return;
    korumaKontrolRef.current = true;
    try {
      const durum = await OturumKorumaDurumunuGetir();
      if (durum.ok) return;
      if (durum.kod === 'banned') {
        await ManuelCikisYap('ban');
        return;
      }
      if (durum.kod === 'deleted') {
        await ManuelCikisYap('account_deleted');
      }
    } finally {
      korumaKontrolRef.current = false;
    }
  }, []);

  const misafirBayraginiKaldir = useCallback(() => {
    setProfile((prev) => {
      if (!prev || prev.is_guest !== true) return prev;
      return { ...prev, is_guest: false };
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    let next = (data as Profile) ?? null;

    // Hesap tamamlanmis ama is_guest bayragi takili kalmissa duzelt
    const emailKimligiVar = Boolean(
      authData.user?.email ||
        authData.user?.identities?.some(
          (i) =>
            i.provider === 'email' ||
            i.provider === 'spotify' ||
            i.provider === 'apple',
        ),
    );
    const metaMisafirDegil =
      authData.user?.user_metadata?.is_guest === false ||
      authData.user?.user_metadata?.is_guest === 'false';
    if (next?.is_guest === true && (emailKimligiVar || metaMisafirDegil)) {
      const { error } = await supabase
        .from('profiles')
        .update({ is_guest: false })
        .eq('id', uid);
      if (!error) {
        next = { ...next, is_guest: false };
      } else {
        // RLS engellerse bile UI kilidini gecici kaldir
        next = { ...next, is_guest: false };
      }
    }

    setProfile(next);

    if (next?.banned_at) {
      await ManuelCikisYap('ban');
      return;
    }
    if (next?.deleted_at) {
      await ManuelCikisYap('account_deleted');
    }
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

  const patchWallet = useCallback(
    (patch: Partial<Pick<Wallet, 'coins' | 'diamonds'>>) => {
      setWallet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coins:
            patch.coins !== undefined
              ? Math.max(0, Math.floor(patch.coins))
              : prev.coins,
          diamonds:
            patch.diamonds !== undefined
              ? Math.max(0, Math.floor(patch.diamonds))
              : prev.diamonds,
          updated_at: new Date().toISOString(),
        };
      });
    },
    [],
  );

  const adjustWallet = useCallback(
    (delta: Partial<Pick<Wallet, 'coins' | 'diamonds'>>) => {
      setWallet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          coins:
            delta.coins !== undefined
              ? Math.max(0, Math.floor(prev.coins + delta.coins))
              : prev.coins,
          diamonds:
            delta.diamonds !== undefined
              ? Math.max(0, Math.floor(prev.diamonds + delta.diamonds))
              : prev.diamonds,
          updated_at: new Date().toISOString(),
        };
      });
    },
    [],
  );

  // Cuzdan realtime — harcama / yukleme her ekranda aninda
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;

    const channel = supabase
      .channel(`wallet-live-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as Wallet | null;
          if (row && typeof row.coins === 'number') {
            setWallet(row);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) void oturumuEngelDurumundaKapat();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // TOKEN_REFRESHED / INITIAL_SESSION oturumu bitirmez — sadece engel kontrolu
      if (event === 'SIGNED_IN' && next) {
        GuvenlikOlayiKaydet('login_success', { event });
        void CihazOturumuKaydet();
        void CihazPushTokeniniKaydet();
        void oturumuEngelDurumundaKapat();
      }
      if (event === 'TOKEN_REFRESHED' && next) {
        void oturumuEngelDurumundaKapat();
      }
      // SIGNED_OUT: Guvenlik olayini ManuelCikisYap / signOut zaten yazar
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [oturumuEngelDurumundaKapat]);

  // On plana gelince ban/silme kontrolu — idle timeout yok
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && session?.user) {
        void oturumuEngelDurumundaKapat();
        void refreshWallet();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [session?.user, oturumuEngelDurumundaKapat, refreshWallet]);

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

  const signIn = useCallback(async (kimlik: string, password: string) => {
    const result = await EmailIleGirisYap(kimlik, password);
    if (result.error) {
      GuvenlikOlayiKaydet('login_failed');
      return result;
    }
    const durum = await OturumKorumaDurumunuGetir();
    if (!durum.ok && (durum.kod === 'banned' || durum.kod === 'deleted')) {
      await ManuelCikisYap(durum.kod === 'banned' ? 'ban' : 'account_deleted');
      return { error: durum.mesaj ?? 'Hesap kullanılamıyor' };
    }
    return {};
  }, []);

  const signInWithApple = useCallback(async () => {
    const sonuc = await AppleIleGirisYap();
    if (!sonuc.ok) {
      if (sonuc.iptal) return { cancelled: true };
      GuvenlikOlayiKaydet('login_failed', { provider: 'apple' });
      return { error: sonuc.hata };
    }
    const durum = await OturumKorumaDurumunuGetir();
    if (!durum.ok && (durum.kod === 'banned' || durum.kod === 'deleted')) {
      await ManuelCikisYap(durum.kod === 'banned' ? 'ban' : 'account_deleted');
      return { error: durum.mesaj ?? 'Hesap kullanılamıyor' };
    }
    return {};
  }, []);

  const signInWithSpotify = useCallback(async () => {
    // Lazy: expo-web-browser native yoksa AuthContext yüklenirken çökmesin
    let SpotifyIleGirisYap: typeof import('../moduller/kimlik-dogrulama/giris/SpotifyIleGirisYap').SpotifyIleGirisYap;
    try {
      ({ SpotifyIleGirisYap } = await import(
        '../moduller/kimlik-dogrulama/giris/SpotifyIleGirisYap'
      ));
    } catch {
      return {
        error:
          'Spotify girişi için yeni development build gerekli (expo-web-browser).',
      };
    }
    let sonuc: Awaited<ReturnType<typeof SpotifyIleGirisYap>>;
    try {
      sonuc = await SpotifyIleGirisYap();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('ExpoWebBrowser') || msg.includes('native module')) {
        return {
          error:
            'Spotify girişi için yeni development build gerekli (expo-web-browser).',
        };
      }
      GuvenlikOlayiKaydet('login_failed', { provider: 'spotify' });
      return { error: 'Spotify girişi başarısız. Tekrar dene.' };
    }
    if (!sonuc.ok) {
      if (sonuc.iptal) return { cancelled: true };
      GuvenlikOlayiKaydet('login_failed', { provider: 'spotify' });
      return { error: sonuc.hata };
    }
    const durum = await OturumKorumaDurumunuGetir();
    if (!durum.ok && (durum.kod === 'banned' || durum.kod === 'deleted')) {
      await ManuelCikisYap(durum.kod === 'banned' ? 'ban' : 'account_deleted');
      return { error: durum.mesaj ?? 'Hesap kullanılamıyor' };
    }
    return {};
  }, []);

  const signUp = useCallback(
    async (input: {
      email?: string;
      phone: string;
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
    await ManuelCikisYap('manual');
  }, []);

  const deleteAccount = useCallback(async (reason?: string) => {
    const r = await HesapSil({ reason });
    if (!r.ok) return { error: r.hata };
    return {};
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    // 6 haneli OTP — şablon {{ .Token }}; redirect/link kullanılmaz
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
    );
    return { error: error?.message };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message };
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, kod: string, amac: EmailOtpAmaci) =>
      EmailOtpDogrula({ email, kod, amac }),
    [],
  );

  const resendEmailOtp = useCallback(
    async (email: string, amac: EmailOtpAmaci) =>
      EmailOtpYenidenGonder({ email, amac }),
    [],
  );

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
      misafirBayraginiKaldir,
      patchWallet,
      adjustWallet,
      signIn,
      signInWithApple,
      signInWithSpotify,
      signUp,
      continueAsGuest,
      signOut,
      deleteAccount,
      resetPassword,
      updatePassword,
      verifyEmailOtp,
      resendEmailOtp,
    }),
    [
      session,
      profile,
      wallet,
      loading,
      isGuest,
      refreshProfile,
      refreshWallet,
      misafirBayraginiKaldir,
      patchWallet,
      adjustWallet,
      signIn,
      signInWithApple,
      signInWithSpotify,
      signUp,
      continueAsGuest,
      signOut,
      deleteAccount,
      resetPassword,
      updatePassword,
      verifyEmailOtp,
      resendEmailOtp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
