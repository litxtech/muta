import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { OrtamDegiskenleri } from '../yapilandirma/OrtamDegiskenleri';
import { GuvenliOturumDepolama } from '../moduller/kimlik-dogrulama/depolama/GuvenliOturumDepolama';

if (!OrtamDegiskenleri.supabaseUrl || !OrtamDegiskenleri.supabaseAnonAnahtari) {
  console.warn('[Kimlik] Supabase URL/key eksik. .env dosyasini kontrol et.');
}

export const supabase = createClient(
  OrtamDegiskenleri.supabaseUrl || 'https://placeholder.supabase.co',
  OrtamDegiskenleri.supabaseAnonAnahtari || 'placeholder',
  {
    auth: {
      storage: GuvenliOturumDepolama,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
