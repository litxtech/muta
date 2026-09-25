/**
 * Yanıt önizleme metni — composer + baloncuk ortak.
 */
import type { DirektMesaj } from '../okuma/MesajlariGetir';

const MAX_KARAKTER = 72;

export function MesajYanitOzetMetin(
  m: DirektMesaj,
  t: (key: string) => string,
): string {
  if (m.view_once) return t('mesajV2.viewOnce');
  switch (m.message_type) {
    case 'voice':
      return t('mesajV2.voice');
    case 'music':
      return t('mesajV2.music');
    case 'image':
      return t('mesajV2.photo');
    case 'video':
      return t('mesajV2.video');
    case 'shared_post':
      return t('mesajV2.sharedPost');
    default:
      break;
  }
  const ham = (m.body ?? '').replace(/\s+/g, ' ').trim();
  if (!ham) return t('mesajV2.messageUnavailable');
  if (ham.length <= MAX_KARAKTER) return ham;
  return `${ham.slice(0, MAX_KARAKTER - 1)}…`;
}
