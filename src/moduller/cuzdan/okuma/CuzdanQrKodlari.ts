/** Cüzdan numarası QR yükü — yalnızca numara taşır. */
export function CuzdanNoQrPayload(walletNumber: string): string {
  const n = walletNumber.replace(/\D/g, '');
  return `mutapay://w/${n}`;
}
