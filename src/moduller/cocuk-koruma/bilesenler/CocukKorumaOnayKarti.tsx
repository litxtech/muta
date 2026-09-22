import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { useAuth } from '../../../contexts/AuthContext';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { COCUK_KORUMA_KART } from '../icerik/CocukKorumaKartMetni';
import {
  CocukKorumaOnayDurumuGetir,
  CocukKorumaOnayla,
  CocukKorumaReddetVeHesapKapat,
} from '../islemler/CocukKorumaIslemleri';

/**
 * Oturum açmış her kullanıcı için tek seferlik çocuk koruma onay kartı.
 * Backdrop kapatılmaz; onaylanana veya hesap kapanana kadar kalır.
 */
export function CocukKorumaOnayKarti() {
  const { user, profile, refreshProfile } = useAuth();
  const [gerekli, setGerekli] = useState(false);
  const [kontrolEdildi, setKontrolEdildi] = useState(false);
  const [altOnay, setAltOnay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kontrolEt = useCallback(async () => {
    if (!user?.id || !profile || profile.deleted_at || profile.banned_at) {
      setGerekli(false);
      setKontrolEdildi(true);
      return;
    }
    // Profilde zaten onay varsa RPC'ye gitme
    if (profile.child_protection_consent_status === 'approved') {
      setGerekli(false);
      setKontrolEdildi(true);
      return;
    }
    try {
      const d = await CocukKorumaOnayDurumuGetir();
      setGerekli(d.gerekli === true);
    } catch {
      setGerekli(false);
    } finally {
      setKontrolEdildi(true);
    }
  }, [user?.id, profile]);

  useEffect(() => {
    void kontrolEt();
  }, [kontrolEt]);

  const onayla = async () => {
    setBusy(true);
    setHata(null);
    const r = await CocukKorumaOnayla();
    setBusy(false);
    if (!r.ok) {
      setHata(r.hata);
      return;
    }
    setGerekli(false);
    setAltOnay(false);
    await refreshProfile();
  };

  const reddetOnayla = async () => {
    setBusy(true);
    setHata(null);
    const r = await CocukKorumaReddetVeHesapKapat();
    setBusy(false);
    if (!r.ok) {
      setHata(r.hata);
      return;
    }
    setGerekli(false);
    setAltOnay(false);
    router.replace('/(auth)/login' as any);
  };

  if (!kontrolEdildi || !gerekli) return null;

  const M = COCUK_KORUMA_KART;

  return (
    <TamusoModal
      visible
      onClose={() => undefined}
      animationType="fade"
      placement="center"
      backdropClosable={false}
    >
      <View style={styles.wrap}>
        <LinearGradient
          colors={['#1A2E28', '#0F1A16', '#0B1411']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.kart}
        >
          <View style={styles.ustSerit} />
          <View style={styles.baslikSatir}>
            <View style={styles.ikonKutu}>
              <Ionicons name="shield-checkmark" size={22} color="#7DFFB3" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.baslikTr}>{M.baslikTr}</Text>
              <Text style={styles.baslikEn}>{M.baslikEn}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollIcerik}
            showsVerticalScrollIndicator
            bounces
          >
            <Text style={styles.govde}>{M.govdeTr}</Text>
            <View style={styles.ayirici} />
            <Text style={styles.govde}>{M.govdeEn}</Text>
          </ScrollView>

          {hata ? <Text style={styles.hata}>{hata}</Text> : null}

          {!altOnay ? (
            <View style={styles.aksiyonlar}>
              <Pressable
                style={[styles.btn, styles.btnOnay]}
                disabled={busy}
                onPress={() => void onayla()}
              >
                {busy ? (
                  <ActivityIndicator color="#0B1411" />
                ) : (
                  <>
                    <Text style={styles.btnOnayYazi}>{M.btnBuyugumTr}</Text>
                    <Text style={styles.btnOnayAlt}>{M.btnBuyugumEn}</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnRed]}
                disabled={busy}
                onPress={() => setAltOnay(true)}
              >
                <Text style={styles.btnRedYazi}>{M.btnDegilimTr}</Text>
                <Text style={styles.btnRedAlt}>{M.btnDegilimEn}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.aksiyonlar}>
              <Text style={styles.uyari}>{M.onayUyariTr}</Text>
              <Text style={[styles.uyari, styles.uyariEn]}>{M.onayUyariEn}</Text>
              <Pressable
                style={[styles.btn, styles.btnTehlike]}
                disabled={busy}
                onPress={() => void reddetOnayla()}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.btnTehlikeYazi}>{M.btnOnayKapatTr}</Text>
                    <Text style={styles.btnTehlikeAlt}>{M.btnOnayKapatEn}</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                disabled={busy}
                onPress={() => setAltOnay(false)}
              >
                <Text style={styles.btnGhostYazi}>
                  {M.btnVazgecTr} / {M.btnVazgecEn}
                </Text>
              </Pressable>
            </View>
          )}
        </LinearGradient>
      </View>
    </TamusoModal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: BoslukTokenlari.md,
  },
  kart: {
    borderRadius: YaricapTokenlari.xl,
    borderWidth: 1,
    borderColor: 'rgba(125,255,179,0.22)',
    overflow: 'hidden',
    maxHeight: '92%',
  },
  ustSerit: {
    height: 3,
    backgroundColor: '#7DFFB3',
    opacity: 0.85,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  ikonKutu: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(125,255,179,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslikTr: {
    ...TipografiTokenlari.h2,
    color: '#F4FFF8',
    fontWeight: '700',
  },
  baslikEn: {
    ...TipografiTokenlari.caption,
    color: 'rgba(244,255,248,0.55)',
    marginTop: 2,
  },
  scroll: {
    maxHeight: 320,
    marginHorizontal: 18,
    marginTop: 4,
  },
  scrollIcerik: {
    paddingBottom: 8,
    gap: 12,
  },
  govde: {
    ...TipografiTokenlari.body,
    color: 'rgba(244,255,248,0.88)',
    lineHeight: 22,
  },
  ayirici: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(125,255,179,0.25)',
    marginVertical: 4,
  },
  hata: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  aksiyonlar: {
    padding: 18,
    gap: 10,
  },
  btn: {
    borderRadius: YaricapTokenlari.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnOnay: {
    backgroundColor: '#7DFFB3',
  },
  btnOnayYazi: {
    ...TipografiTokenlari.body,
    color: '#0B1411',
    fontWeight: '700',
  },
  btnOnayAlt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(11,20,17,0.65)',
    marginTop: 2,
  },
  btnRed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  btnRedYazi: {
    ...TipografiTokenlari.body,
    color: 'rgba(244,255,248,0.92)',
    fontWeight: '600',
  },
  btnRedAlt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(244,255,248,0.5)',
    marginTop: 2,
  },
  uyari: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,180,160,0.95)',
    lineHeight: 18,
    textAlign: 'center',
  },
  uyariEn: {
    color: 'rgba(255,180,160,0.7)',
    marginBottom: 4,
  },
  btnTehlike: {
    backgroundColor: RenkTokenlari.danger,
  },
  btnTehlikeYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '700',
  },
  btnTehlikeAlt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnGhostYazi: {
    ...TipografiTokenlari.caption,
    color: 'rgba(244,255,248,0.55)',
  },
});
