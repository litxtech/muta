import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { AdminStil } from './AdminStil';
import {
  AdminHesapDegeriIslemEtiketi,
  AdminKullaniciHesapDegeriIsle,
  type AdminHesapDegeriIslem,
} from '../kullanici/islemler/AdminKullaniciHesapDegeriIsle';

const HIZLI = [25, 50, 100, 150, 250, 500] as const;

/** Onay panelin içinde sorulur: web'de düğme sessiz kalmaz. */
type Onay = { islem: AdminHesapDegeriIslem; miktar: number };

type Durum = { tur: 'ok' | 'hata'; yazi: string };

type Props = {
  userRef: string;
  mevcut: number;
  etiket?: string | null;
  override?: boolean;
  onBasarili?: (valueAfter: number) => void;
};

export function AdminKullaniciHesapDegeriPaneli({
  userRef,
  mevcut,
  etiket,
  override,
  onBasarili,
}: Props) {
  const [miktar, setMiktar] = useState('50');
  const [not, setNot] = useState('');
  const [busy, setBusy] = useState(false);
  const [onay, setOnay] = useState<Onay | null>(null);
  const [durum, setDurum] = useState<Durum | null>(null);

  const uygula = (islem: AdminHesapDegeriIslem) => {
    if (busy) return;
    const n = Math.floor(Number(miktar));
    if (!userRef.trim()) {
      setDurum({ tur: 'hata', yazi: 'Kullanıcı gerekli.' });
      return;
    }
    if (islem !== 'formul') {
      if (!Number.isFinite(n)) {
        setDurum({ tur: 'hata', yazi: 'Geçerli miktar gir.' });
        return;
      }
      if (islem === 'sabitle' && (n < 0 || n > 1000)) {
        setDurum({ tur: 'hata', yazi: 'Sabit skor 0–1000 olmalı.' });
        return;
      }
      if (islem !== 'sabitle' && n <= 0) {
        setDurum({ tur: 'hata', yazi: 'Pozitif miktar gir.' });
        return;
      }
    }
    setDurum(null);
    setOnay({ islem, miktar: n });
  };

  const onayMetni = (o: Onay): string => {
    const govde =
      o.islem === 'formul'
        ? `Manuel kilit kalkar; skor formülden yeniden hesaplanır.\nŞu an: ${mevcut}`
        : o.islem === 'sabitle'
          ? `Skor ${o.miktar} olarak sabitlenir (0–1000).\nŞu an: ${mevcut}`
          : `${o.islem === 'artir' ? '+' : '−'}${o.miktar}\nŞu an: ${mevcut} → tahmini ${
              o.islem === 'artir'
                ? Math.min(1000, mevcut + o.miktar)
                : Math.max(0, mevcut - o.miktar)
            }`;
    return `${govde}${not.trim() ? `\nNot: ${not.trim()}` : ''}`;
  };

  const calistir = async (o: Onay) => {
    setOnay(null);
    setDurum(null);
    setBusy(true);
    try {
      const r = await AdminKullaniciHesapDegeriIsle({
        userRef,
        islem: o.islem,
        miktar: o.islem === 'formul' ? undefined : o.miktar,
        not: not.trim() || undefined,
      });
      if (!r.ok) {
        setDurum({ tur: 'hata', yazi: r.hata });
        return;
      }
      setDurum({
        tur: 'ok',
        yazi: `${r.display_name ?? 'Kullanıcı'} · ${r.value_before} → ${r.value_after} (${
          r.label
        })${r.override ? ' · manuel kilit açık' : ' · formül aktif'}`,
      });
      setNot('');
      onBasarili?.(r.value_after);
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

  return (
    <View style={styles.kart}>
      <Text style={AdminStil.kartBaslik}>Hesap değeri</Text>
      <Text style={AdminStil.kartAlt}>
        Mevcut: {mevcut}/1000
        {etiket ? ` · ${etiket}` : ''}
        {override ? ' · manuel kilit' : ' · formül'}
        {'\n'}Admin yetkisiyle artır / eksilt / sabitle (0–1000)
      </Text>

      <View style={AdminStil.aksiyonSatir}>
        {HIZLI.map((n) => (
          <Pressable
            key={n}
            style={AdminStil.aksiyon}
            onPress={() => setMiktar(String(n))}
            disabled={busy}
          >
            <Text style={AdminStil.aksiyonYazi}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={AdminStil.input}
        placeholder="Miktar / sabit skor"
        placeholderTextColor={RenkTokenlari.textDim}
        value={miktar}
        onChangeText={setMiktar}
        keyboardType="number-pad"
        editable={!busy}
      />
      <TextInput
        style={AdminStil.input}
        placeholder="Not (opsiyonel)"
        placeholderTextColor={RenkTokenlari.textDim}
        value={not}
        onChangeText={setNot}
        editable={!busy}
      />

      <View style={styles.btnSatir}>
        {(
          [
            { islem: 'artir', etiket: 'Artır', renk: RenkTokenlari.mint, stil: styles.yesil },
            { islem: 'eksilt', etiket: 'Eksilt', renk: RenkTokenlari.accent, stil: styles.turuncu },
            { islem: 'sabitle', etiket: 'Sabitle', renk: '#C9A227', stil: styles.mor },
          ] as const
        ).map((b) => (
          <Pressable
            key={b.islem}
            style={({ pressed }) => [
              styles.btn,
              b.stil,
              pressed && !busy && styles.btnBasili,
              busy && styles.btnPasif,
            ]}
            disabled={busy}
            onPress={() => uygula(b.islem)}
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

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.formul,
          pressed && !busy && styles.btnBasili,
          busy && styles.btnPasif,
        ]}
        disabled={busy}
        onPress={() => uygula('formul')}
        accessibilityRole="button"
        accessibilityLabel="Formülden yenile"
      >
        <Text style={[styles.btnYazi, { color: RenkTokenlari.textMuted }]}>
          Formülden yenile (kilidi kaldır)
        </Text>
      </Pressable>

      {onay ? (
        <View style={styles.onayKutu}>
          <Text style={styles.onayBaslik}>
            {AdminHesapDegeriIslemEtiketi(onay.islem)}
          </Text>
          <Text style={styles.onayMetin}>{onayMetni(onay)}</Text>
          <View style={styles.onaySatir}>
            <Pressable
              style={({ pressed }) => [styles.onayDugme, pressed && styles.btnBasili]}
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
      ) : null}

      {durum ? (
        <Text
          style={[
            styles.durumYazi,
            {
              color:
                durum.tur === 'hata' ? RenkTokenlari.danger : RenkTokenlari.mint,
            },
          ]}
        >
          {durum.yazi}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: RenkTokenlari.bgCard,
    gap: BoslukTokenlari.sm,
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
  mor: { borderColor: 'rgba(212,175,55,0.55)' },
  formul: {
    // `flex: 0` = flex-basis 0% → kolon içinde kutu çöker; kart akışta kalsın.
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    borderColor: RenkTokenlari.border,
    marginTop: 2,
  },
  btnYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
  btnBasili: { opacity: 0.75 },
  btnPasif: { opacity: 0.55 },
  onayKutu: {
    gap: 8,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
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
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.primary,
  },
  onayUygulaYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
  },
  durumYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '700',
  },
});
