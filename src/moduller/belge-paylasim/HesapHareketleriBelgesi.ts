/**
 * Kullanıcı hesap hareketleri — PDF / Excel / WhatsApp için Türkçe belge.
 * Kod değil; tarih, saat, karşı taraf, oyun, yükleme, kazanç/kayıp okunaklı yazılır.
 */

import type { BelgeIcerik, BelgeSatiri } from './BelgeSablonlari';
import {
  LedgerAnlasilirOzet,
  LedgerBirimEtiketi,
  LedgerTutarYazi,
  type LedgerSatiri,
} from '../cuzdan/okuma/CuzdanLedgeriniGetir';
import type { HediyeGecmisiKaydi } from '../hediyeler/okuma/HediyeGecmisiniGetir';
import {
  OyunDurumEtiketi,
  OyunSiraYazi,
  type OyunGecmisiKaydi,
} from '../oyunlar/ortak/servisler/OyunGecmisiniGetir';
import type { OyunOyuncuIstatistik } from '../oyunlar/ortak/servisler/OyunIstatistikServisi';
import { CEKIM_ODEME_BILGISI } from '../cuzdan/cekim/CekimOdemeBilgisi';

export type HesapCekimSatiri = {
  id: string;
  diamonds: number;
  status: string;
  method: string;
  created_at: string;
  durumEtiket: string;
};

export type HesapHareketleriBelgeGirdi = {
  sahipAdi?: string | null;
  hesapKodu?: string | null;
  coins?: number;
  diamonds?: number;
  ledger: LedgerSatiri[];
  hediyeler: HediyeGecmisiKaydi[];
  cekimler: HesapCekimSatiri[];
  oyunlar?: OyunGecmisiKaydi[];
  oyunOzet?: OyunOyuncuIstatistik | null;
};

/** Excel / CSV satırı — tamamen Türkçe sütunlar */
export type HesapHareketExcelSatiri = {
  tarih: string;
  saat: string;
  islem: string;
  aciklama: string;
  karsiTaraf: string;
  yer: string;
  tutar: string;
  birim: string;
  bakiyeSonrasi: string;
  durum: string;
  islemNo: string;
};

