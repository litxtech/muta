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
import { AdminStil, SayiKisa } from './AdminStil';
import {
  AdminCoinIslemEtiketi,
  AdminKullaniciCoinIsle,
  type AdminCoinIslem,
} from '../kullanici/islemler/AdminKullaniciCoinIsle';

const HIZLI = [1_000, 5_000, 10_000, 50_000, 100_000] as const;

type Props = {
  /** Sabit kullanıcı (dosya ekranı); boşsa arama alanı gösterilir */
  userRef?: string;
  baslik?: string;
  alt?: string;
  onBasarili?: (balanceAfter: number) => void;
};

export function AdminKullaniciCoinPaneli({
  userRef: sabitRef,
  baslik = 'Coin işlemleri',
  alt = 'Yükle · eksilt · ceza (ledger + audit)',
  onBasarili,
}: Props) {
  const [ref, setRef] = useState(sabitRef ?? '');
  const [miktar, setMiktar] = useState('1000');
  const [not, setNot] = useState('');
  const [busy, setBusy] = useState(false);

  const hedef = (sabitRef ?? ref).trim();

  const uygula = (islem: AdminCoinIslem) => {
    const n = Math.floor(Number(miktar));
    if (!hedef) {
      Alert.alert('Coin', 'Kullanıcı ID / public ID / kullanıcı adı gerekli.');
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Coin', 'Pozitif miktar gir.');
      return;
    }
    if (islem === 'penalty' && !not.trim()) {
      Alert.alert('Coin cezası', 'Ceza için kısa bir sebep yaz.');
      return;
    }

    const isaret = islem === 'topup' ? '+' : '−';
    Alert.alert(
      AdminCoinIslemEtiketi(islem),
      `${isaret}${n.toLocaleString('tr-TR')} coin\n${hedef}${
        not.trim() ? `\nNot: ${not.trim()}` : ''
      }`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Onayla',
          style: islem === 'penalty' ? 'destructive' : 'default',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AdminKullaniciCoinIsle({
                userRef: hedef,
                islem,
                miktar: n,
                not: not.trim() || undefined,
              });
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Coin', r.hata);
                return;
              }
              Alert.alert(
                'Tamam',
                `${r.display_name ?? 'Kullanıcı'}\nYeni bakiye: ${r.balance_after.toLocaleString('tr-TR')} coin`,
              );
              setNot('');
              onBasarili?.(r.balance_after);
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.kart}>
      <Text style={AdminStil.kartBaslik}>{baslik}</Text>
      <Text style={AdminStil.kartAlt}>{alt}</Text>

      {sabitRef ? null : (
        <TextInput
          style={AdminStil.input}
          placeholder="UUID · public ID · @kullanıcı"
          placeholderTextColor={RenkTokenlari.textDim}
          value={ref}
          onChangeText={setRef}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

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
        <Pressable
          style={[styles.btn, styles.yesil]}
          disabled={busy}
          onPress={() => uygula('topup')}
        >
          <Text style={[styles.btnYazi, { color: RenkTokenlari.mint }]}>
            Yükle
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.turuncu]}
          disabled={busy}
          onPress={() => uygula('deduct')}
        >
          <Text style={[styles.btnYazi, { color: RenkTokenlari.accent }]}>
            Eksilt
          </Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.kirmizi]}
          disabled={busy}
          onPress={() => uygula('penalty')}
        >
          <Text style={[styles.btnYazi, { color: RenkTokenlari.danger }]}>
            Ceza
          </Text>
        </Pressable>
      </View>
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
  kirmizi: { borderColor: `${RenkTokenlari.danger}55` },
  btnYazi: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
  },
});
