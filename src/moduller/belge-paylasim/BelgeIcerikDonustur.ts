import type { AdminOzet } from '../admin/okuma/AdminOzetGetir';
import type { BelgeIcerik } from './BelgeSablonlari';
import {
  LedgerAnlasilirOzet,
  LedgerBirimEtiketi,
  LedgerRefEtiketi,
  LedgerSebepEtiketi,
  LedgerTutarYazi,
  type LedgerSatiri,
} from '../cuzdan/okuma/CuzdanLedgeriniGetir';
import type { HediyeGecmisiKaydi } from '../hediyeler/okuma/HediyeGecmisiniGetir';
import { CEKIM_ODEME_BILGISI } from '../cuzdan/cekim/CekimOdemeBilgisi';
import type {
  AdminCiroOzeti,
  CiroDonem,
} from '../admin/ciro/AdminCiroOzetiGetir';
import { SayiKisa } from '../admin/bilesenler/AdminStil';

function tryYazi(n: number): string {
  return `${Number(n || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`;
}

const DONEM_ETIKET: Record<CiroDonem, string> = {
  today: 'Bugün',
  week: 'Bu hafta',
  month: 'Bu ay',
  all: 'Tüm zamanlar',
};

/** Admin ciro raporu — PDF / WhatsApp / yazıcı */
export function AdminCiroBelgesiOlustur(data: AdminCiroOzeti | null): BelgeIcerik {
  const period = data?.period ?? 'today';
  const m = data?.ozet?.[period] ?? { try: 0, coins: 0, adet: 0 };
  const o = data?.ozet;
  return {
    baslik: 'Ciro raporu',
    altBaslik: `${DONEM_ETIKET[period]} · Tamuso`,
    platformAdi: 'Tamuso',
    ozet: `${DONEM_ETIKET[period]} ciro: ${tryYazi(m.try)} · ${SayiKisa(m.coins)} coin · ${m.adet} işlem`,
    satirlar: [
      { etiket: 'Dönem', deger: DONEM_ETIKET[period] },
      { etiket: 'Ciro (TRY)', deger: tryYazi(m.try) },
      { etiket: 'Coin', deger: SayiKisa(m.coins) },
      { etiket: 'İşlem adedi', deger: String(m.adet) },
      {
        etiket: 'Rapor zamanı',
        deger: data?.generated_at
          ? new Date(data.generated_at).toLocaleString('tr-TR')
          : new Date().toLocaleString('tr-TR'),
      },
    ],
    bolumler: [
      {
        baslik: 'Özet kartlar',
        satirlar: [
          { etiket: 'Bugün', deger: tryYazi(o?.today.try ?? 0) },
          { etiket: 'Bu hafta', deger: tryYazi(o?.week.try ?? 0) },
          { etiket: 'Bu ay', deger: tryYazi(o?.month.try ?? 0) },
          { etiket: 'Toplam', deger: tryYazi(o?.all.try ?? 0) },
        ],
      },
      {
        baslik: 'Kimden (dönem)',
        ozet: `${data?.kimden?.length ?? 0} kullanıcı`,
        satirlar: (data?.kimden ?? []).slice(0, 40).map((k) => ({
          etiket: k.display_name || k.username || k.public_user_id || 'Kullanıcı',
          deger: `${tryYazi(Number(k.toplam_try))} · ${SayiKisa(Number(k.toplam_coin))} coin · ${k.islem_adet}×`,
        })),
      },
      {
        baslik: 'Son işlemler',
        satirlar: (data?.islemler ?? []).slice(0, 40).map((i) => ({
          etiket: `${i.display_name} · ${new Date(i.created_at).toLocaleString('tr-TR')}`,
          deger: `${tryYazi(Number(i.amount_try))} · ${SayiKisa(Number(i.coins_added))} coin`,
        })),
      },
    ],
    not: 'Tamuso admin ciro belgesi. Gerçek ödeme sağlayıcı mutabakatı ayrıca kontrol edilmelidir.',
  };
}

/** Belge donusumu icin hareket detayi (UI tipinden bagimsiz) */
export type BelgeCuzdanHareketGirdi =
  | { tur: 'ledger'; veri: LedgerSatiri }
  | { tur: 'hediye'; veri: HediyeGecmisiKaydi }
  | {
      tur: 'cekim';
      veri: {
        id: string;
        diamonds: number;
        status: string;
        method: string;
        created_at: string;
      };
      durumEtiket: string;
    };

