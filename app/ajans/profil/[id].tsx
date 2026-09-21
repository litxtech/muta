import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { MedyaUriGuvenli } from '../../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { useAuth } from '../../../src/contexts/AuthContext';
import { HesabiTamamlaKarti } from '../../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import {
  AjansProfilGetir,
  type AjansProfil,
} from '../../../src/moduller/ajanslar/okuma/AjansProfilGetir';
import { AjansUyeBasvurusuOlustur } from '../../../src/moduller/ajanslar/islemler/AjansUyeBasvurusu';
import { useAjansUyeligi } from '../../../src/moduller/ajanslar/kancalar/useAjansUyeligi';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function sayi(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function kisa(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return sayi(n);
}

function dakikaMetni(n: number) {
  const d = Math.max(0, Math.floor(Number(n) || 0));
  if (d < 60) return `${sayi(d)} dk`;
  const saat = Math.floor(d / 60);
  const kalan = d % 60;
  return kalan ? `${sayi(saat)} sa ${kalan} dk` : `${sayi(saat)} sa`;
}

export default function AjansProfilEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const { uyelik, yenile: uyelikYenile } = useAjansUyeligi(!isGuest);
  const [profil, setProfil] = useState<AjansProfil | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [basvuruBusy, setBasvuruBusy] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      setProfil(await AjansProfilGetir(id));
    } catch {
      setProfil(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const a = profil?.agency;
  const istat = profil?.istatistik;
  const buAjans = Boolean(a && uyelik.agency?.id === a.id);
  const buAjansUye = buAjans && (uyelik.role === 'member' || uyelik.role === 'owner');
  const buAjansBeklemede = buAjans && uyelik.role === 'pending';
  const baskaAjans = Boolean(uyelik.agency && a && uyelik.agency.id !== a.id);

  const ajansaBasvur = () => {
    if (!id) return;
    islemiDene('ajans_olustur', () => {
      Alert.alert(
        'Ajansa başvur',
        'Bu ajansa katılım başvurusu gönderilsin mi? Onaylanınca üye panelin açılır.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Başvur',
            onPress: () => {
              void (async () => {
                setBasvuruBusy(true);
                const r = await AjansUyeBasvurusuOlustur({ agencyId: id });
                setBasvuruBusy(false);
                if (!r.ok) {
                  Alert.alert('Başvuru', r.hata ?? 'Gönderilemedi.');
                  return;
                }
                await uyelikYenile();
                Alert.alert(
                  'Başvuru gönderildi',
                  'Ajans onaylayınca profilinde görünür ve üye panelin açılır.',
                  [
                    {
                      text: 'Panele git',
                      onPress: () => router.push('/ajans/uye' as any),
                    },
                  ],
                );
              })();
            },
          },
        ],
      );
    });
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajans-profil" varyant="ekran" fallbackHref="/ajans">
        <EkranBasligi
          title={a?.name ?? 'Ajans profili'}
          subtitle={a?.agency_public_id ?? 'Profil'}
          fallbackHref={"/ajans" as any}
        />
        {yukleniyor && !profil ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : !profil || !a ? (
          <Text style={styles.bos}>Ajans bulunamadı</Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor}
                onRefresh={() => void yukle()}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
          >
            {(() => {
              const banner = MedyaUriGuvenli(a.banner_url);
              const logo = MedyaUriGuvenli(a.logo_url);
              return (
            <View style={styles.heroWrap}>
              {banner ? (
                <Image source={{ uri: banner }} style={styles.banner} />
              ) : (
                <LinearGradient
                  colors={[...RenkTokenlari.gradientPlaceholder]}
                  style={styles.banner}
                />
              )}
              <LinearGradient
                colors={['transparent', RenkTokenlari.bg]}
                style={styles.bannerFade}
              />
              <View style={styles.heroGovde}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoBos]}>
                    <Ionicons
                      name="business"
                      size={28}
                      color={RenkTokenlari.primarySoft}
                    />
                  </View>
                )}
                <Text style={styles.ad}>{a.name}</Text>
                {a.slogan ? (
                  <Text style={styles.slogan}>{a.slogan}</Text>
                ) : null}
                <View style={styles.ajansNoSatir}>
                  <Text style={styles.meta} numberOfLines={1}>
                    {a.agency_public_id}
                    {a.level_code ? ` · ${a.level_code}` : ''}
                    {a.country ? ` · ${a.country}` : ''}
                  </Text>
                  {a.agency_public_id ? (
                    <Pressable
                      style={styles.kopyaBtn}
                      hitSlop={8}
                      accessibilityLabel="Ajans no kopyala"
                      onPress={() => {
                        void (async () => {
                          try {
                            const Clipboard = await import('expo-clipboard');
                            await Clipboard.setStringAsync(a.agency_public_id!);
                            Alert.alert(
                              'Kopyalandı',
                              `Ajans no\n${a.agency_public_id}`,
                            );
                          } catch {
                            Alert.alert('Ajans no', a.agency_public_id!);
                          }
                        })();
                      }}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={16}
                        color={RenkTokenlari.primarySoft}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {a.description ? (
                  <Text style={styles.desc}>{a.description}</Text>
                ) : null}
                {profil.ben_sahibiyim ? (
                  <Pressable
                    style={styles.yonetBtn}
                    onPress={() => router.push(`/ajans/${a.id}` as any)}
                  >
                    <Ionicons name="settings-outline" size={16} color="#12040C" />
                    <Text style={styles.yonetYazi}>Ajansımı yönet</Text>
                  </Pressable>
                ) : buAjansUye ? (
                  <Pressable
                    style={styles.yonetBtn}
                    onPress={() => router.push('/ajans/uye' as any)}
                  >
                    <Ionicons name="grid-outline" size={16} color="#12040C" />
                    <Text style={styles.yonetYazi}>Ajans panelim</Text>
                  </Pressable>
                ) : buAjansBeklemede ? (
                  <Pressable
                    style={styles.bekleyenBtn}
                    onPress={() => router.push('/ajans/uye' as any)}
                  >
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={RenkTokenlari.accent}
                    />
                    <Text style={styles.bekleyenYazi}>Başvuru inceleniyor</Text>
                  </Pressable>
                ) : baskaAjans ? (
                  <Text style={styles.baskaUyari}>Başka bir ajansa kayıtlısın</Text>
                ) : (
                  <Pressable
                    style={[styles.yonetBtn, basvuruBusy && { opacity: 0.6 }]}
                    onPress={ajansaBasvur}
                    disabled={basvuruBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Ajansa başvur"
                  >
                    {basvuruBusy ? (
                      <ActivityIndicator color="#12040C" size="small" />
                    ) : (
                      <Ionicons name="person-add-outline" size={16} color="#12040C" />
                    )}
                    <Text style={styles.yonetYazi}>
                      {basvuruBusy ? 'Gönderiliyor…' : 'Ajansa başvur'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
              );
            })()}

            <Text style={styles.bolum}>İstatistikler</Text>
            <View style={styles.statGrid}>
              <StatKutu etiket="Üye" deger={sayi(istat?.uye_sayisi ?? 0)} />
              <StatKutu
                etiket="Haftalık coin"
                deger={kisa(istat?.haftalik_coin ?? 0)}
              />
              <StatKutu
                etiket="Toplam coin"
                deger={kisa(istat?.toplam_coin ?? 0)}
              />
              <StatKutu
                etiket="Bu ay coin"
                deger={kisa(istat?.aylik_coin ?? 0)}
              />
              <StatKutu
                etiket="Yayın"
                deger={dakikaMetni(istat?.yayin_dakika_toplam ?? 0)}
              />
              <StatKutu
                etiket="Ses odası"
                deger={dakikaMetni(istat?.ses_dakika_toplam ?? 0)}
              />
              <StatKutu
                etiket="Oyun kazanç"
                deger={kisa(istat?.oyun_kazanc_coin ?? 0)}
              />
              <StatKutu
                etiket="Oyun oturum"
                deger={sayi(istat?.oyun_oturum ?? 0)}
              />
            </View>

            <Text style={styles.bolum}>
              Yayıncılar ({profil.yayincilar?.length ?? 0})
            </Text>
            {(profil.yayincilar ?? []).length === 0 ? (
              <Text style={styles.bos}>Henüz yayıncı yok</Text>
            ) : (
              profil.yayincilar.map((y) => (
                <Pressable
                  key={y.user_id}
                  style={styles.yayinciKart}
                  onPress={() => router.push(`/kullanici/${y.user_id}` as any)}
                >
                  {MedyaUriGuvenli(y.avatar_url) ? (
                    <Image
                      source={{ uri: MedyaUriGuvenli(y.avatar_url)! }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarBos]}>
                      <Ionicons
                        name="person"
                        size={18}
                        color={RenkTokenlari.textDim}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.yayinciAd}>
                      {y.display_name || y.username || 'Yayıncı'}
                    </Text>
                    <Text style={styles.yayinciAlt}>
                      Yayın {dakikaMetni(y.yayin_dakika)} · Ses{' '}
                      {dakikaMetni(y.ses_dakika)}
                    </Text>
                    <Text style={styles.yayinciAlt}>
                      Kazanç {sayi(y.kazanc_elmas)} elmas · Haftalık{' '}
                      {kisa(y.haftalik_coin)} coin
                    </Text>
                    <Text style={styles.yayinciAlt}>
                      Oyun {sayi(y.oyun_oturum)} · +{kisa(y.oyun_kazanc_coin)}{' '}
                      coin
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={RenkTokenlari.textDim}
                  />
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
        <HesabiTamamlaKarti
          visible={upgradeAcik}
          onClose={upgradeKapat}
          onCompleted={() => {
            void refreshProfile();
            void refreshWallet();
          }}
        />
      </ModulHataSiniri>
    </Screen>
  );
}

function StatKutu({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <View style={styles.statKutu}>
      <Text style={styles.statDeger}>{deger}</Text>
      <Text style={styles.statEtiket}>{etiket}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  heroWrap: {
    marginHorizontal: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgCard,
  },
  banner: { width: '100%', height: 120 },
  bannerFade: {
    ...StyleSheet.absoluteFill,
    top: 40,
    height: 80,
  },
  heroGovde: {
    padding: BoslukTokenlari.lg,
    paddingTop: 0,
    marginTop: -36,
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: RenkTokenlari.bgCard,
    backgroundColor: RenkTokenlari.surface,
  },
  logoBos: { alignItems: 'center', justifyContent: 'center' },
  ad: {
    ...TipografiTokenlari.title,
    fontSize: 24,
    color: RenkTokenlari.text,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  slogan: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    textAlign: 'center',
  },
  meta: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
  },
  ajansNoSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 8,
  },
  kopyaBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  desc: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  yonetBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RenkTokenlari.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
  },
  yonetYazi: {
    ...TipografiTokenlari.caption,
    color: '#12040C',
    fontWeight: '800',
  },
  bekleyenBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.pill,
  },
  bekleyenYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
  },
  baskaUyari: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginHorizontal: BoslukTokenlari.lg,
    marginTop: BoslukTokenlari.sm,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.lg,
  },
  statKutu: {
    width: '47%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    gap: 2,
  },
  statDeger: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  statEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  yayinciKart: {
    marginHorizontal: BoslukTokenlari.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RenkTokenlari.surface,
  },
  avatarBos: { alignItems: 'center', justifyContent: 'center' },
  yayinciAd: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  yayinciAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    paddingVertical: BoslukTokenlari.xl,
  },
});
