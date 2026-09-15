import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import {
  LedgerSebepEtiketi,
  type LedgerSatiri,
} from '../okuma/CuzdanLedgeriniGetir';
import type { HediyeGecmisiKaydi } from '../../hediyeler/okuma/HediyeGecmisiniGetir';
import { CEKIM_ODEME_BILGISI } from '../cekim/CekimOdemeBilgisi';
import {
  BelgePaylasDugmesi,
  BelgePaylasimPaneli,
} from '../../belge-paylasim/bilesenler/BelgePaylasimPaneli';
import { CuzdanHareketBelgesiOlustur } from '../../belge-paylasim/BelgeIcerikDonustur';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type CuzdanHareketDetay =
  | { tur: 'ledger'; veri: LedgerSatiri }
  | {
      tur: 'hediye';
      veri: HediyeGecmisiKaydi;
    }
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

type Props = {
  detay: CuzdanHareketDetay | null;
  onKapat: () => void;
};

function formatTarih(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={styles.satir}>
      <Text style={styles.satirEtiket}>{etiket}</Text>
      <Text style={styles.satirDeger}>{deger}</Text>
    </View>
  );
}

/** Hareket detay kartı — banka dekontu + PDF/WhatsApp */
export function CuzdanHareketDetayKarti({ detay, onKapat }: Props) {
  const [paylasAcik, setPaylasAcik] = useState(false);

  const belge = useMemo(
    () => (detay ? CuzdanHareketBelgesiOlustur(detay) : null),
    [detay],
  );

  if (!detay) return null;

  let baslik = 'Hareket detayı';
  let tutar = '';
  let tutarRenk: string = RenkTokenlari.text;
  let ozet: { etiket: string; deger: string }[] = [];

  if (detay.tur === 'ledger') {
    const r = detay.veri;
    const pozitif = r.delta >= 0;
    baslik = LedgerSebepEtiketi(r.reason);
    tutar = `${pozitif ? '+' : ''}${r.delta.toLocaleString('tr-TR')} ${r.currency === 'diamonds' || r.currency === 'diamond' ? 'elmas' : 'coin'}`;
    tutarRenk = pozitif ? RenkTokenlari.mint : RenkTokenlari.danger;
    ozet = [
      { etiket: 'İşlem türü', deger: baslik },
      { etiket: 'Para birimi', deger: r.currency },
      { etiket: 'Tutar', deger: tutar },
      { etiket: 'İşlem sonrası bakiye', deger: r.balance_after.toLocaleString('tr-TR') },
      { etiket: 'Referans', deger: r.ref_type ?? '—' },
      { etiket: 'Tarih', deger: formatTarih(r.created_at) },
      { etiket: 'İşlem no', deger: r.id.slice(0, 13).toUpperCase() },
    ];
  } else if (detay.tur === 'hediye') {
    const h = detay.veri;
    const gonderildi = h.yon === 'gonderilen';
    const kim =
      h.karsi_profil?.display_name ??
      h.karsi_profil?.username ??
      'Kullanıcı';
    baslik = h.gift?.name ?? 'Hediye';
    tutar = gonderildi
      ? `−${h.coins_spent.toLocaleString('tr-TR')} coin`
      : `+${h.diamonds_earned.toLocaleString('tr-TR')} elmas`;
    tutarRenk = gonderildi ? RenkTokenlari.danger : RenkTokenlari.mint;
    ozet = [
      { etiket: 'Hediye', deger: `${baslik}${h.quantity > 1 ? ` ×${h.quantity}` : ''}` },
      { etiket: 'Yön', deger: gonderildi ? 'Gönderildi' : 'Alındı' },
      { etiket: gonderildi ? 'Alıcı' : 'Gönderen', deger: kim },
      { etiket: 'Oda', deger: h.oda?.title ?? '—' },
      { etiket: 'Tutar', deger: tutar },
      { etiket: 'Tarih', deger: formatTarih(h.created_at) },
      { etiket: 'İşlem no', deger: h.id.slice(0, 13).toUpperCase() },
    ];
  } else {
    const c = detay.veri;
    baslik = 'Elmas çekimi';
    tutar = `−${c.diamonds.toLocaleString('tr-TR')} elmas`;
    tutarRenk = RenkTokenlari.accent;
    ozet = [
      { etiket: 'İşlem', deger: 'Çekim talebi' },
      { etiket: 'Miktar', deger: tutar },
      { etiket: 'Yöntem', deger: c.method },
      { etiket: 'Durum', deger: detay.durumEtiket },
      { etiket: 'Ödeme süresi', deger: CEKIM_ODEME_BILGISI },
      { etiket: 'Tarih', deger: formatTarih(c.created_at) },
      { etiket: 'Talep no', deger: c.id.slice(0, 13).toUpperCase() },
    ];
  }

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={onKapat}>
        <View style={styles.kok}>
          <Pressable style={styles.perde} onPress={onKapat} />
          <CamArkaplan
            intensity={28}
            tint="dark"
            style={StyleSheet.absoluteFill}
            fallbackColor="rgba(0,0,0,0.55)"
            pointerEvents="none"
          />
          <View style={styles.kartWrap}>
            <LinearGradient colors={['#2A1C34', '#16101F']} style={styles.kart}>
              <View style={styles.ust}>
                <Text style={styles.fisilti}>İŞLEM DEKONTU</Text>
                <Pressable onPress={onKapat} style={styles.kapat} hitSlop={8}>
                  <Ionicons name="close" size={18} color={RenkTokenlari.text} />
                </Pressable>
              </View>

              <Text style={styles.baslik}>{baslik}</Text>
              <Text style={[styles.tutar, { color: tutarRenk }]}>{tutar}</Text>

              <View style={styles.liste}>
                {ozet.map((s) => (
                  <Satir key={s.etiket} etiket={s.etiket} deger={s.deger} />
                ))}
              </View>

              <View style={styles.aksiyonlar}>
                <BelgePaylasDugmesi
                  onPress={() => setPaylasAcik(true)}
                  label="PDF / WhatsApp"
                />
                <Pressable onPress={onKapat} style={styles.tamamHit}>
                  <Text style={styles.tamamYazi}>Kapat</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      <BelgePaylasimPaneli
        visible={paylasAcik}
        onKapat={() => setPaylasAcik(false)}
        icerik={belge}
      />
    </>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: BoslukTokenlari.xl,
  },
  perde: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    elevation: 1,
  },
  kartWrap: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    zIndex: 3,
    elevation: 24,
  },
  kart: {
    padding: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.4,
  },
  kapat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
  },
  tutar: {
    ...TipografiTokenlari.title,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  liste: {
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
    marginTop: BoslukTokenlari.sm,
  },
  satir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  satirEtiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  satirDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  aksiyonlar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.md,
    marginTop: BoslukTokenlari.sm,
  },
  tamamHit: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  tamamYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
});
