import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  AjansCoinTransfer,
  AjansKurallariKaydet,
  AjansOdemeMesajiOlustur,
  AjansOdemeSablonuKaydet,
  AjansPanelDetayGetir,
  AjansSil,
  LimitKalan,
  type AjansPanelDetay,
} from '../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import {
  KullanicilariAra,
  type ArananKullanici,
} from '../../src/moduller/mesajlasma/okuma/KullanicilariAra';
import {
  MesajGonder,
  OzelSohbetAcVeyaGetir,
} from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function sayi(n: number) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function uuidYerel() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function LimitCubugu({
  label,
  kullanilan,
  limit,
  unlimited,
}: {
  label: string;
  kullanilan: number;
  limit: number;
  unlimited?: boolean;
}) {
  if (unlimited) {
    return (
      <View style={styles.limitKart}>
        <View style={styles.limitSatir}>
          <Text style={styles.limitLabel}>{label}</Text>
          <Text style={[styles.limitDeger, { color: RenkTokenlari.mint }]}>
            Sınırsız
          </Text>
        </View>
        <Text style={styles.limitKalan}>
          Kullanılan: {sayi(kullanilan)} (üst sınır yok)
        </Text>
      </View>
    );
  }
  const oran = limit > 0 ? Math.min(1, kullanilan / limit) : 0;
  return (
    <View style={styles.limitKart}>
      <View style={styles.limitSatir}>
        <Text style={styles.limitLabel}>{label}</Text>
        <Text style={styles.limitDeger}>
          {sayi(kullanilan)} / {sayi(limit)}
        </Text>
      </View>
      <View style={styles.cubukBg}>
        <View
          style={[
            styles.cubukDolgu,
            {
              width: `${oran * 100}%`,
              backgroundColor:
                oran > 0.85 ? RenkTokenlari.danger : RenkTokenlari.mint,
            },
          ]}
        />
      </View>
      <Text style={styles.limitKalan}>
        Kalan {sayi(LimitKalan(limit, kullanilan))}
      </Text>
    </View>
  );
}

