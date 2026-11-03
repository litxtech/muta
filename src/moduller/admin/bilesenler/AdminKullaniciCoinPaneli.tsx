import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { AdminStil, SayiKisa } from './AdminStil';
import {
  AdminCoinIslemEtiketi,
  AdminCoinKovaAdi,
  AdminKullaniciCoinIsle,
  type AdminCoinIslem,
  type AdminCoinKovasi,
} from '../kullanici/islemler/AdminKullaniciCoinIsle';
import {
  AdminKullaniciCuzdanOzetiGetir,
  CuzdanSayi,
  type AdminCuzdanOzeti,
} from '../kullanici/okuma/AdminKullaniciCuzdanOzeti';
import {
  AdminKullaniciOneri,
  OneriAdi,
  type AdminKullaniciOneriSatiri,
} from '../kullanici/okuma/AdminKullaniciOneri';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

const HIZLI = [1_000, 5_000, 10_000, 50_000, 100_000] as const;

type SeciliKullanici = AdminKullaniciOneriSatiri;

/** Onay bekleyen işlem. Onay panelin içinde sorulur: web'de hiçbir düğme
 *  sessiz kalmaz, kullanıcı her adımda görünür geri bildirim alır. */
type Onay = { islem: AdminCoinIslem; kova: AdminCoinKovasi; miktar: number };

type Durum = { tur: 'ok' | 'hata'; yazi: string };

type Props = {
  /** Sabit kullanıcı (dosya ekranı); boşsa arama alanı gösterilir */
  userRef?: string;
  baslik?: string;
  alt?: string;
  onBasarili?: (balanceAfter: number) => void;
};

/** İşlemin gerçekten yazılacağı kova. Satın alınan kovaya admin eklemesi
 *  yapılmaz: kredi ödül kovasına yazılır (sunucu da aynı kuralı uygular). */
function EtkinKova(islem: AdminCoinIslem, kova: AdminCoinKovasi): AdminCoinKovasi {
  if (islem === 'topup' && kova === 'coins') return 'bonus_coins';
  return kova;
}

function Avatar({
  url,
  ad,
  size = 36,
}: {
  url?: string | null;
  ad: string;
  size?: number;
}) {
  const harf = (ad.trim() || '?').charAt(0).toLocaleUpperCase('tr-TR');
  const safe = MedyaUriGuvenli(url);
  if (safe) {
    return (
      <Image
        source={{ uri: safe }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: RenkTokenlari.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: RenkTokenlari.border,
      }}
    >
      <Text
        style={{
          color: RenkTokenlari.textMuted,
          fontWeight: '800',
          fontSize: size * 0.38,
        }}
      >
        {harf}
      </Text>
    </View>
  );
}

