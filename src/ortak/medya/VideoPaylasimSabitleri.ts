/**
 * Platform geneli video paylaşım — orijinal kalite, boyut sınırı yok.
 * Video yeniden encode edilmez; dosya diskten akıtılarak yüklenir.
 */

/** false → Video1080eSikistir orijinal dosyayı döndürür (kalite sınırı yok) */
export const VIDEO_SIKISTIRMA_AKTIF = false;

/** Uzun kenar üst sınırı (4K → 1080) */
export const VIDEO_HEDEF_MAX_EDGE = 1080;

/**
 * Manuel bitrate yalnızca fallback.
 * Birincil yol: compressionMethod 'auto' (WhatsApp tarzı HW).
 */
export const VIDEO_HEDEF_BITRATE = 2_800_000;

/**
 * ≤1080 iken bu boyuta kadar sıkıştırmayı atla.
 * Hikaye paylaşımını hızlandırır — telefon kamerası HEVC genelde yeterince küçük.
 */
export const VIDEO_ATLA_MAX_BYTES = 72 * 1024 * 1024;

/**
 * ≤1080 iken ortalama bitrate bu Mbps altındaysa atla
 * (süre biliniyorsa ATLA_MAX’tan bağımsız).
 */
export const VIDEO_ATLA_MAX_MBPS = 14;

/**
 * Native compressor: bu MB altını hiç encode etme.
 */
export const VIDEO_MIN_MB_FOR_COMPRESS = 20;

/**
 * Supabase Storage tek istek sınırı (proje ayarı 50 MB) — R2 kullanılamazsa
 * bunun üstündeki video yüklemeden önce sıkıştırılır.
 */
export const SUPABASE_VIDEO_MAX_BYTES = 48 * 1024 * 1024;

/** Video boyut tavanı — sınır yok */
export const VIDEO_SIKISTIRMA_SONRASI_MAX_BYTES = Number.POSITIVE_INFINITY;

/** Kamera kayıt üst süresi (sn) — pratik tavan; galeride limit yok */
export const VIDEO_KAMERA_MAX_SN = 3600;

/** Hikaye / durum playback meta üst sınırı (ms) — 2 saat */
export const VIDEO_DURATION_META_MAX_MS = 2 * 60 * 60 * 1000;
