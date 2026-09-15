import type { Profile } from '../../../types/models';

/** UI / route korumasi — authoritative degil; backend is_admin + RLS esas. */
export function AdminYetkisiVarMi(profile: Profile | null | undefined): boolean {
  return profile?.is_admin === true;
}
