import { supabase } from '../../lib/supabase';
import {
  DepoyaMedyaYukle,
  MedyaUzantisiCoz,
} from '../../ortak/medya/DepoyaMedyaYukle';
import { BANNER_STORAGE_BUCKET } from '../core/BannerConstants';
import type {
  BannerAnalyticsSummary,
  BannerCampaign,
  BannerStatus,
} from '../core/BannerTypes';
import type { BannerAdminSavePayload } from '../admin/BannerAdminTypes';
import { BannerCacheService } from '../services/BannerCacheService';

function normalize(row: Record<string, unknown>): BannerCampaign {
  return {
    ...(row as unknown as BannerCampaign),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    placements: Array.isArray(row.placements)
      ? (row.placements as BannerCampaign['placements'])
      : [],
    targets: Array.isArray(row.targets)
      ? (row.targets as BannerCampaign['targets'])
      : [],
    actions: Array.isArray(row.actions)
      ? (row.actions as BannerCampaign['actions'])
      : [],
    dismissible: Boolean(row.dismissible),
    shimmer_enabled: Boolean(row.shimmer_enabled),
    autoplay_video: row.autoplay_video !== false,
    loop_video: row.loop_video !== false,
    priority: Number(row.priority ?? 50),
    impression_count: Number(row.impression_count ?? 0),
    click_count: Number(row.click_count ?? 0),
  };
}

export const BannerAdminService = {
  async list(): Promise<BannerCampaign[]> {
    const { data, error } = await supabase.rpc('admin_banner_listele');
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data : []).map((r) =>
      normalize(r as Record<string, unknown>),
    );
  },

  async save(payload: BannerAdminSavePayload): Promise<string> {
    const { data, error } = await supabase.rpc('admin_banner_kaydet', {
      p_payload: payload,
    });
    if (error) throw new Error(error.message);
    const id = (data as { id?: string })?.id;
    if (!id) throw new Error('Kayıt başarısız');
    BannerCacheService.invalidate();
    return id;
  },

  async setStatus(bannerId: string, status: BannerStatus): Promise<void> {
    const { error } = await supabase.rpc('admin_banner_durum_degistir', {
      p_banner_id: bannerId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    BannerCacheService.invalidate();
  },

  async duplicate(bannerId: string): Promise<string> {
    const { data, error } = await supabase.rpc('admin_banner_kopyala', {
      p_banner_id: bannerId,
    });
    if (error) throw new Error(error.message);
    const id = (data as { id?: string })?.id;
    if (!id) throw new Error('Kopyalama başarısız');
    BannerCacheService.invalidate();
    return id;
  },

  async analytics(bannerId: string): Promise<BannerAnalyticsSummary> {
    const { data, error } = await supabase.rpc('admin_banner_analitik', {
      p_banner_id: bannerId,
    });
    if (error) throw new Error(error.message);
    return data as BannerAnalyticsSummary;
  },

  async uploadMedia(input: {
    uri: string;
    mime?: string | null;
    tur: 'image' | 'video';
    bannerId?: string;
  }): Promise<{ url: string; path: string }> {
    const ext = MedyaUzantisiCoz(
      input.uri,
      input.mime,
      input.tur === 'video' ? 'mp4' : 'jpg',
    );
    const folder = input.bannerId ?? 'draft';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const result = await DepoyaMedyaYukle(supabase, {
      bucket: BANNER_STORAGE_BUCKET,
      path,
      uri: input.uri,
      mime: input.mime,
      tur: input.tur,
      upsert: false,
    });

    if (!result.ok) throw new Error(result.hata);

    const { data } = supabase.storage
      .from(BANNER_STORAGE_BUCKET)
      .getPublicUrl(result.path);

    return { url: data.publicUrl, path: result.path };
  },
};
