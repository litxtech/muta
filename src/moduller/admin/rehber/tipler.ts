export type AdminRehberKisi = {
  id: string;
  display_name: string | null;
  username: string | null;
  public_user_id: string | null;
  phone_e164: string | null;
  email: string | null;
  avatar_url: string | null;
  is_guest: boolean;
  is_host: boolean;
  banned_at: string | null;
  created_at: string;
};
