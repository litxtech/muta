import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  AdminKullaniciCoinIsle,
  type AdminCoinIslem,
} from '../kullanici/islemler/AdminKullaniciCoinIsle';
import {
  AdminKullaniciOneri,
  OneriAdi,
  type AdminKullaniciOneriSatiri,
} from '../kullanici/okuma/AdminKullaniciOneri';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

const HIZLI = [1_000, 5_000, 10_000, 50_000, 100_000] as const;

type SeciliKullanici = AdminKullaniciOneriSatiri;

type Props = {
  /** Sabit kullanıcı (dosya ekranı); boşsa arama alanı gösterilir */
  userRef?: string;
  baslik?: string;
  alt?: string;
  onBasarili?: (balanceAfter: number) => void;
};

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
  alt = 'İsim yaz · seç · yükle / eksilt / ceza',
  onBasarili,
}: Props) {
  const [arama, setArama] = useState('');
  const [oneriler, setOneriler] = useState<AdminKullaniciOneriSatiri[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [secili, setSecili] = useState<SeciliKullanici | null>(null);
  const [miktar, setMiktar] = useState('1000');
  const [not, setNot] = useState('');
  const [busy, setBusy] = useState(false);
  const aramaSeq = useRef(0);

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

  const temizleSecim = () => {
    setSecili(null);
    setArama('');
    setOneriler([]);
  };

  const uygula = (islem: AdminCoinIslem) => {
    const n = Math.floor(Number(miktar));
    if (!hedef) {
      Alert.alert('Coin', 'Önce kullanıcı seç.');
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

    const isaret = islem === 'topup' ? '+' : '\u2212';
    const kim = sabitRef ? sabitRef : OneriAdi(secili!);
    Alert.alert(
      AdminCoinIslemEtiketi(islem),
      `${isaret}${n.toLocaleString('tr-TR')} coin\n${kim}${
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
