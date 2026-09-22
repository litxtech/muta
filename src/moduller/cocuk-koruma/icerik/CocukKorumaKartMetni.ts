/**
 * Çocuk Koruma onay kartı — TR + EN, karakter sınırı yok.
 * Tek seferlik; onayda kaybolur, “değilim” + onayda hesap kapanır.
 */

export const COCUK_KORUMA_KART = {
  baslikTr: 'Çocuk Koruma',
  baslikEn: 'Child Protection',
  govdeTr: `Tamuso yalnızca 18 yaşını doldurmuş kişiler içindir.

Çocukların (18 yaş altı) güvenliği en yüksek önceliğimizdir. Platformda çocuk cinsel istismarı materyali (CSAM), çocuk sömürüsü, grooming, reşit olmayanlara yönelik cinsel içerik veya reşit olmayanların katılımına SIFIR TOLERANS uygulanır.

Bu politikayı ihlal eden hesaplar derhal ve kalıcı olarak kapatılır. Af yoktur. Gerekli hallerde yasal mercilere bildirim yapılır.

Devam etmek için 18 yaşından büyük olduğunuzu beyan etmelisiniz. 18 yaşından küçük olduğunuzu belirtirseniz hesabınız kapatılır ve giriş lobisine yönlendirilirsiniz.

Bu onay her hesap için yalnızca bir kez istenir.`,
  govdeEn: `Tamuso is only for people who are 18 years of age or older.

The safety of children (under 18) is our highest priority. We have ZERO TOLERANCE for child sexual abuse material (CSAM), child exploitation, grooming, sexual content involving minors, or participation by minors on the Platform.

Accounts that violate this policy are closed immediately and permanently. There is no amnesty. Where required, we report to authorities.

To continue, you must confirm that you are 18 or older. If you indicate that you are under 18, your account will be closed and you will be returned to the login lobby.

This confirmation is requested only once per account.`,
  btnBuyugumTr: '18 yaşından büyüğüm',
  btnBuyugumEn: 'I am 18 or older',
  btnDegilimTr: '18 yaşından değilim',
  btnDegilimEn: 'I am under 18',
  onayUyariTr:
    '18 yaşından küçük olduğunuzu onaylıyorsanız hesabınız kapatılacak ve lobiye yönlendirileceksiniz. Bu işlem geri alınamaz.',
  onayUyariEn:
    'If you confirm you are under 18, your account will be closed and you will be sent to the login lobby. This cannot be undone.',
  btnOnayKapatTr: 'Onaylıyorum — hesabımı kapat',
  btnOnayKapatEn: 'I confirm — close my account',
  btnVazgecTr: 'Vazgeç',
  btnVazgecEn: 'Go back',
} as const;
