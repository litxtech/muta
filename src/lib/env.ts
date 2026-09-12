/**
 * Uyumluluk — yeni kod OrtamDegiskenleri kullanmali.
 */
import { OrtamDegiskenleri, uretimOrtamiMi } from '../yapilandirma/OrtamDegiskenleri';

export const env = {
  appEnv: OrtamDegiskenleri.ortam,
  supabaseUrl: OrtamDegiskenleri.supabaseUrl,
  supabaseAnonKey: OrtamDegiskenleri.supabaseAnonAnahtari,
  appName: OrtamDegiskenleri.uygulamaAdi,
  scheme: OrtamDegiskenleri.uygulamaSemasi,
};

export const isDev = !uretimOrtamiMi;