/** Admin özet raporu */
export function AdminOzetBelgesiOlustur(ozet: AdminOzet | null): BelgeIcerik {
  const p = ozet?.platform;
  return {
    baslik: 'Yönetim özeti',
    altBaslik: 'Tamuso platform kontrol raporu',
    platformAdi: 'Tamuso',
    ozet:
      'Anlık durum — kullanıcılar, finans, canlı, moderasyon ve özellik bayrakları.',
    satirlar: [
      { etiket: 'Canlı oda', deger: String(ozet?.liveRooms ?? 0) },
      { etiket: 'Canlı PK', deger: String(ozet?.livePk ?? 0) },
      { etiket: 'Push kuyruk', deger: String(ozet?.pendingOutbox ?? 0) },
      { etiket: 'Açık rapor', deger: String(ozet?.openReports ?? 0) },
    ],
    bolumler: p
      ? [
          {
            baslik: 'Kullanıcılar',
            satirlar: [
              { etiket: 'Toplam', deger: String(p.kullanici.toplam) },
              { etiket: 'Banlı', deger: String(p.kullanici.banli) },
              { etiket: 'Host', deger: String(p.kullanici.host) },
              { etiket: 'Son 24s yeni', deger: String(p.kullanici.son_24s) },
            ],
          },
          {
            baslik: 'Finans',
            satirlar: [
              {
                etiket: 'Toplam yükleme coin',
                deger: String(p.finans.toplam_yukleme_coin),
              },
              {
                etiket: 'Son 24s yükleme',
                deger: String(p.finans.son_24s_yukleme_coin),
              },
              {
                etiket: 'Bekleyen çekim',
                deger: String(p.finans.bekleyen_cekim),
              },
              {
                etiket: 'Bekleyen elmas',
                deger: String(p.finans.bekleyen_cekim_elmas),
              },
            ],
          },
          {
            baslik: 'Sosyal / güvenlik',
            satirlar: [
              { etiket: 'Açık rapor', deger: String(p.sosyal.acik_rapor) },
              { etiket: 'Aktif ihtar', deger: String(p.sosyal.aktif_ihtar) },
              { etiket: 'Hediye 24s', deger: String(p.sosyal.hediye_24s) },
              {
                etiket: 'Kapalı özellik',
                deger: String(p.bayrak.kapali_ozellik),
              },
              {
                etiket: 'Aktif kill switch',
                deger: String(p.bayrak.aktif_kill),
              },
            ],
          },
        ]
      : undefined,
    not: 'Bu belge Tamuso yönetim panelinden oluşturulmuştur.',
  };
}

/** Cüzdan hareket / hediye / çekim → belge (Türkçe, anlaşılır) */
export function CuzdanHareketBelgesiOlustur(
  detay: BelgeCuzdanHareketGirdi,
): BelgeIcerik {
  if (detay.tur === 'ledger') {
    const r: LedgerSatiri = detay.veri;
    const tarih = new Date(r.created_at);
    return {
      baslik: 'Cüzdan dekontu',
      altBaslik: LedgerAnlasilirOzet(r),
      platformAdi: 'Tamuso',
      ozet: LedgerTutarYazi(r),
      satirlar: [
        { etiket: 'İşlem', deger: LedgerSebepEtiketi(r.reason) },
        { etiket: 'Açıklama', deger: LedgerAnlasilirOzet(r) },
        { etiket: 'Tutar', deger: LedgerTutarYazi(r) },
        { etiket: 'Birim', deger: LedgerBirimEtiketi(r.currency) },
        {
          etiket: 'İşlem sonrası bakiye',
          deger: `${r.balance_after.toLocaleString('tr-TR')} ${LedgerBirimEtiketi(r.currency)}`,
        },
        { etiket: 'Kaynak', deger: LedgerRefEtiketi(r.ref_type) },
        {
          etiket: 'Tarih',
          deger: tarih.toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }),
        },
        {
          etiket: 'Saat',
          deger: tarih.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        { etiket: 'İşlem no', deger: r.id.slice(0, 13).toUpperCase() },
      ],
      not: 'Tamuso cüzdan hareket belgesi.',
    };
  }

  if (detay.tur === 'hediye') {
    const h: HediyeGecmisiKaydi = detay.veri;
    const kim =
      h.karsi_profil?.display_name ??
      h.karsi_profil?.username ??
      'Kullanıcı';
    const tarih = new Date(h.created_at);
    const gonderildi = h.yon === 'gonderilen';
    return {
      baslik: 'Hediye belgesi',
      altBaslik: h.gift?.name ?? 'Hediye',
      platformAdi: 'Tamuso',
      ozet: gonderildi ? `Gönderildi → ${kim}` : `Alındı ← ${kim}`,
      satirlar: [
        {
          etiket: 'Hediye',
          deger: `${h.gift?.emoji ?? ''} ${h.gift?.name ?? '—'}`.trim(),
        },
        { etiket: 'Adet', deger: String(h.quantity) },
        {
          etiket: 'Yön',
          deger: gonderildi ? 'Gönderildi' : 'Alındı',
        },
        {
          etiket: gonderildi ? 'Alıcı' : 'Gönderen',
          deger: kim,
        },
        { etiket: 'Oda', deger: h.oda?.title ?? '—' },
        {
          etiket: 'Harcanan coin',
          deger: h.coins_spent.toLocaleString('tr-TR'),
        },
        {
          etiket: 'Kazanılan elmas',
          deger: h.diamonds_earned.toLocaleString('tr-TR'),
        },
        {
          etiket: 'Tarih',
          deger: tarih.toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          }),
        },
        {
          etiket: 'Saat',
          deger: tarih.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
        { etiket: 'İşlem no', deger: h.id.slice(0, 13).toUpperCase() },
      ],
      not: 'Tamuso hediye işlem belgesi.',
    };
  }

  const c = detay.veri;
  const tarih = new Date(c.created_at);
  return {
    baslik: 'Çekim talebi',
    altBaslik: detay.durumEtiket,
    platformAdi: 'Tamuso',
    ozet: `${c.diamonds.toLocaleString('tr-TR')} elmas · ${c.method}`,
    satirlar: [
      {
        etiket: 'Miktar',
        deger: `${c.diamonds.toLocaleString('tr-TR')} elmas`,
      },
      { etiket: 'Yöntem', deger: c.method },
      { etiket: 'Durum', deger: detay.durumEtiket },
      { etiket: 'Ödeme süresi', deger: CEKIM_ODEME_BILGISI },
      {
        etiket: 'Tarih',
        deger: tarih.toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      },
      {
        etiket: 'Saat',
        deger: tarih.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      { etiket: 'Talep no', deger: c.id.slice(0, 13).toUpperCase() },
    ],
    not: CEKIM_ODEME_BILGISI,
  };
}
