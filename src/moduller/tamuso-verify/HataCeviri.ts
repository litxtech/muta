/** Sunucu hata kodlarını yerelleştirilmiş mesaja çevirir. */
import type { CeviriAnahtari } from '../../i18n/useCeviri';

const HARITA: Record<string, CeviriAnahtari> = {
  document_required: 'verify.hataBelgeGerekli',
  document_back_required: 'verify.hataArkaGerekli',
  selfie_required: 'verify.hataSelfieGerekli',
  adult_required: 'verify.hataYetiskin',
  invalid_first_name: 'verify.hataAd',
  invalid_last_name: 'verify.hataSoyad',
  birth_date_required: 'verify.hataTarih',
  invalid_birth_date: 'verify.hataTarih',
  guest_not_allowed: 'verify.hataMisafir',
  document_type_not_supported: 'verify.hataBelgeDesteklenmiyor',
  application_not_editable: 'verify.hataTekrar',
  application_not_submittable: 'verify.hataTekrar',
  selfie_attempts_exhausted: 'verify.hataDenemeBitti',
  session_expired: 'verify.hataOturumSuresi',
  invalid_session_token: 'verify.hataOturumSuresi',
  session_not_pending: 'verify.hataOturumSuresi',
  challenge_sequence_mismatch: 'verify.hataGenel',
  challenge_sequence_incomplete: 'verify.hataGenel',
  challenge_not_completed: 'verify.hataGenel',
  invalid_storage_path: 'verify.hataYukleme',
  invalid_mime: 'verify.hataYukleme',
  invalid_file_size: 'verify.hataYukleme',
  invalid_side: 'verify.hataGenel',
  back_side_not_supported: 'verify.hataArkaGerekli',
  invalid_capture_source: 'verify.hataGenel',
  invalid_quality_payload: 'verify.hataYukleme',
  selfie_not_allowed: 'verify.hataGenel',
  invalid_state: 'verify.hataTekrar',
  already_decided: 'verify.hataTekrar',
  not_submitted_yet: 'verify.hataGenel',
  no_pending_action: 'verify.hataGenel',
  pending_action_exists: 'verify.hataGenel',
  appeal_not_allowed: 'verify.itirazYok',
  appeal_already_open: 'verify.itirazZatenVar',
  appeal_closed: 'verify.itirazZatenVar',
  appeal_message_too_short: 'verify.itirazKisa',
  appeal_message_too_long: 'verify.itirazKisa',
  already_verified: 'verify.durum_approved',
  invalid_country: 'verify.hataGenel',
  not_authenticated: 'verify.hataGenel',
  'Not found': 'verify.hataGenel',
  Forbidden: 'verify.hataGenel',
};

/** "upload_failed:..." gibi önekli mesajlarda da çalışır. */
export function verifyHataAnahtari(kod: string | undefined | null): CeviriAnahtari {
  const ham = (kod ?? '').trim();
  if (!ham) return 'verify.hataGenel';
  if (ham.toLowerCase().startsWith('upload_failed')) return 'verify.hataYukleme';
  if (ham.toLowerCase().includes('network') || ham.toLowerCase().includes('fetch')) {
    return 'verify.hataBaglanti';
  }
  const dirett = HARITA[ham];
  if (dirett) return dirett;
  const ilk = ham.split(':')[0].trim();
  return HARITA[ilk] ?? 'verify.hataGenel';
}

export function durumAnahtarSoneki(
  durum: string,
): 'not_started' | 'in_progress' | 'awaiting_document' | 'awaiting_selfie' | 'under_review' | 'additional_verification' | 'approved' | 'rejected' | 'appeal_review' {
  switch (durum) {
    case 'in_progress':
    case 'awaiting_document':
    case 'awaiting_selfie':
    case 'under_review':
    case 'additional_verification':
    case 'approved':
    case 'rejected':
    case 'appeal_review':
      return durum;
    default:
      return 'not_started';
  }
}

export function durumBaslikAnahtari(durum: string): CeviriAnahtari {
  return `verify.durum_${durumAnahtarSoneki(durum)}` as CeviriAnahtari;
}

export function durumAciklamaAnahtari(durum: string): CeviriAnahtari {
  return `verify.durum_${durumAnahtarSoneki(durum)}Aciklama` as CeviriAnahtari;
}

export function belgeTuruAnahtari(tur: string): CeviriAnahtari {
  switch (tur) {
    case 'passport':
      return 'verify.belgePassport';
    case 'drivers_license':
      return 'verify.belgeDrivers';
    case 'residence_permit':
      return 'verify.belgeResidence';
    default:
      return 'verify.belgeIdCard';
  }
}

export function adimAnahtari(adim: string): CeviriAnahtari {
  switch (adim) {
    case 'right':
      return 'verify.adimRight';
    case 'left':
      return 'verify.adimLeft';
    case 'blink':
      return 'verify.adimBlink';
    case 'smile':
      return 'verify.adimSmile';
    default:
      return 'verify.adimCenter';
  }
}

export function kaliteAnahtari(kod: string): CeviriAnahtari {
  switch (kod) {
    case 'bulanik':
      return 'verify.kaliteBulanik';
    case 'karanlik':
      return 'verify.kaliteKaranlik';
    case 'parlama':
      return 'verify.kaliteParlama';
    case 'kucuk':
      return 'verify.kaliteKucuk';
    case 'kontrast':
      return 'verify.kaliteKontrast';
    default:
      return 'verify.kaliteTamam';
  }
}
