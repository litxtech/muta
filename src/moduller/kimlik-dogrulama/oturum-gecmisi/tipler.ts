/** Lobide gösterilen kayıtlı hesap özeti (token ayrı tutulur). */
export type OturumGecmisiKaydi = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** Giriş alanına doldurmak için e-posta veya kullanıcı adı */
  kimlik: string | null;
  kaydedildiAt: string;
};

export type OturumGecmisiToken = {
  accessToken: string;
  refreshToken: string;
};

export const OTURUM_GECMISI_MAX = 5;