export function AdminKullaniciCoinPaneli({
  userRef: sabitRef,
  baslik = 'Coin işlemleri',
  alt = 'İsim yaz · seç · ödül coin / coin ekle · eksilt',
  onBasarili,
}: Props) {
  const [arama, setArama] = useState('');
  const [oneriler, setOneriler] = useState<AdminKullaniciOneriSatiri[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [secili, setSecili] = useState<SeciliKullanici | null>(null);
  const [miktar, setMiktar] = useState('1000');
  const [not, setNot] = useState('');
  const [busy, setBusy] = useState(false);
  const [onay, setOnay] = useState<Onay | null>(null);
  const [durum, setDurum] = useState<Durum | null>(null);
  const [ozet, setOzet] = useState<AdminCuzdanOzeti | null>(null);
  const [ozetYukleniyor, setOzetYukleniyor] = useState(false);
  const [ozetHata, setOzetHata] = useState<string | null>(null);
  const aramaSeq = useRef(0);
  const ozetSeq = useRef(0);

  useEffect(() => {
    if (sabitRef) return;
    if (secili) {
      setOneriler([]);
      setAraniyor(false);
      return;
    }
    const q = arama.trim();
    if (q.length < 1) {
      setOneriler([]);
      setAraniyor(false);
      return;
    }

    const seq = ++aramaSeq.current;
    setAraniyor(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const rows = await AdminKullaniciOneri(q, 8);
          if (seq !== aramaSeq.current) return;
          setOneriler(rows);
        } catch {
          if (seq !== aramaSeq.current) return;
          setOneriler([]);
        } finally {
          if (seq === aramaSeq.current) setAraniyor(false);
        }
      })();
    }, 160);

    return () => clearTimeout(t);
  }, [arama, secili, sabitRef]);

  const hedef = sabitRef?.trim() || secili?.id || '';

  const ozetYukle = useCallback(async (ref: string) => {
    const seq = ++ozetSeq.current;
    if (!ref) {
      setOzet(null);
      setOzetHata(null);
      setOzetYukleniyor(false);
      return;
    }
    setOzetYukleniyor(true);
    setOzetHata(null);
    try {
      const o = await AdminKullaniciCuzdanOzetiGetir(ref);
      if (seq !== ozetSeq.current) return;
      setOzet(o);
      if (!o) setOzetHata('Cüzdan okunamadı');
    } catch (e) {
      if (seq !== ozetSeq.current) return;
      setOzet(null);
      setOzetHata(
        e instanceof Error && e.message ? e.message : 'Bakiye okunamadı',
      );
    } finally {
      if (seq === ozetSeq.current) setOzetYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void ozetYukle(hedef);
  }, [hedef, ozetYukle]);

  const temizleSecim = () => {
    setSecili(null);
    setArama('');
    setOneriler([]);
    setOzet(null);
    setOzetHata(null);
  };

  const kovaMevcut = (kova: AdminCoinKovasi): number => {
    if (!ozet) return 0;
    return kova === 'bonus_coins' ? ozet.bonus_coins : ozet.coins;
  };

  const uygula = (islem: AdminCoinIslem, kova: AdminCoinKovasi) => {
    if (busy) return;
    const n = Math.floor(Number(miktar));
    if (!hedef) {
      setDurum({ tur: 'hata', yazi: 'Önce kullanıcı seç.' });
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setDurum({ tur: 'hata', yazi: 'Pozitif miktar gir.' });
      return;
    }
    if (islem === 'penalty' && !not.trim()) {
      setDurum({ tur: 'hata', yazi: 'Ceza için kısa bir sebep yaz.' });
      return;
    }
    if (islem !== 'topup' && ozet) {
      const mevcut = kovaMevcut(EtkinKova(islem, kova));
      if (mevcut <= 0) {
        setDurum({
          tur: 'hata',
          yazi: `${AdminCoinKovaAdi(kova)} bakiyesi 0 — eksiltilecek bakiye yok.`,
        });
        return;
      }
    }

    setDurum(null);
    setOnay({ islem, kova, miktar: n });
  };

  const calistir = async (o: Onay) => {
    setOnay(null);
    setDurum(null);
    setBusy(true);
    try {
      const r = await AdminKullaniciCoinIsle({
        userRef: hedef,
        islem: o.islem,
        kova: o.kova,
        miktar: o.miktar,
        not: not.trim() || undefined,
      });
      if (!r.ok) {
        setDurum({ tur: 'hata', yazi: r.hata });
        return;
      }

      const isaret = r.islem === 'topup' ? '+' : '\u2212';
      const parcalar = [
        `${r.display_name ?? 'Kullanıcı'} · ${AdminCoinKovaAdi(r.kova)} ${isaret}${CuzdanSayi(r.applied)}`,
        `coin ${CuzdanSayi(r.coins)}`,
        `ödül ${CuzdanSayi(r.bonus_coins)}`,
      ];
      if (r.shortfall > 0) {
        parcalar.push(`${CuzdanSayi(r.shortfall)} bakiye yetersizdi`);
      }
      if (r.kova_degisti) {
        parcalar.push('satın alınan kovaya ekleme yapılmaz, ödül kovasına yazıldı');
      }

      setDurum({ tur: 'ok', yazi: parcalar.join(' · ') });
      setNot('');
      setOzet((onceki) =>
        onceki
          ? {
              ...onceki,
              coins: r.coins,
              bonus_coins: r.bonus_coins,
              game_coins: r.game_coins,
              total_coins: r.coins + r.bonus_coins + r.game_coins,
            }
          : onceki,
      );
      onBasarili?.(r.balance_after);
    } catch (e) {
      setDurum({
        tur: 'hata',
        yazi:
          e instanceof Error && e.message
            ? e.message
            : 'İşlem gönderilemedi. Bağlantını kontrol edip tekrar dene.',
      });
    } finally {
      // Hata olsa da düğmeler kilitli kalmasın.
      setBusy(false);
    }
  };

  /** Onay kutusunda gösterilecek mevcut → sonraki bakiye hesabı. */
  const onayHesap = (o: Onay) => {
    const hedefKova = EtkinKova(o.islem, o.kova);
    const mevcut = kovaMevcut(hedefKova);
    const uygulanacak =
      o.islem === 'topup' || !ozet ? o.miktar : Math.min(o.miktar, mevcut);
    const eksik = o.islem === 'topup' || !ozet ? 0 : o.miktar - uygulanacak;
    const isaret = o.islem === 'topup' ? 1 : -1;
    const coinsAfter =
      (ozet?.coins ?? 0) + (hedefKova === 'coins' ? isaret * uygulanacak : 0);
    const bonusAfter =
      (ozet?.bonus_coins ?? 0) +
      (hedefKova === 'bonus_coins' ? isaret * uygulanacak : 0);
    return {
      hedefKova,
      mevcut,
      uygulanacak,
      eksik,
      coinsAfter,
      bonusAfter,
      yonlendirildi: hedefKova !== o.kova,
    };
  };

  const bakiyeKartlari: {
    etiket: string;
    deger: number | null;
    renk: string;
    ipucu: string;
  }[] = [
    {
      etiket: 'Coin',
      deger: ozet ? ozet.coins : null,
      renk: RenkTokenlari.mint,
      ipucu: 'satın alınan',
    },
    {
      etiket: 'Ödül coin',
      deger: ozet ? ozet.bonus_coins : null,
      renk: RenkTokenlari.accent,
      ipucu: 'admin / bonus',
    },
    {
      etiket: 'Oyun coin',
      deger: ozet ? ozet.game_coins : null,
      renk: RenkTokenlari.primarySoft,
      ipucu: 'oyunlardan',
    },
  ];

  return (
    <View style={styles.kart}>
      <Text style={AdminStil.kartBaslik}>{baslik}</Text>
      <Text style={AdminStil.kartAlt}>{alt}</Text>

      {sabitRef ? null : (
        <View style={styles.aramaBolum}>
          {secili ? (
            <View style={styles.oneriListe}>
              <View style={styles.kisiSatir}>
                <Avatar url={secili.avatar_url} ad={OneriAdi(secili)} size={40} />
                <Text style={styles.kisiAd} numberOfLines={1}>
                  {OneriAdi(secili)}
                </Text>
                <Pressable onPress={temizleSecim} hitSlop={10} disabled={busy}>
                  <Ionicons
                    name="close"
                    size={18}
                    color={RenkTokenlari.textDim}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.aramaKutu}>
                <Ionicons
                  name="search"
                  size={16}
                  color={RenkTokenlari.textDim}
                />
                <TextInput
                  style={styles.aramaInput}
                  placeholder="İsim yaz…"
                  placeholderTextColor={RenkTokenlari.textDim}
                  value={arama}
                  onChangeText={setArama}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  editable={!busy}
                />
                {araniyor ? (
                  <ActivityIndicator
                    size="small"
                    color={RenkTokenlari.primarySoft}
                  />
                ) : arama ? (
                  <Pressable
                    onPress={() => {
                      setArama('');
                      setOneriler([]);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color={RenkTokenlari.textDim}
                    />
                  </Pressable>
                ) : null}
              </View>

              {oneriler.length > 0 ? (
                <View style={styles.oneriListe}>
                  {oneriler.map((k, i) => {
                    const ad = OneriAdi(k);
                    return (
                      <Pressable
                        key={k.id}
                        style={({ pressed }) => [
                          styles.kisiSatir,
                          i > 0 && styles.kisiCizgi,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => {
                          setSecili(k);
                          setArama('');
                          setOneriler([]);
                        }}
                      >
                        <Avatar url={k.avatar_url} ad={ad} size={36} />
                        <Text style={styles.kisiAd} numberOfLines={1}>
                          {ad}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {!araniyor && arama.trim().length >= 1 && oneriler.length === 0 ? (
                <Text style={styles.bosOneri}>Eşleşen kullanıcı yok</Text>
              ) : null}
            </>
          )}
        </View>
      )}

      {hedef ? (
        <View style={styles.bakiyePanel}>
          <View style={styles.bakiyeUst}>
            <Text style={styles.bakiyeBaslik}>Kullanıcının bakiyesi</Text>
            {ozetYukleniyor ? (
              <ActivityIndicator size="small" color={RenkTokenlari.primarySoft} />
            ) : (
              <Pressable
                onPress={() => void ozetYukle(hedef)}
                hitSlop={8}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Bakiyeyi yenile"
              >
                <Ionicons
                  name="refresh"
                  size={15}
                  color={RenkTokenlari.textDim}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.bakiyeGrid}>
            {bakiyeKartlari.map((b) => (
              <View key={b.etiket} style={styles.bakiyeKart}>
                <Text style={styles.bakiyeEtiket}>{b.etiket}</Text>
                <Text style={[styles.bakiyeDeger, { color: b.renk }]}>
                  {b.deger == null ? '—' : CuzdanSayi(b.deger)}
                </Text>
                <Text style={styles.bakiyeIpucu}>{b.ipucu}</Text>
              </View>
            ))}
          </View>

          {ozetHata ? <Text style={styles.bakiyeHata}>{ozetHata}</Text> : null}
        </View>
      ) : null}

      <View style={AdminStil.aksiyonSatir}>
        {HIZLI.map((n) => (
          <Pressable
            key={n}
            style={AdminStil.aksiyon}
            onPress={() => setMiktar(String(n))}
            disabled={busy}
          >
            <Text style={AdminStil.aksiyonYazi}>{SayiKisa(n)}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={AdminStil.input}
        placeholder="Miktar"
        placeholderTextColor={RenkTokenlari.textDim}
        value={miktar}
        onChangeText={setMiktar}
        keyboardType="number-pad"
        editable={!busy}
      />
      <TextInput
        style={AdminStil.input}
        placeholder="Not / ceza sebebi (cezada zorunlu)"
        placeholderTextColor={RenkTokenlari.textDim}
        value={not}
        onChangeText={setNot}
        editable={!busy}
      />

      <View style={styles.btnSatir}>
        {(
          [
            {
              islem: 'topup',
              kova: 'bonus_coins',
              etiket: 'Ödül ekle',
              renk: RenkTokenlari.mint,
              stil: styles.yesil,
            },
            {
              islem: 'deduct',
              kova: 'coins',
              etiket: 'Coin eksilt',
              renk: RenkTokenlari.accent,
              stil: styles.turuncu,
            },
          ] as const
        ).map((b) => (
          <Pressable
            key={`${b.islem}-${b.kova}`}
            style={({ pressed }) => [
              styles.btn,
              b.stil,
              pressed && !busy && styles.btnBasili,
              busy && styles.btnPasif,
            ]}
            disabled={busy}
            onPress={() => uygula(b.islem, b.kova)}
            accessibilityRole="button"
            accessibilityLabel={b.etiket}
          >
            {busy ? (
              <ActivityIndicator size="small" color={b.renk} />
            ) : (
              <Text style={[styles.btnYazi, { color: b.renk }]}>{b.etiket}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.btnSatir}>
        {(
          [
            {
              islem: 'deduct',
              kova: 'bonus_coins',
              etiket: 'Ödül eksilt',
              renk: RenkTokenlari.warning,
              stil: styles.sari,
            },
            {
              islem: 'penalty',
              kova: 'coins',
              etiket: 'Ceza',
              renk: RenkTokenlari.danger,
              stil: styles.kirmizi,
            },
          ] as const
        ).map((b) => (
          <Pressable
            key={`${b.islem}-${b.kova}`}
            style={({ pressed }) => [
              styles.btn,
              b.stil,
              pressed && !busy && styles.btnBasili,
              busy && styles.btnPasif,
            ]}
            disabled={busy}
            onPress={() => uygula(b.islem, b.kova)}
            accessibilityRole="button"
            accessibilityLabel={b.etiket}
          >
            {busy ? (
              <ActivityIndicator size="small" color={b.renk} />
            ) : (
              <Text style={[styles.btnYazi, { color: b.renk }]}>{b.etiket}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <Text style={styles.ipucu}>
        Coin = satın alınan bakiye. Ödül coin = admin / bonus kredisi. Satın alınan
        kovaya admin eklemesi yapılmaz; “Ödül ekle” ödül kovasına yazar. Ceza
        satın alınan coinden düşer ve kullanıcıya ihtar yazar.
      </Text>

      {onay
        ? (() => {
            const h = onayHesap(onay);
            const isaret = onay.islem === 'topup' ? '+' : '\u2212';
            return (
              <View style={styles.onayKutu}>
                <Text style={styles.onayBaslik}>
                  {AdminCoinIslemEtiketi(onay.islem, onay.kova)}
                </Text>
                <Text style={styles.onayMetin}>
                  {isaret}
                  {CuzdanSayi(h.uygulanacak)} {AdminCoinKovaAdi(h.hedefKova)} ·{' '}
                  {sabitRef || (secili ? OneriAdi(secili) : 'Kullanıcı')}
                  {'\n'}Mevcut: coin {ozet ? CuzdanSayi(ozet.coins) : '—'} · ödül{' '}
                  {ozet ? CuzdanSayi(ozet.bonus_coins) : '—'}
                  {'\n'}Sonra: coin {ozet ? CuzdanSayi(h.coinsAfter) : '—'} · ödül{' '}
                  {ozet ? CuzdanSayi(h.bonusAfter) : '—'} (tahmini)
                  {h.eksik > 0
                    ? `\nBakiye yetmiyor: ${CuzdanSayi(h.eksik)} eksiltilemez.`
                    : ''}
                  {h.yonlendirildi
                    ? '\nSatın alınan kovaya ekleme yapılmaz; kredi ödül kovasına yazılır.'
                    : ''}
                  {not.trim() ? `\nNot: ${not.trim()}` : ''}
                </Text>
                <View style={styles.onaySatir}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.onayDugme,
                      pressed && styles.btnBasili,
                    ]}
                    onPress={() => setOnay(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Vazgeç"
                  >
                    <Text style={styles.onayVazgecYazi}>Vazgeç</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.onayDugme,
                      styles.onayUygula,
                      pressed && styles.btnBasili,
                    ]}
                    onPress={() => void calistir(onay)}
                    accessibilityRole="button"
                    accessibilityLabel="Onayla"
                  >
                    <Text style={styles.onayUygulaYazi}>Onayla</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()
        : null}

      {durum ? (
        <View
          style={[
            styles.durumKutu,
            durum.tur === 'hata' ? styles.durumHata : styles.durumOk,
          ]}
        >
          <Ionicons
            name={durum.tur === 'hata' ? 'alert-circle' : 'checkmark-circle'}
            size={15}
            color={durum.tur === 'hata' ? RenkTokenlari.danger : RenkTokenlari.mint}
          />
          <Text
            style={[
              styles.durumYazi,
              { color: durum.tur === 'hata' ? RenkTokenlari.danger : RenkTokenlari.mint },
            ]}
          >
            {durum.yazi}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: BoslukTokenlari.sm,
  },
  aramaBolum: {
    gap: 6,
  },
  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  aramaInput: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
    paddingVertical: 12,
  },
  oneriListe: {
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgElevated,
    overflow: 'hidden',
  },
  kisiSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kisiAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    flex: 1,
    fontWeight: '600',
  },
  kisiCizgi: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RenkTokenlari.border,
  },
  bosOneri: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  bakiyePanel: {
    gap: 8,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.primarySoft}44`,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  bakiyeUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bakiyeBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  bakiyeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  bakiyeKart: {
    flex: 1,
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  bakiyeEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  bakiyeDeger: {
    ...TipografiTokenlari.body,
    fontWeight: '800',
  },
  bakiyeIpucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  bakiyeHata: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
  },
  ipucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    lineHeight: 16,
  },
  btnSatir: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  yesil: { borderColor: `${RenkTokenlari.mint}55` },
  turuncu: { borderColor: `${RenkTokenlari.accent}55` },
  sari: { borderColor: `${RenkTokenlari.warning}55` },
  kirmizi: { borderColor: `${RenkTokenlari.danger}55` },
  btnBasili: { opacity: 0.75 },
  btnPasif: { opacity: 0.55 },
  btnYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
  onayKutu: {
    gap: 8,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.primarySoft}66`,
    backgroundColor: RenkTokenlari.bgElevated,
  },
  onayBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  onayMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 19,
  },
  onaySatir: { flexDirection: 'row', gap: 8 },
  onayDugme: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  onayVazgecYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  onayUygula: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: RenkTokenlari.primary,
  },
  onayUygulaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  durumKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
  },
  durumOk: {
    borderColor: `${RenkTokenlari.mint}55`,
    backgroundColor: 'rgba(107,207,176,0.10)',
  },
  durumHata: {
    borderColor: `${RenkTokenlari.danger}55`,
    backgroundColor: 'rgba(232,75,106,0.10)',
  },
  durumYazi: {
    ...TipografiTokenlari.caption,
    flex: 1,
    fontWeight: '600',
  },
});
