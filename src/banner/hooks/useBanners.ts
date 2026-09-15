import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { BannerService } from '../services/BannerService';
import { BannerEngine } from '../core/BannerEngine';
import type { BannerCampaign, BannerUserContext, BannerUserState } from '../core/BannerTypes';
import { uretimOrtamiMi } from '../../yapilandirma/OrtamDegiskenleri';

function makeSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

let sharedSessionId = makeSessionId();

export function useBannerSessionId(): string {
  return sharedSessionId;
}

export function useBanners(placement: string) {
  const { profile, isGuest } = useAuth();
  const [banners, setBanners] = useState<BannerCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statesRef = useRef<Map<string, BannerUserState>>(new Map());
  const sessionId = useBannerSessionId();

  const ctx: BannerUserContext = useMemo(() => {
    const created = profile?.created_at
      ? new Date(profile.created_at).getTime()
      : Date.now();
    const ageDays = Math.max(
      0,
      Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)),
    );
    return {
      userId: profile?.id,
      isGuest: isGuest || !!profile?.is_guest,
      isHost: !!profile?.is_host,
      isVip: false,
      isCreator: !!profile?.is_host,
      level: profile?.level ?? 0,
      language: profile?.language ?? 'tr',
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      country: profile?.country,
      countryCode: profile?.country_code,
      regionId: profile?.region_id,
      city: null,
      accountAgeDays: ageDays,
      sessionId,
    };
  }, [profile, isGuest, sessionId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await BannerService.fetchActive();
      const states = await BannerService.fetchUserStates(all.map((b) => b.id));
      const map = new Map(states.map((s) => [s.banner_id, s]));
      statesRef.current = map;
      const filtered = BannerEngine.forPlacement(
        { banners: all, userStates: map, fetchedAt: Date.now() },
        placement,
        ctx,
      );
      setBanners(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Banner yüklenemedi');
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [placement, ctx]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const unsub = BannerService.subscribeRealtime(() => {
      void reload();
    });
    return unsub;
  }, [reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  const dismissLocal = useCallback((bannerId: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== bannerId));
  }, []);

  return {
    banners,
    loading,
    error,
    reload,
    dismissLocal,
    ctx,
    sessionId,
    debug: !uretimOrtamiMi,
  };
}
