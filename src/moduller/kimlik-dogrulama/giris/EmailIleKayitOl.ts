import { supabase } from '../../../lib/supabase';
import { OrtamDegiskenleri } from '../../../yapilandirma/OrtamDegiskenleri';

export async function EmailIleKayitOl(input: {
  email: string;
  password: string;
  username: string;
  displayName: string;
  gender?: string;
}): Promise<{ error?: string; needsConfirm?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        username: input.username.trim().toLowerCase(),
        display_name: input.displayName.trim(),
        gender: input.gender,
        is_guest: false,
      },
      emailRedirectTo: `${OrtamDegiskenleri.uygulamaSemasi}://auth/callback`,
    },
  });
  if (error) return { error: error.message };
  return { needsConfirm: !data.session };
}