export default function AjansPanelEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [detay, setDetay] = useState<AjansPanelDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [coin, setCoin] = useState('');
  const [arama, setArama] = useState('');
  const [sonuclar, setSonuclar] = useState<ArananKullanici[]>([]);
  const [secili, setSecili] = useState<ArananKullanici | null>(null);
  const [kurallar, setKurallar] = useState('');
  const [holder, setHolder] = useState('');
  const [banka, setBanka] = useState('');
  const [iban, setIban] = useState('');
  const [telefon, setTelefon] = useState('');
  const [odemeNot, setOdemeNot] = useState('');
  const [odemeArama, setOdemeArama] = useState('');
  const [odemeSonuclar, setOdemeSonuclar] = useState<ArananKullanici[]>([]);
  const [odemeSecili, setOdemeSecili] = useState<ArananKullanici | null>(null);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AjansPanelDetayGetir(id);
      setDetay(d);
      setKurallar(d.rules?.body ?? '');
      setHolder(d.payment_template?.account_holder ?? '');
      setBanka(d.payment_template?.bank_name ?? '');
      setIban(d.payment_template?.iban ?? '');
      setTelefon(d.payment_template?.phone ?? '');
      setOdemeNot(d.payment_template?.note ?? '');
    } catch (e) {
      Alert.alert(
        'Ajans',
        e instanceof Error ? e.message : 'Panel yüklenemedi (migration 067?)',
      );
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  useEffect(() => {
    const q = arama.trim();
    if (q.length < 1) {
      setSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          setSonuclar(
            await KullanicilariAra({
              sorgu: q,
              haricUserId: user?.id,
              limit: 12,
            }),
          );
        } catch {
          setSonuclar([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [arama, user?.id]);

  useEffect(() => {
    const q = odemeArama.trim();
    if (q.length < 1) {
      setOdemeSonuclar([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          setOdemeSonuclar(
            await KullanicilariAra({
              sorgu: q,
              haricUserId: user?.id,
              limit: 12,
            }),
          );
        } catch {
          setOdemeSonuclar([]);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [odemeArama, user?.id]);

  const bakiye = detay?.wallet?.distribution_balance ?? 0;
  const limits = detay?.limits;
  const unlimited = Boolean(limits?.unlimited);
  const sahibi = detay?.agency.owner_id === user?.id;

  const hizliCoin = useMemo(() => [1000, 5000, 10000, 25000], []);

  const yukleCoin = () => {
    if (!id || !secili) {
      Alert.alert('Yükleme', 'Kullanıcı seç.');
      return;
    }
    const n = Math.floor(Number(coin));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Yükleme', 'Geçerli coin miktarı gir.');
      return;
    }
    if (!detay?.agency.is_coin_distributor) {
      Alert.alert(
        'Yetki yok',
        'Ajansın henüz coin dağıtıcı değil. Admin onayı gerekir.',
      );
      return;
    }
    Alert.alert(
      'Coin yükle',
      `${secili.display_name || secili.username} hesabına ${sayi(n)} coin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Yükle',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AjansCoinTransfer({
                agencyId: id,
                toUserId: secili.id,
                coins: n,
                idempotencyKey: uuidYerel(),
              });
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Yükleme', r.hata ?? 'Başarısız');
                return;
              }
              Alert.alert('Tamam', 'Coin yüklendi.');
              setCoin('');
              setSecili(null);
              setArama('');
              await yukle();
            })();
          },
        },
      ],
    );
  };

  const kurallariKaydet = () => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansKurallariKaydet({ agencyId: id, body: kurallar });
      setBusy(false);
      if (!r.ok) Alert.alert('Kurallar', r.hata);
      else {
        Alert.alert('Tamam', 'Kurallar kaydedildi.');
        await yukle();
      }
    })();
  };

  const odemeKaydet = () => {
    if (!id) return;
    void (async () => {
      setBusy(true);
      const r = await AjansOdemeSablonuKaydet({
        agencyId: id,
        accountHolder: holder,
        bankName: banka,
        iban,
        phone: telefon,
        note: odemeNot,
      });
      setBusy(false);
      if (!r.ok) Alert.alert('Ödeme bilgisi', r.hata);
      else {
        Alert.alert('Tamam', 'Ödeme şablonu kaydedildi.');
        await yukle();
      }
    })();
  };

  const odemeGonder = () => {
    if (!odemeSecili) {
      Alert.alert('Mesaj', 'Alıcı kullanıcı seç.');
      return;
    }
    const tpl = detay?.payment_template;
    if (!tpl?.iban) {
      Alert.alert('Mesaj', 'Önce ödeme şablonunu kaydet.');
      return;
    }
    const body = AjansOdemeMesajiOlustur(tpl, detay?.agency.name);
    Alert.alert(
      'Ödeme bilgisi gönder',
      `${odemeSecili.display_name || odemeSecili.username} kullanıcısına IBAN mesajı gitsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönder',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const sohbet = await OzelSohbetAcVeyaGetir(odemeSecili.id);
              if (!sohbet.ok) {
                setBusy(false);
                Alert.alert('Mesaj', sohbet.hata);
                return;
              }
              const msg = await MesajGonder({
                threadId: sohbet.threadId,
                body,
                clientId: uuidYerel(),
              });
              setBusy(false);
              if (!msg.ok) {
                Alert.alert('Mesaj', msg.hata);
                return;
              }
              Alert.alert('Gönderildi', 'Ödeme bilgisi mesaj olarak iletildi.', [
                {
                  text: 'Sohbete git',
                  onPress: () =>
                    router.push(`/mesaj/${sohbet.threadId}` as any),
                },
                { text: 'Tamam' },
              ]);
              setOdemeSecili(null);
              setOdemeArama('');
            })();
          },
        },
      ],
    );
  };

  const ajansiSil = () => {
    if (!id) return;
    Alert.alert(
      'Ajansı sil',
      'Ajans kapatılacak, coin dağıtımı duracak. Emin misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              const r = await AjansSil(id);
              setBusy(false);
              if (!r.ok) {
                Alert.alert('Silme', r.hata);
                return;
              }
              Alert.alert('Kapatıldı', 'Ajans kapatıldı.');
              router.replace('/ajans' as any);
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri modulAdi="ajans-panel" varyant="ekran" fallbackHref="/ajans">
        <EkranBasligi
          title={detay?.agency.name ?? 'Ajans Yönetim'}
          subtitle="Kurallar · ödeme · coin"
          fallbackHref={"/ajans/yonetim" as any}
        />
        {yukleniyor && !detay ? (
          <ActivityIndicator
            color={RenkTokenlari.primarySoft}
            style={{ marginTop: 40 }}
          />
        ) : !detay ? (
          <Text style={styles.bos}>Ajans bulunamadı</Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={yukleniyor || busy}
                onRefresh={() => void yukle()}
                tintColor={RenkTokenlari.primarySoft}
              />
            }
            keyboardShouldPersistTaps="handled"
          >
            <LinearGradient
              colors={['#1F1630', '#121018']}
              style={styles.hero}
            >
              <Text style={styles.heroEyebrow}>
                {detay.agency.agency_public_id} · {detay.agency.level_code}
              </Text>
              <Text style={styles.heroBakiye}>{sayi(bakiye)}</Text>
              <Text style={styles.heroAlt}>Dağıtım bakiyesi (coin)</Text>
              <View style={styles.heroChipSatir}>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>
                    {detay.agency.is_coin_distributor
                      ? 'Dağıtıcı açık'
                      : 'Dağıtıcı kapalı'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>
                    {unlimited ? 'Sınırsız limit' : 'Limitli'}
                  </Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>{detay.agency.status}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipYazi}>
                    Davet {detay.agency.invite_code ?? '—'}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <Text style={styles.bolum}>Limit kullanımı</Text>
            {limits ? (
              <>
                <LimitCubugu
                  label="Günlük"
                  kullanilan={detay.kullanim.gunluk_transfer}
                  limit={limits.daily_limit}
                  unlimited={unlimited}
                />
                <LimitCubugu
                  label="Aylık"
                  kullanilan={detay.kullanim.aylik_transfer}
                  limit={limits.monthly_limit}
                  unlimited={unlimited}
                />
                {!unlimited ? (
                  <View style={styles.limitKart}>
                    <Text style={styles.limitLabel}>Tek sefer / kişi başı</Text>
                    <Text style={styles.limitDeger}>
                      {sayi(limits.single_transfer_limit)} ·{' '}
                      {sayi(limits.per_user_limit)}
                    </Text>
                    <Text style={styles.limitKalan}>
                      Limit yükseltme admin panelinden (sınırsız / limitli)
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {sahibi ? (
              <>
                <Text style={styles.bolum}>Ajans kuralları</Text>
                <View style={styles.kart}>
                  <TextInput
                    value={kurallar}
                    onChangeText={setKurallar}
                    placeholder="Host ve üye kuralları…"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={[styles.input, styles.area]}
                    multiline
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={kurallariKaydet}
                    disabled={busy}
                  >
                    <Text style={styles.ctaYazi}>Kuralları kaydet</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Ödeme bilgisi (IBAN şablonu)</Text>
                <View style={styles.kart}>
                  <TextInput
                    value={holder}
                    onChangeText={setHolder}
                    placeholder="İsim soyisim (hesap sahibi)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={banka}
                    onChangeText={setBanka}
                    placeholder="Banka adı"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={iban}
                    onChangeText={setIban}
                    placeholder="IBAN"
                    autoCapitalize="characters"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={telefon}
                    onChangeText={setTelefon}
                    placeholder="Telefon"
                    keyboardType="phone-pad"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <TextInput
                    value={odemeNot}
                    onChangeText={setOdemeNot}
                    placeholder="Ek not (isteğe bağlı)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.ctaGhost, busy && styles.ctaDisabled]}
                    onPress={odemeKaydet}
                    disabled={busy}
                  >
                    <Text style={styles.ctaGhostYazi}>Şablonu kaydet</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Tek tıkla ödeme mesajı</Text>
                <View style={styles.kart}>
                  <Text style={styles.hint}>
                    Kayıtlı IBAN / banka bilgisini seçilen kullanıcıya DM olarak
                    gönder.
                  </Text>
                  <TextInput
                    value={odemeArama}
                    onChangeText={(t) => {
                      setOdemeArama(t);
                      setOdemeSecili(null);
                    }}
                    placeholder="Alıcı ara (@ veya isim)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  {odemeSecili ? (
                    <View style={styles.secili}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={RenkTokenlari.mint}
                      />
                      <Text style={styles.seciliYazi}>
                        {odemeSecili.display_name || odemeSecili.username}
                      </Text>
                    </View>
                  ) : (
                    odemeSonuclar.slice(0, 6).map((k) => (
                      <Pressable
                        key={k.id}
                        style={styles.aramaSatir}
                        onPress={() => {
                          setOdemeSecili(k);
                          setOdemeArama(k.display_name || k.username || '');
                          setOdemeSonuclar([]);
                        }}
                      >
                        <Text style={styles.aramaAd}>
                          {k.display_name || k.username}
                        </Text>
                        <Text style={styles.aramaAlt}>
                          {k.public_user_id || k.username}
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={odemeGonder}
                    disabled={busy}
                  >
                    <Ionicons name="send" size={16} color="#12040C" />
                    <Text style={styles.ctaYazi}> Ödeme bilgisini gönder</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Kullanıcıya coin yükle</Text>
                <View style={styles.kart}>
                  <TextInput
                    value={arama}
                    onChangeText={(t) => {
                      setArama(t);
                      setSecili(null);
                    }}
                    placeholder="Kullanıcı ara (@ veya isim)"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  {secili ? (
                    <View style={styles.secili}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={RenkTokenlari.mint}
                      />
                      <Text style={styles.seciliYazi}>
                        {secili.display_name || secili.username}
                      </Text>
                    </View>
                  ) : (
                    sonuclar.slice(0, 6).map((k) => (
                      <Pressable
                        key={k.id}
                        style={styles.aramaSatir}
                        onPress={() => {
                          setSecili(k);
                          setArama(k.display_name || k.username || '');
                          setSonuclar([]);
                        }}
                      >
                        <Text style={styles.aramaAd}>
                          {k.display_name || k.username}
                        </Text>
                        <Text style={styles.aramaAlt}>
                          {k.public_user_id || k.username}
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <View style={styles.hizliSatir}>
                    {hizliCoin.map((n) => (
                      <Pressable
                        key={n}
                        style={styles.hizli}
                        onPress={() => setCoin(String(n))}
                      >
                        <Text style={styles.hizliYazi}>{sayi(n)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={coin}
                    onChangeText={setCoin}
                    keyboardType="number-pad"
                    placeholder="Coin miktarı"
                    placeholderTextColor={RenkTokenlari.textDim}
                    style={styles.input}
                  />
                  <Pressable
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={yukleCoin}
                    disabled={busy}
                  >
                    <Text style={styles.ctaYazi}>Coin yükle</Text>
                  </Pressable>
                </View>

                <Text style={styles.bolum}>Tehlikeli alan</Text>
                <Pressable
                  style={[styles.ctaDanger, busy && styles.ctaDisabled]}
                  onPress={ajansiSil}
                  disabled={busy}
                >
                  <Text style={styles.ctaDangerYazi}>Ajansı sil / kapat</Text>
                </Pressable>
              </>
            ) : null}

            <Text style={styles.bolum}>Son yüklemeler</Text>
            {(detay.son_transferler ?? []).length === 0 ? (
              <Text style={styles.bos}>Henüz transfer yok</Text>
            ) : (
              detay.son_transferler.map((t) => (
                <View key={t.id} style={styles.txKart}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txAd}>{t.to_name}</Text>
                    <Text style={styles.txAlt}>
                      {new Date(t.created_at).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                  <Text style={styles.txCoin}>+{sayi(t.coins)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
  hero: {
    borderRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    gap: 6,
  },
  heroEyebrow: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  heroBakiye: {
    ...TipografiTokenlari.title,
    fontSize: 40,
    color: RenkTokenlari.text,
  },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  heroChipSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginTop: BoslukTokenlari.sm,
  },
  limitKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  limitSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  limitDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  cubukBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.surface,
    overflow: 'hidden',
  },
  cubukDolgu: { height: '100%', borderRadius: 999 },
  limitKalan: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
  kart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: BoslukTokenlari.sm,
  },
  hint: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
  },
  input: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    backgroundColor: RenkTokenlari.surface,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 12,
  },
  area: { minHeight: 120 },
  aramaSatir: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  aramaAd: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  aramaAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  secili: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  seciliYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  hizliSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hizli: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  hizliYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  cta: {
    marginTop: 4,
    backgroundColor: RenkTokenlari.primary,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ctaGhost: {
    marginTop: 4,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  ctaGhostYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  ctaDanger: {
    marginTop: 4,
    borderRadius: YaricapTokenlari.pill,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,80,80,0.12)',
    borderWidth: 1,
    borderColor: RenkTokenlari.danger,
  },
  ctaDangerYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.danger,
    fontWeight: '800',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaYazi: {
    ...TipografiTokenlari.body,
    color: '#12040C',
    fontWeight: '800',
  },
  txKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  txAd: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '600' },
  txAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim },
  txCoin: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.mint,
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    paddingVertical: BoslukTokenlari.xl,
  },
});
