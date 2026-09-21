import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { GradientButton } from '../../src/components/GradientButton';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { KlavyeGuvenliAlan } from '../../src/bilesenler/klavye/KlavyeGuvenliAlan';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import {
  KullanicilariAra,
  type ArananKullanici,
} from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import {
  BILDIRME_SEBEPLERI,
  KullaniciBildir,
} from '../../src/moduller/moderasyon/islemler/ModerasyonIslemleri';
import { ProfilAvatarKucuk } from '../../src/moduller/canli-sohbet/bilesenler/ProfilAvatarKucuk';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Adim = 'ara' | 'sebep' | 'detay';

/** Geniş çaplı bildirim: ara → seç → sebep → açıklama → gönder */
export default function BildirEkrani() {
  const { user, isGuest } = useAuth();
  const { upgradeAcik, upgradeKapat, upgradeAc } = useMisafirIslemKapisi(isGuest);
  const [adim, setAdim] = useState<Adim>('ara');
  const [sorgu, setSorgu] = useState('');
  const [sonuclar, setSonuclar] = useState<ArananKullanici[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [hedef, setHedef] = useState<ArananKullanici | null>(null);
  const [sebepId, setSebepId] = useState<string | null>(null);
  const [detay, setDetay] = useState('');
  const [busy, setBusy] = useState(false);

  const ara = useCallback(
    async (q: string) => {
      setSorgu(q);
      if (q.trim().length < 1) {
        setSonuclar([]);
        return;
      }
      setAraniyor(true);
      try {
        const rows = await KullanicilariAra({
          sorgu: q,
          haricUserId: user?.id,
          limit: 24,
        });
        setSonuclar(rows);
      } catch {
        setSonuclar([]);
      } finally {
        setAraniyor(false);
      }
    },
    [user?.id],
  );

  const sebepLabel = useMemo(
    () => BILDIRME_SEBEPLERI.find((s) => s.id === sebepId)?.label ?? null,
    [sebepId],
  );

  const gonder = async () => {
    Keyboard.dismiss();
    if (isGuest) {
      upgradeAc();
      return;
    }
    if (!hedef || !sebepId || !sebepLabel) {
      Alert.alert('Bildir', 'Kullanıcı ve sebep seç.');
      return;
    }
    if (detay.trim().length < 8) {
      Alert.alert('Bildir', 'Kısa bir açıklama yaz (en az birkaç kelime).');
      return;
    }
    setBusy(true);
    const r = await KullaniciBildir({
      reason: sebepLabel,
      reasonCode: sebepId,
      targetUserId: hedef.id,
      details: detay.trim(),
      contentType: 'user',
      context: { source: 'bildir_merkezi' },
    });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Bildir', r.hata ?? 'Gönderilemedi');
      return;
    }
    Alert.alert(
      'Bildirim alındı',
      "Raporunuz incelenecek. Takibi Bildirimler → Raporlarım'dan yapabilirsiniz.",
      [
        {
          text: 'Raporlarım',
          onPress: () => router.replace('/raporlarim' as any),
        },
        { text: 'Tamam', onPress: () => router.back() },
      ],
    );
  };

  return (
    <Screen>
      <ModulHataSiniri modulAdi="bildir">
        <EkranBasligi
          title="Bildir"
          subtitle="Kullanıcı ara · sebep seç · açıkla"
          onBack={() => router.back()}
        />

        <View style={styles.ustLink}>
          <Pressable
            style={styles.linkChip}
            onPress={() => router.push('/raporlarim' as any)}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={RenkTokenlari.primarySoft}
            />
            <Text style={styles.linkYazi}>Raporlarım</Text>
          </Pressable>
        </View>

        {adim === 'ara' ? (
          <View style={styles.govde}>
            <Text style={styles.etiket}>Kullanıcı ara</Text>
            <View style={styles.aramaKutu}>
              <Ionicons name="search" size={18} color={RenkTokenlari.textMuted} />
              <TextInput
                value={sorgu}
                onChangeText={(t) => void ara(t)}
                placeholder="İsim, kullanıcı adı veya ID"
                placeholderTextColor={RenkTokenlari.textDim}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                blurOnSubmit
              />
              {araniyor ? (
                <ActivityIndicator color={RenkTokenlari.primarySoft} />
              ) : null}
            </View>
            <FlatList
              data={sonuclar}
              keyExtractor={(i) => i.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
              ListEmptyComponent={
                <Text style={styles.bos}>
                  {sorgu.trim()
                    ? 'Sonuç yok'
                    : 'Bildirmek istediğin kişiyi ara'}
                </Text>
              }
              renderItem={({ item }) => {
                const ad =
                  item.display_name?.trim() ||
                  (item.username ? `@${item.username}` : item.public_user_id) ||
                  'Kullanıcı';
                return (
                  <Pressable
                    style={styles.kisiKart}
                    onPress={() => {
                      Keyboard.dismiss();
                      setHedef(item);
                      setAdim('sebep');
                    }}
                  >
                    <ProfilAvatarKucuk
                      avatarUrl={item.avatar_url}
                      displayName={item.display_name}
                      username={item.username}
                      size={44}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kisiAd} numberOfLines={1}>
                        {ad}
                      </Text>
                      {item.username ? (
                        <Text style={styles.kisiAlt}>@{item.username}</Text>
                      ) : null}
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={RenkTokenlari.textMuted}
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        ) : null}

        {adim === 'sebep' && hedef ? (
          <ScrollView
            style={styles.govde}
            contentContainerStyle={styles.scrollIcerik}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => setAdim('ara')} style={styles.geriSatir}>
              <Ionicons
                name="arrow-back"
                size={16}
                color={RenkTokenlari.primarySoft}
              />
              <Text style={styles.linkYazi}>Kullanıcı değiştir</Text>
            </Pressable>
            <View style={styles.secili}>
              <ProfilAvatarKucuk
                avatarUrl={hedef.avatar_url}
                displayName={hedef.display_name}
                username={hedef.username}
                size={40}
              />
              <Text style={styles.kisiAd}>
                {hedef.display_name?.trim() ||
                  (hedef.username ? `@${hedef.username}` : 'Kullanıcı')}
              </Text>
            </View>
            <Text style={styles.etiket}>Sebep seç</Text>
            {BILDIRME_SEBEPLERI.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.sebep, sebepId === s.id && styles.sebepAktif]}
                onPress={() => {
                  setSebepId(s.id);
                  setAdim('detay');
                }}
              >
                <Text style={styles.sebepYazi}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {adim === 'detay' && hedef ? (
          <KlavyeGuvenliAlan style={styles.govde}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollIcerik}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setAdim('sebep');
                }}
                style={styles.geriSatir}
              >
                <Ionicons
                  name="arrow-back"
                  size={16}
                  color={RenkTokenlari.primarySoft}
                />
                <Text style={styles.linkYazi}>Sebep değiştir</Text>
              </Pressable>
              <Text style={styles.ozet}>
                {hedef.display_name || hedef.username} · {sebepLabel}
              </Text>
              <Text style={styles.etiket}>Açıklama</Text>
              <TextInput
                value={detay}
                onChangeText={setDetay}
                placeholder="Ne oldu? Kısa ve net yaz…"
                placeholderTextColor={RenkTokenlari.textDim}
                style={[styles.input, styles.detay]}
                multiline
                maxLength={800}
                blurOnSubmit={false}
              />
              <GradientButton
                title={busy ? 'Gönderiliyor…' : 'Bildirimi gönder'}
                onPress={() => void gonder()}
                disabled={busy}
              />
            </ScrollView>
          </KlavyeGuvenliAlan>
        ) : null}

        <HesabiTamamlaKarti visible={upgradeAcik} onClose={upgradeKapat} />
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ustLink: {
    paddingHorizontal: BoslukTokenlari.lg,
    marginBottom: 8,
  },
  linkChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.bgCard,
  },
  linkYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  govde: {
    flex: 1,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  scrollIcerik: {
    gap: 10,
    paddingBottom: 48,
  },
  etiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  aramaKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    paddingVertical: 10,
  },
  detay: {
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: RenkTokenlari.bgCard,
    borderRadius: YaricapTokenlari.lg,
    paddingHorizontal: 12,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
  kisiKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
  },
  kisiAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kisiAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  secili: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sebep: {
    padding: 14,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sebepAktif: {
    borderColor: RenkTokenlari.primarySoft,
  },
  sebepYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
  geriSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ozet: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
});
