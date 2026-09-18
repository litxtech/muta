import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  YetkiliAjanslariGetir,
  type YetkiliAjans,
} from '../okuma/YetkiliAjanslariGetir';
import { AjansSohbetAcVeyaGetir } from '../../mesajlasma/islemler/MesajGonder';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  /** Mağaza kilitliyken mesaj yine açık kalabilir */
  locked?: boolean;
};

/**
 * IAP paketlerinin altında: yetkili ajans ile yükle + mesaj.
 * iOS → Apple, Android → Google ödeme üstte (paketler); burada ajans hattı.
 */
export function YetkiliAjansYukleSeridi({ locked }: Props) {
  const router = useRouter();
  const [liste, setListe] = useState<YetkiliAjans[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const rows = await YetkiliAjanslariGetir(40);
    setListe(rows);
    setYukleniyor(false);
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const mesajAc = async (ajans: YetkiliAjans) => {
    if (busyId) return;
    setBusyId(ajans.id);
    const r = await AjansSohbetAcVeyaGetir(ajans.id);
    setBusyId(null);
    if (!r.ok) {
      Alert.alert('Mesaj', r.hata);
      return;
    }
    router.push(`/mesaj/${r.threadId}` as any);
  };

  const magazaEtiket =
    Platform.OS === 'ios'
      ? 'Apple ile ödeme'
      : Platform.OS === 'android'
        ? 'Google ile ödeme'
        : 'Mağaza ödemesi';

  return (
    <View style={styles.wrap}>
      <View style={styles.ayrac}>
        <View style={styles.ayracCizgi} />
        <Text style={styles.ayracYazi}>veya</Text>
        <View style={styles.ayracCizgi} />
      </View>

      <Text style={styles.baslik}>Yetkili ajans ile yükle</Text>
      <Text style={styles.alt}>
        Üstte {magazaEtiket} · aşağıda coin yükleme yetkili ajanslar. Mesaj
        gönderip iletişime geçebilirsin.
      </Text>

      {yukleniyor ? (
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginVertical: 16 }}
        />
      ) : liste.length === 0 ? (
        <Text style={styles.bos}>Şu an listelenen yetkili ajans yok.</Text>
      ) : (
        <View style={styles.liste}>
          {liste.map((a) => (
            <View key={a.id} style={styles.kart}>
              <Pressable
                style={styles.sol}
                onPress={() => router.push(`/ajans/profil/${a.id}` as any)}
              >
                {a.logo_url ? (
                  <Image source={{ uri: a.logo_url }} style={styles.logo} />
                ) : (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPrimary]}
                    style={styles.logo}
                  >
                    <Text style={styles.logoHarf}>
                      {(a.name[0] || 'A').toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.metin}>
                  <Text style={styles.ad} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {a.agency_public_id ?? 'Yetkili dağıtıcı'}
                    {a.slogan ? ` · ${a.slogan}` : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.mesajBtn, busyId === a.id && { opacity: 0.6 }]}
                disabled={!!busyId || locked}
                onPress={() => void mesajAc(a)}
                accessibilityLabel={`${a.name} ajansına mesaj gönder`}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                <Text style={styles.mesajYazi}>Mesaj</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: BoslukTokenlari.xl,
    gap: BoslukTokenlari.sm,
  },
  ayrac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  ayracCizgi: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RenkTokenlari.border,
  },
  ayracYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
    fontWeight: '800',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    lineHeight: 16,
    marginBottom: 4,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    paddingVertical: 12,
  },
  liste: { gap: 10 },
  kart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  sol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHarf: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '800',
  },
  metin: { flex: 1, minWidth: 0, gap: 2 },
  ad: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  meta: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
  },
  mesajBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  mesajYazi: {
    ...TipografiTokenlari.micro,
    color: '#fff',
    fontWeight: '800',
  },
});
