import { supabase } from '../../../lib/supabase';

/** Mavi tikli resmi platform hesabı. */
export type PlatformResmiHesap = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  public_user_id: string | null;
  is_platform_official: boolean;
  is_platform_yargic: boolean;
  is_verified: boolean;
};

export async function PlatformResmiHesaplariListele(): Promise<
  PlatformResmiHesap[]
> {
  const { data, error } = await supabase.rpc('platform_resmi_hesaplari_listele');
  if (error || !data) return [];
  return (data as PlatformResmiHesap[]) ?? [];
}
