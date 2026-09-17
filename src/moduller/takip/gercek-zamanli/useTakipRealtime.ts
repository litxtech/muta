import { useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { TakipCache } from '../onbellek/TakipCache';

/**
 * Yalnizca current user ile ilgili follow/request eventleri.
 * Global follows subscription acilmaz. Unmount'ta channel kapanir.
 */
export function useTakipRealtime(input: {
  userId: string | null | undefined;
  onChange?: () => void;
}) {
  const userId = input.userId;
  const onChange = input.onChange;

  useEffect(() => {
    if (!userId) return;
    const topic = `takip-ben-${userId}`;
    const kanal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${userId}`,
        },
        () => {
          TakipCache.invalidateUser(userId);
          onChange?.();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${userId}`,
        },
        () => {
          TakipCache.invalidateUser(userId);
          onChange?.();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_requests',
          filter: `target_id=eq.${userId}`,
        },
        () => {
          TakipCache.invalidateUser(userId);
          onChange?.();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(kanal);
    };
  }, [userId, onChange]);
}
