import React, { useState } from 'react';
import {
  Alert,
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

  const uygula = (islem: AdminHesapDegeriIslem) => {
    const n = Math.floor(Number(miktar));
    if (!userRef.trim()) {
      Alert.alert('Hesap değeri', 'Kullanıcı gerekli.');
      return;
    }
    if (islem !== 'formul') {
      if (!Number.isFinite(n)) {
        Alert.alert('Hesap değeri', 'Geçerli miktar gir.');
        return;
      }
      if (islem === 'sabitle' && (n < 0 || n > 1000)) {
        Alert.alert('Hesap değeri', 'Sabit skor 0–1000 olmalı.');
        return;
      }
      if (islem !== 'sabitle' && n <= 0) {
        Alert.alert('Hesap değeri', 'Pozitif miktar gir.');
        return;
      }
    }

    const baslik = AdminHesapDegeriIslemEtiketi(islem);
    const govde =
      islem === 'formul'
        ? `Manuel kilit kalkar; skor formülden yeniden hesaplanır.\nŞu an: ${mevcut}`
        : islem === 'sabitle'
          ? `Skor ${n} olarak sabitlenir (0–1000).\nŞu an: ${mevcut}`
          : `${islem === 'artir' ? '+' : '−'}${n}\nŞu an: ${mevcut} → tahmini ${
              islem === 'artir'
                ? Math.min(1000, mevcut + n)
                : Math.max(0, mevcut - n)
            }`;

    Alert.alert(
      baslik,
      `${govde}${not.trim() ? `\nNot: ${not.trim()}` : ''}`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AdminKullaniciHesapDegeriIsle({
                userRef,
                islem,
                miktar: islem === 'formul' ? undefined : n,
                not: not.trim() || undefined,
              });
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Hesap değeri', r.hata);
                return;
              }
              Alert.alert(
                'Tamam',
                `${r.display_name ?? 'Kullanıcı'}\n${r.value_before} → ${r.value_after} (${r.label})${
                  r.override ? '\nManuel kilit: açık' : '\nFormül aktif'
                }`,
              );
              setNot('');
              onBasarili?.(r.value_after);
            })();
          },
        },
      ],
    );
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
        <Pressable
          style={[styles.btn, styles.yesil]}
          disabled={busy}
          onPress={() => uygula('artir')}
        >
          <Text style={[styles.btnYazi, { color: RenkTokenlari.mint }]}>
            Artır
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.turuncu]}
          disabled={busy}
          onPress={() => uygula('eksilt')}
        >
          <Text style={[styles.btnYazi, { color: RenkTokenlari.accent }]}>
            Eksilt
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.mor]}
          disabled={busy}
          onPress={() => uygula('sabitle')}
        >
          <Text style={[styles.btnYazi, { color: '#C9A227' }]}>Sabitle</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.btn, styles.formul]}
        disabled={busy}
        onPress={() => uygula('formul')}
      >
        <Text style={[styles.btnYazi, { color: RenkTokenlari.textMuted }]}>
          Formülden yenile (kilidi kaldır)
        </Text>
      </Pressable>
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
    flex: 0,
    borderColor: RenkTokenlari.border,
    marginTop: 2,
  },
  btnYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
});