function tarihParcala(iso: string): { tarih: string; saat: string; tam: string } {
  try {
    const d = new Date(iso);
    return {
      tarih: d.toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      saat: d.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      tam: d.toLocaleString('tr-TR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  } catch {
    return { tarih: iso, saat: '—', tam: iso };
  }
}

function hediyeKim(h: HediyeGecmisiKaydi): string {
  return (
    h.karsi_profil?.display_name ??
    h.karsi_profil?.username ??
    'Kullanıcı'
  );
}

/** Tüm kaynaklardan Excel satırları (kronolojik, yeni → eski) */
export function HesapHareketExcelSatirlari(
  girdi: HesapHareketleriBelgeGirdi,
): HesapHareketExcelSatiri[] {
  const satirlar: (HesapHareketExcelSatiri & { _ts: number })[] = [];
  const hediyeVar = girdi.hediyeler.length > 0;
  const cekimVar = girdi.cekimler.length > 0;

  for (const r of girdi.ledger) {
    const kok = r.reason.split(':')[0] ?? r.reason;
    // Hediye / çekim zaten ayrı satırlarda (karşı taraf + durum ile) — çift yazma
    if (
      hediyeVar &&
      (kok.startsWith('gift_') || kok === 'gift_sent' || kok === 'gift_received')
    ) {
      continue;
    }
    if (
      cekimVar &&
      (kok.startsWith('withdraw') || kok === 'withdrawal_hold')
    ) {
      continue;
    }
    const t = tarihParcala(r.created_at);
    satirlar.push({
      _ts: new Date(r.created_at).getTime(),
      tarih: t.tarih,
      saat: t.saat,
      islem: LedgerAnlasilirOzet(r),
      aciklama:
        r.delta >= 0
          ? 'Hesaba giriş / kazanç'
          : 'Hesaptan çıkış / harcama',
      karsiTaraf: '—',
      yer: '—',
      tutar: `${r.delta >= 0 ? '+' : ''}${r.delta.toLocaleString('tr-TR')}`,
      birim: LedgerBirimEtiketi(r.currency),
      bakiyeSonrasi: r.balance_after.toLocaleString('tr-TR'),
      durum: r.delta >= 0 ? 'Kazanç / yükleme' : 'Harcama / kayıp',
      islemNo: r.id.slice(0, 13).toUpperCase(),
    });
  }

  for (const h of girdi.hediyeler) {
    const t = tarihParcala(h.created_at);
    const gonderildi = h.yon === 'gonderilen';
    const hediyeAd = `${h.gift?.emoji ?? '🎁'} ${h.gift?.name ?? 'Hediye'}${
      h.quantity > 1 ? ` ×${h.quantity}` : ''
    }`;
    satirlar.push({
      _ts: new Date(h.created_at).getTime(),
      tarih: t.tarih,
      saat: t.saat,
      islem: gonderildi ? 'Hediye gönderildi' : 'Hediye alındı',
      aciklama: hediyeAd,
      karsiTaraf: hediyeKim(h),
      yer: h.oda?.title ?? '—',
      tutar: gonderildi
        ? `−${h.coins_spent.toLocaleString('tr-TR')}`
        : `+${h.diamonds_earned.toLocaleString('tr-TR')}`,
      birim: gonderildi ? 'coin' : 'elmas',
      bakiyeSonrasi: '—',
      durum: gonderildi ? 'Gönderildi' : 'Alındı',
      islemNo: h.id.slice(0, 13).toUpperCase(),
    });
  }

  for (const c of girdi.cekimler) {
    const t = tarihParcala(c.created_at);
    satirlar.push({
      _ts: new Date(c.created_at).getTime(),
      tarih: t.tarih,
      saat: t.saat,
      islem: 'Elmas çekim talebi',
      aciklama: `Banka / ${c.method}`,
      karsiTaraf: '—',
      yer: '—',
      tutar: `−${c.diamonds.toLocaleString('tr-TR')}`,
      birim: 'elmas',
      bakiyeSonrasi: '—',
      durum: c.durumEtiket,
      islemNo: c.id.slice(0, 13).toUpperCase(),
    });
  }

  for (const o of girdi.oyunlar ?? []) {
    const t = tarihParcala(o.baslangic);
    const kazancMi = o.sira === 1 || o.coinOdul > 0;
    satirlar.push({
      _ts: new Date(o.baslangic).getTime(),
      tarih: t.tarih,
      saat: t.saat,
      islem: `Oyun: ${o.oyunAdi}`,
      aciklama: `Sıra ${OyunSiraYazi(o.sira)} · XP ${o.xp.toLocaleString('tr-TR')} · Kupa ${o.kupa >= 0 ? '+' : ''}${o.kupa}`,
      karsiTaraf: '—',
      yer: o.odaBaslik ?? '—',
      tutar:
        o.coinOdul !== 0
          ? `${o.coinOdul >= 0 ? '+' : ''}${o.coinOdul.toLocaleString('tr-TR')}`
          : '—',
      birim: o.coinOdul !== 0 ? 'coin' : '—',
      bakiyeSonrasi: '—',
      durum: `${OyunDurumEtiketi(o.durum)}${kazancMi ? ' · kazanç' : ''}`,
      islemNo: o.session_id.slice(0, 13).toUpperCase(),
    });
  }

  return satirlar
    .sort((a, b) => b._ts - a._ts)
    .map((row) => {
      const { _ts, ...rest } = row;
      void _ts;
      return rest;
    });
}

/** Excel'in açtığı CSV (UTF-8 BOM + ; ayırıcı — TR Excel) */
export function HesapHareketExcelCsvOlustur(
  girdi: HesapHareketleriBelgeGirdi,
): string {
  const basliklar = [
    'Tarih',
    'Saat',
    'İşlem',
    'Açıklama',
    'Karşı taraf',
    'Oda / Yer',
    'Tutar',
    'Birim',
    'Bakiye sonrası',
    'Durum',
    'İşlem no',
  ];
  const hucre = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const satirlar = HesapHareketExcelSatirlari(girdi).map((s) =>
    [
      s.tarih,
      s.saat,
      s.islem,
      s.aciklama,
      s.karsiTaraf,
      s.yer,
      s.tutar,
      s.birim,
      s.bakiyeSonrasi,
      s.durum,
      s.islemNo,
    ]
      .map(hucre)
      .join(';'),
  );
  return `\uFEFF${basliklar.map(hucre).join(';')}\n${satirlar.join('\n')}`;
}

export function HesapHareketleriBelgesiOlustur(
  girdi: HesapHareketleriBelgeGirdi,
): BelgeIcerik {
  const ad = girdi.sahipAdi?.trim() || 'Kullanıcı';
  const kod = girdi.hesapKodu?.trim();
  const excel = HesapHareketExcelSatirlari(girdi);
  const yukleme = girdi.ledger.filter(
    (r) =>
      r.delta > 0 &&
      (r.reason.includes('purchase') ||
        r.reason.includes('iap') ||
        r.reason.includes('stripe') ||
        r.reason.includes('topup') ||
        r.reason.includes('bonus')),
  ).length;
  const oyunKazanc = girdi.ledger.filter(
    (r) =>
      r.delta > 0 &&
      (r.reason.startsWith('game_reward') ||
        r.reason.startsWith('kaskad_win') ||
        r.reason.startsWith('zeus_win')),
  ).length;
  const oyunKayip = girdi.ledger.filter(
    (r) =>
      r.delta < 0 &&
      (r.reason.startsWith('game_entry') ||
        r.reason.startsWith('kaskad_bet') ||
        r.reason.startsWith('zeus_bet')),
  ).length;

  const ozetSatirlar: BelgeSatiri[] = [
    { etiket: 'Hesap sahibi', deger: ad },
    ...(kod ? [{ etiket: 'Hesap kodu', deger: kod }] : []),
    {
      etiket: 'Güncel coin',
      deger: (girdi.coins ?? 0).toLocaleString('tr-TR'),
    },
    {
      etiket: 'Güncel elmas',
      deger: (girdi.diamonds ?? 0).toLocaleString('tr-TR'),
    },
    {
      etiket: 'Toplam kayıt',
      deger: `${excel.length} satır`,
    },
    {
      etiket: 'Yükleme işlemi',
      deger: String(yukleme),
    },
    {
      etiket: 'Oyun bahis / giriş',
      deger: String(oyunKayip),
    },
    {
      etiket: 'Oyun kazanç / ödül',
      deger: String(oyunKazanc),
    },
    {
      etiket: 'Rapor zamanı',
      deger: new Date().toLocaleString('tr-TR'),
    },
  ];

  if (girdi.oyunOzet) {
    const o = girdi.oyunOzet;
    ozetSatirlar.push(
      {
        etiket: 'Oynanan oyun',
        deger: String(o.totalGames),
      },
      {
        etiket: 'Birincilik (kazanç)',
        deger: String(o.wins),
      },
      {
        etiket: 'Kazanma oranı',
        deger: `%${o.winRate}`,
      },
      {
        etiket: 'Lig',
        deger: o.leagueLabel,
      },
    );
  }

  const hareketBolumu: BelgeSatiri[] = girdi.ledger.slice(0, 120).map((r) => {
    const t = tarihParcala(r.created_at);
    return {
      etiket: `${t.tam} · ${LedgerAnlasilirOzet(r)}`,
      deger: `${LedgerTutarYazi(r)} → bakiye ${r.balance_after.toLocaleString('tr-TR')}`,
    };
  });

  const hediyeBolumu: BelgeSatiri[] = girdi.hediyeler.slice(0, 80).map((h) => {
    const t = tarihParcala(h.created_at);
    const gonderildi = h.yon === 'gonderilen';
    const kim = hediyeKim(h);
    const hediye = `${h.gift?.name ?? 'Hediye'}${h.quantity > 1 ? ` ×${h.quantity}` : ''}`;
    return {
      etiket: `${t.tam} · ${gonderildi ? `${hediye} → ${kim}` : `${hediye} ← ${kim}`}`,
      deger: gonderildi
        ? `−${h.coins_spent.toLocaleString('tr-TR')} coin${h.oda?.title ? ` · ${h.oda.title}` : ''}`
        : `+${h.diamonds_earned.toLocaleString('tr-TR')} elmas${h.oda?.title ? ` · ${h.oda.title}` : ''}`,
    };
  });

  const oyunBolumu: BelgeSatiri[] = (girdi.oyunlar ?? []).slice(0, 80).map((o) => {
    const t = tarihParcala(o.baslangic);
    return {
      etiket: `${t.tam} · ${o.oyunAdi}${o.odaBaslik ? ` · ${o.odaBaslik}` : ''}`,
      deger: `Sıra ${OyunSiraYazi(o.sira)} · ${OyunDurumEtiketi(o.durum)} · ödül ${o.coinOdul.toLocaleString('tr-TR')} coin · XP ${o.xp}`,
    };
  });

  const cekimBolumu: BelgeSatiri[] = girdi.cekimler.slice(0, 40).map((c) => {
    const t = tarihParcala(c.created_at);
    return {
      etiket: `${t.tam} · ${c.diamonds.toLocaleString('tr-TR')} elmas`,
      deger: `${c.durumEtiket} · ${c.method}`,
    };
  });

  return {
    baslik: 'Hesap hareketleri',
    altBaslik: `${ad}${kod ? ` · ${kod}` : ''} · Tamuso`,
    platformAdi: 'Tamuso',
    ozet:
      'Tüm cüzdan, hediye, oyun ve çekim işlemlerinizin Türkçe özeti. Tarih, saat, tutar ve karşı taraf bilgileri aşağıdadır.',
    satirlar: ozetSatirlar,
    bolumler: [
      {
        baslik: 'Cüzdan hareketleri',
        ozet: `${girdi.ledger.length} kayıt — yükleme, hediye, oyun bahsi / kazancı, çekim`,
        satirlar: hareketBolumu.length
          ? hareketBolumu
          : [{ etiket: 'Durum', deger: 'Henüz cüzdan hareketi yok' }],
      },
      {
        baslik: 'Hediye etkileşimleri',
        ozet: `${girdi.hediyeler.length} kayıt — kime / kimden`,
        satirlar: hediyeBolumu.length
          ? hediyeBolumu
          : [{ etiket: 'Durum', deger: 'Henüz hediye yok' }],
      },
      {
        baslik: 'Oyun geçmişi',
        ozet: `${girdi.oyunlar?.length ?? 0} oturum — sıra, kazanç, ödül`,
        satirlar: oyunBolumu.length
          ? oyunBolumu
          : [{ etiket: 'Durum', deger: 'Henüz oyun kaydı yok' }],
      },
      {
        baslik: 'Çekim talepleri',
        ozet: `${girdi.cekimler.length} talep`,
        satirlar: cekimBolumu.length
          ? cekimBolumu
          : [{ etiket: 'Durum', deger: 'Henüz çekim talebi yok' }],
      },
    ],
    not: `Bu belge hesabınızdaki işlemlere dayanır. ${CEKIM_ODEME_BILGISI}`,
  };
}
