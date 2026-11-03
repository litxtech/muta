import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { AdminOdemeTalimatiGetir } from '../AdminYayinciFinanceApi';

/** Creator finance sub-navigation (Finans → Yayıncı Kazançları). */
export const YAYINCI_NAV = [
  { href: '/admin/finance/yayinci', label: 'Genel Bakış', icon: 'analytics-outline' as const },
  { href: '/admin/finance/yayinci/bekleyen', label: 'Bekleyen Gelirler', icon: 'hourglass-outline' as const },
  { href: '/admin/finance/yayinci/onaylar', label: 'Ödeme Onayları', icon: 'checkmark-done-outline' as const },
  { href: '/admin/finance/yayinci/odemeler', label: 'Ödemeler', icon: 'cash-outline' as const },
  { href: '/admin/finance/yayinci/iade-itiraz', label: 'İade & İtiraz', icon: 'shield-outline' as const },
  { href: '/admin/finance/yayinci/rapor', label: 'Finans Raporu', icon: 'document-text-outline' as const },
  { href: '/admin/finance/yayinci/ayarlar', label: 'Ödeme Ayarları', icon: 'settings-outline' as const },
] as const;

export function YayinciNav() {
  const path = usePathname();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {YAYINCI_NAV.map((n) => {
        const active =
          n.href === '/admin/finance/yayinci'
            ? path === '/admin/finance/yayinci' || path === '/admin/finance/yayinci/'
            : path?.startsWith(n.href);
        return (
          <Pressable
            key={n.href}
            onPress={() => router.push(n.href as any)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Ionicons
              name={n.icon}
              size={13}
              color={active ? RenkTokenlari.text : RenkTokenlari.textMuted}
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Usd(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function Sayi(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('tr-TR');
}

export function Yuzde(n: number | null | undefined): string {
  return `%${(Number(n ?? 0) * 100).toFixed(0)}`;
}

export function Tarih(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TarihSaat(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const KAZANC_DURUM: Record<string, string> = {
  pending: 'Bekleyen',
  available: 'Ödemeye Hazır',
  on_hold: 'İncelemede',
  in_payout: 'Ödeme İşleminde',
  paid: 'Ödendi',
};

export function KazancDurumEtiketi(s: string | null | undefined): string {
  return KAZANC_DURUM[s ?? ''] ?? s ?? '—';
}

const BATCH_DURUM: Record<string, string> = {
  draft: 'Taslak',
  pending_approval: 'Onay Bekliyor',
  approved: 'Onaylandı',
  processing: 'İşlemde',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

export function BatchDurumEtiketi(s: string | null | undefined): string {
  return BATCH_DURUM[s ?? ''] ?? s ?? '—';
}

const OGE_DURUM: Record<string, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylı',
  sent: 'Gönderildi',
  paid: 'Ödendi',
  failed: 'Başarısız',
  removed: 'Çıkarıldı',
};

export function OgeDurumEtiketi(s: string | null | undefined): string {
  return OGE_DURUM[s ?? ''] ?? s ?? '—';
}

const BELGE_TURU: Record<string, string> = {
  personal_id: 'Kimlik',
  tax_certificate: 'Vergi levhası',
  company_registration: 'Ticaret sicil gazetesi',
  company_signature: 'Şirket imza sirküleri',
  bank_letter: 'Banka yazısı',
  address_proof: 'Adres belgesi',
  other: 'Diğer belge',
};

export function BelgeTuruEtiketi(s: string | null | undefined): string {
  return BELGE_TURU[s ?? ''] ?? s ?? '—';
}

const PROFIL_DURUM: Record<string, string> = {
  incomplete: 'Eksik',
  submitted: 'Onay bekliyor',
  verified: 'Doğrulandı',
  rejected: 'Reddedildi',
};

export function ProfilDurumEtiketi(s: string | null | undefined): string {
  return PROFIL_DURUM[s ?? ''] ?? s ?? '—';
}

export function durumRengi(s: string | null | undefined): string {
  switch (s) {
    case 'paid':
    case 'completed':
    case 'verified':
      return RenkTokenlari.mint;
    case 'in_payout':
    case 'approved':
    case 'sent':
      return RenkTokenlari.primarySoft;
    case 'on_hold':
    case 'pending':
    case 'pending_approval':
    case 'failed':
      return RenkTokenlari.accent;
    case 'cancelled':
    case 'rejected':
      return RenkTokenlari.danger;
    default:
      return RenkTokenlari.textMuted;
  }
}

export function Kart({
  baslik,
  alt,
  children,
  onPress,
}: {
  baslik?: string;
  alt?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const Icerik = (
    <>
      {baslik ? <Text style={styles.kartBaslik}>{baslik}</Text> : null}
      {alt ? <Text style={styles.kartAlt}>{alt}</Text> : null}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.kart}>
        {Icerik}
      </Pressable>
    );
  }
  return <View style={styles.kart}>{Icerik}</View>;
}

export function Etiket({ metin, renk }: { metin: string; renk?: string }) {
  return (
    <View style={styles.etiket}>
      <Text style={[styles.etiketYazi, renk ? { color: renk } : null]}>{metin}</Text>
    </View>
  );
}

export function BilgiKutusu({
  baslik,
  metin,
  tehlike,
}: {
  baslik: string;
  metin: string;
  tehlike?: boolean;
}) {
  return (
    <View style={[styles.bilgi, tehlike && styles.bilgiTehlike]}>
      <Text style={[styles.bilgiBaslik, tehlike && { color: RenkTokenlari.danger }]}>
        {baslik}
      </Text>
      <Text style={styles.bilgiMetin}>{metin}</Text>
    </View>
  );
}

/** Ödeme talimatı alan adlarının yönetici paneli karşılıkları. */
const TALIMAT_ALAN: Record<string, string> = {
  iban: 'IBAN',
  account_number: 'Hesap numarası',
  routing_number: 'Yönlendirme (routing) no',
  account_type: 'Hesap türü',
  swift_bic: 'SWIFT / BIC',
  wallet_provider: 'Cüzdan sağlayıcısı',
  wallet_number: 'Cüzdan numarası',
  document_id: 'Vergi / kimlik no',
};

const TALIMAT_SEMA: Record<string, string> = {
  iban: 'IBAN havalesi',
  us_ach: 'ABD banka hesabı (ACH)',
  local_account: 'Yerel banka transferi',
  wallet: 'Mobil cüzdan',
};

/**
 * Tam ödeme talimatı kutusu. Tam bilgi yalnızca butona basıldığında,
 * sunucu tarafında denetim kaydı bırakılarak okunur.
 */
export function OdemeTalimati({
  accountId,
  kompakt,
}: {
  accountId: string | null | undefined;
  kompakt?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [veri, setVeri] = useState<Record<string, any> | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yuk, setYuk] = useState(false);

  if (!accountId) {
    return <Text style={styles.kartAlt}>Ödeme talimatı hesaba bağlı değil.</Text>;
  }
  const hedef = accountId;

  async function goster() {
    setYuk(true);
    setHata(null);
    try {
      const d = (await AdminOdemeTalimatiGetir(hedef)) as unknown as Record<string, any>;
      setVeri(d);
      setAcik(true);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Talimat okunamadı');
    } finally {
      setYuk(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.aksiyonSatir}>
        <Pressable
          disabled={yuk}
          onPress={() => (acik ? setAcik(false) : void goster())}
          style={styles.buton}
        >
          {yuk ? (
            <ActivityIndicator size="small" color={RenkTokenlari.text} />
          ) : (
            <Text style={styles.butonYazi}>
              {acik ? 'Talimatı gizle' : 'Ödeme talimatını göster'}
            </Text>
          )}
        </Pressable>
      </View>
      {hata ? <Text style={{ color: RenkTokenlari.danger, fontSize: 12 }}>{hata}</Text> : null}
      {acik && veri ? (
        <View style={styles.talimatKutu}>
          <Text style={styles.talimatBaslik}>
            {TALIMAT_SEMA[String(veri.scheme ?? '')] ?? String(veri.scheme ?? '—')} ·{' '}
            {String(veri.country_code ?? '—')} / {String(veri.currency ?? '—')}
          </Text>
          <Text style={styles.kartAlt}>Hesap sahibi: {String(veri.account_holder ?? '—')}</Text>
          {veri.bank_name ? (
            <Text style={styles.kartAlt}>Banka: {String(veri.bank_name)}</Text>
          ) : null}
          {Object.entries((veri.details ?? {}) as Record<string, string>).map(([k, v]) => (
            <Text key={k} style={styles.talimatSatir}>
              {TALIMAT_ALAN[k] ?? k}: <Text style={styles.talimatDeger}>{String(v)}</Text>
            </Text>
          ))}
          {!kompakt ? (
            <Text style={styles.talimatUyari}>
              Bu görüntüleme finans denetim kaydına yazıldı. Bilgileri yalnızca transfer için
              kullanın.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Two-step confirm button for financial actions. Never fires on the first tap:
 * the admin must read the prompt and press "Onayla".
 */
export function OnayliButon({
  etiket,
  onOnay,
  tehlike,
  disabled,
}: {
  etiket: string;
  onOnay: () => Promise<void> | void;
  tehlike?: boolean;
  disabled?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function calistir() {
    setCalisiyor(true);
    setHata(null);
    try {
      await onOnay();
      setAcik(false);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setCalisiyor(false);
    }
  }

  if (!acik) {
    return (
      <Pressable
        disabled={disabled}
        onPress={() => setAcik(true)}
        style={[
          styles.buton,
          tehlike && styles.butonTehlike,
          disabled && { opacity: 0.45 },
        ]}
      >
        <Text style={[styles.butonYazi, tehlike && { color: RenkTokenlari.danger }]}>
          {etiket}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.onayKutu}>
      <Text style={styles.onaySoru}>Bu finansal işlemi onaylıyor musunuz?</Text>
      <View style={styles.aksiyonSatir}>
        <Pressable
          disabled={calisiyor}
          onPress={() => void calistir()}
          style={[styles.buton, styles.butonOnay]}
        >
          {calisiyor ? (
            <ActivityIndicator size="small" color={RenkTokenlari.text} />
          ) : (
            <Text style={styles.butonYazi}>Onayla</Text>
          )}
        </Pressable>
        <Pressable disabled={calisiyor} onPress={() => setAcik(false)} style={styles.buton}>
          <Text style={styles.butonYazi}>Vazgeç</Text>
        </Pressable>
      </View>
      {hata ? <Text style={{ color: RenkTokenlari.danger, fontSize: 12 }}>{hata}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: BoslukTokenlari.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  chipActive: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  chipText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: RenkTokenlari.text,
  },
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 6,
  },
  kartBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kartAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  etiket: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    alignSelf: 'flex-start',
  },
  etiketYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  bilgi: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 4,
  },
  bilgiTehlike: {
    borderColor: 'rgba(255, 90, 95, 0.35)',
  },
  bilgiBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  bilgiMetin: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
  },
  buton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  butonOnay: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  butonTehlike: {
    borderColor: 'rgba(255, 90, 95, 0.4)',
  },
  butonYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  onayKutu: {
    gap: 6,
    padding: 8,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  onaySoru: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  aksiyonSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.sm,
  },
  talimatKutu: {
    gap: 4,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.bgElevated,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  talimatBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  talimatSatir: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  talimatDeger: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  talimatUyari: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginTop: 4,
  },
});
