import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { EkranBasligi } from '../../src/components/EkranBasligi';
import { useAuth } from '../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminCanliSesOdalari,
  AdminSesOdasiKapat,
  AdminSesOdasiKapatVeYaptirim,
  AdminOrnekSesOdalariDoldur,
  AdminOrnekSesOdalariKapat,
  AdminOdaUyeleri,
  COIN_CEZA_HIZLI,
  SureMetni,
  SureSaatEtiket,
  YAPTIRIM_SURE_SECENEKLERI,
  type AdminOdaUyesi,
} from '../../src/moduller/admin/ses-odalari/AdminSesOdasiIslemleri';
import {
  AdminCanliYayinKapat,
  AdminCanliYayinKapatVeYaptirim,
  AdminCanliYayinlari,
  AdminYayinKatilimcilari,
  type AdminCanliYayin,
  type AdminYayinKatilimci,
} from '../../src/moduller/admin/canli-yayin/AdminCanliYayinIslemleri';
import type { AdminCanliOda } from '../../src/moduller/admin/tipler/PlatformTipleri';
import {
  AdminAktifGorusmeleriGetir,
  AdminGorusmeKapatVeYaptirim,
  type AdminAktifGorusme,
} from '../../src/moduller/gorusme/islemler/GorusmeIslemleri';
import { AdminStil, SayiKisa } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Katilimci = AdminOdaUyesi | AdminYayinKatilimci;

type PanelTur = 'oda' | 'yayin' | 'gorusme';

type PanelDurum = {
  tur: PanelTur;
  baslik: string;
  alt: string;
  hostId: string;
  oda?: AdminCanliOda;
  yayin?: AdminCanliYayin;
  gorusme?: AdminAktifGorusme;
  sebep: string;
  coin: string;
  ihtar: boolean;
  uploadHours: number | null;
  roomHours: number | null;
  hesapBan: boolean;
  hesapBanHours: number;
  uyeler: Katilimci[];
  secilen: string[];
  uyelerYukleniyor: boolean;
};

function SureChip({
  secili,
  label,
  onPress,
}: {
  secili: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, secili && styles.chipSecili]}
    >
      <Text style={[styles.chipYazi, secili && styles.chipYaziSecili]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AdminOdalarEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const [odalar, setOdalar] = useState<AdminCanliOda[]>([]);
  const [yayinlar, setYayinlar] = useState<AdminCanliYayin[]>([]);
  const [gorusmeler, setGorusmeler] = useState<AdminAktifGorusme[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [panel, setPanel] = useState<PanelDurum | null>(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [o, y, g] = await Promise.all([
        AdminCanliSesOdalari(50),
        AdminCanliYayinlari(50).catch(() => [] as AdminCanliYayin[]),
        AdminAktifGorusmeleriGetir(40).catch(() => [] as AdminAktifGorusme[]),
      ]);
      setOdalar(o);
      setYayinlar(y);
      setGorusmeler(g);
    } catch (e) {
      Alert.alert('Odalar', e instanceof Error ? e.message : 'Liste alınamadı');
      setOdalar([]);
      setYayinlar([]);
      setGorusmeler([]);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
      const id = setInterval(() => setTick((n) => n + 1), 30_000);
      return () => clearInterval(id);
    }, [admin, yukle]),
  );

  if (!admin) return null;

  const sadeceKapat = (oda: AdminCanliOda) => {
    Alert.alert(
      'Odayı kapat',
      `"${oda.title}" feed’den düşer, üyeler dağıtılır. Yaptırım yok.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await AdminSesOdasiKapat(oda.id);
                await yukle();
                Alert.alert('Tamam', 'Oda kapatıldı · feed’den kaldırıldı.');
              } catch (e) {
                Alert.alert(
                  'Hata',
                  e instanceof Error ? e.message : 'Kapatılamadı',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const yayinSadeceKapat = (y: AdminCanliYayin) => {
    Alert.alert(
      'Yayını kapat',
      `"${y.title}" feed’den düşer, izleyiciler çıkar.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await AdminCanliYayinKapat(y.id);
                await yukle();
                Alert.alert('Tamam', 'Yayın kapatıldı · feed’den kaldırıldı.');
              } catch (e) {
                Alert.alert(
                  'Hata',
                  e instanceof Error ? e.message : 'Kapatılamadı',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const gorusmeSadeceKapat = (g: AdminAktifGorusme) => {
    Alert.alert(
      'Görüşmeyi bitir',
      `${g.caller_name} ↔ ${g.callee_name} · yaptırım yok.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Bitir',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const r = await AdminGorusmeKapatVeYaptirim(g.id, {
                reason: 'Admin tarafından sonlandırıldı',
              });
              if (!r.ok) {
                Alert.alert('Hata', r.hata ?? 'Bitirilemedi');
                return;
              }
              await yukle();
              Alert.alert('Tamam', 'Görüşme sonlandırıldı.');
            })();
          },
        },
      ],
    );
  };

  const panelAcOda = (oda: AdminCanliOda) => {
    setPanel({
      tur: 'oda',
      baslik: oda.title,
      alt: `${oda.host_name} · ${SureMetni(oda.created_at)}`,
      hostId: oda.host_id,
      oda,
      sebep: '',
      coin: '',
      ihtar: true,
      uploadHours: null,
      roomHours: null,
      hesapBan: false,
      hesapBanHours: -1,
      uyeler: [],
      secilen: [oda.host_id],
      uyelerYukleniyor: true,
    });
    void (async () => {
      try {
        const u = await AdminOdaUyeleri(oda.id);
        setPanel((p) =>
          p && p.tur === 'oda' && p.oda?.id === oda.id
            ? {
                ...p,
                uyeler: u,
                secilen: u.some((x) => x.user_id === oda.host_id)
                  ? [oda.host_id]
                  : u[0]
                    ? [u[0].user_id]
                    : [oda.host_id],
                uyelerYukleniyor: false,
              }
            : p,
        );
      } catch {
        setPanel((p) =>
          p && p.tur === 'oda' && p.oda?.id === oda.id
            ? {
                ...p,
                uyeler: [
                  {
                    user_id: oda.host_id,
                    role: 'host',
                    display_name: oda.host_name,
                    username: oda.host_username ?? null,
                    is_host: true,
                  },
                ],
                uyelerYukleniyor: false,
              }
            : p,
        );
      }
    })();
  };

  const panelAcYayin = (y: AdminCanliYayin) => {
    setPanel({
      tur: 'yayin',
      baslik: y.title,
      alt: `${y.host_name} · ${SureMetni(y.started_at)}`,
      hostId: y.host_id,
      yayin: y,
      sebep: '',
      coin: '',
      ihtar: true,
      uploadHours: null,
      roomHours: null,
      hesapBan: false,
      hesapBanHours: -1,
      uyeler: [],
      secilen: [y.host_id],
      uyelerYukleniyor: true,
    });
    void (async () => {
      try {
        const u = await AdminYayinKatilimcilari(y.id);
        setPanel((p) =>
          p && p.tur === 'yayin' && p.yayin?.id === y.id
            ? {
                ...p,
                uyeler: u,
                secilen: [y.host_id],
                uyelerYukleniyor: false,
              }
            : p,
        );
      } catch {
        setPanel((p) =>
          p && p.tur === 'yayin' && p.yayin?.id === y.id
            ? {
                ...p,
                uyeler: [
                  {
                    user_id: y.host_id,
                    role: 'host',
                    display_name: y.host_name,
                    username: y.host_username ?? null,
                    is_host: true,
                  },
                ],
                uyelerYukleniyor: false,
              }
            : p,
        );
      }
    })();
  };

  const panelAcGorusme = (g: AdminAktifGorusme) => {
    const sureBas = g.answered_at ?? g.started_at;
    setPanel({
      tur: 'gorusme',
      baslik: `${g.call_type === 'video' ? 'Görüntülü' : 'Sesli'} görüşme`,
      alt: `${g.caller_name} ↔ ${g.callee_name} · ${SureMetni(sureBas)}`,
      hostId: g.caller_id,
      gorusme: g,
      sebep: '',
      coin: '',
      ihtar: true,
      uploadHours: null,
      roomHours: null,
      hesapBan: false,
      hesapBanHours: -1,
      uyeler: [
        {
          user_id: g.caller_id,
          role: 'caller',
          display_name: g.caller_name,
          username: g.caller_username ?? null,
          is_host: true,
        },
        {
          user_id: g.callee_id,
          role: 'callee',
          display_name: g.callee_name,
          username: g.callee_username ?? null,
          is_host: false,
        },
      ],
      secilen: [g.caller_id, g.callee_id],
      uyelerYukleniyor: false,
    });
  };

  const secimToggle = (userId: string) => {
    setPanel((p) => {
      if (!p) return p;
      const varMi = p.secilen.includes(userId);
      if (varMi && p.secilen.length <= 1) return p;
      return {
        ...p,
        secilen: varMi
          ? p.secilen.filter((id) => id !== userId)
          : [...p.secilen, userId],
      };
    });
  };

  const yaptirimliKapat = () => {
    if (!panel) return;
    const coinN = Math.floor(Number(panel.coin) || 0);
    const yaptirimVar =
      coinN > 0 ||
      panel.ihtar ||
      panel.uploadHours != null ||
      panel.roomHours != null ||
      panel.hesapBan;

    if (yaptirimVar && !panel.sebep.trim()) {
      Alert.alert('Sebep', 'Yaptırım için kısa bir sebep yaz.');
      return;
    }
    if (yaptirimVar && panel.secilen.length === 0) {
      Alert.alert('Hedef', 'En az bir kullanıcı seç.');
      return;
    }

    const ozet = [
      panel.tur === 'oda'
        ? 'Oda feed’den kaldırılacak'
        : panel.tur === 'yayin'
          ? 'Yayın kapatılacak'
          : 'Görüşme sonlandırılacak',
      yaptirimVar
        ? `Hedef: ${panel.secilen.length} kullanıcı`
        : 'Yaptırım yok (sadece kapat)',
      coinN > 0 ? `Coin cezası: −${coinN.toLocaleString('tr-TR')}` : null,
      panel.ihtar ? 'İhtar' : null,
      panel.uploadHours != null
        ? `Yükleme cezası: ${SureSaatEtiket(panel.uploadHours)}`
        : null,
      panel.roomHours != null
        ? `Oda açma yasağı: ${SureSaatEtiket(panel.roomHours)}`
        : null,
      panel.hesapBan
        ? `Hesap banı: ${SureSaatEtiket(panel.hesapBanHours)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    Alert.alert('Onayla', ozet, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              const girdi = {
                reason: panel.sebep.trim() || undefined,
                coin_penalty: coinN > 0 ? coinN : undefined,
                warning: panel.ihtar,
                upload_ban_hours: panel.uploadHours ?? undefined,
                room_create_ban_hours: panel.roomHours ?? undefined,
                account_ban: panel.hesapBan,
                account_ban_hours: panel.hesapBan
                  ? panel.hesapBanHours
                  : undefined,
                target_user_ids: yaptirimVar ? panel.secilen : undefined,
              };

              if (panel.tur === 'oda' && panel.oda) {
                await AdminSesOdasiKapatVeYaptirim(panel.oda.id, girdi);
              } else if (panel.tur === 'yayin' && panel.yayin) {
                await AdminCanliYayinKapatVeYaptirim(panel.yayin.id, girdi);
              } else if (panel.tur === 'gorusme' && panel.gorusme) {
                const r = await AdminGorusmeKapatVeYaptirim(
                  panel.gorusme.id,
                  girdi,
                );
                if (!r.ok) throw new Error(r.hata ?? 'İşlem başarısız');
              }

              setPanel(null);
              await yukle();
              Alert.alert('Tamam', 'Kapatıldı · yaptırımlar uygulandı.');
            } catch (e) {
              Alert.alert(
                'Hata',
                e instanceof Error ? e.message : 'İşlem başarısız',
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Canlı odalar"
        subtitle="Ses · yayın · görüşme · süre · yaptırım"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
            tintColor={RenkTokenlari.primarySoft}
          />
        }
      >
        <Text style={AdminStil.kartAlt}>
          Kapatırken host + seçilen kullanıcıya coin / ihtar / yükleme-oda
          yasağı / gün·hafta·ay·yıl hesap banı uygulayabilirsin. Süreler anlık.
        </Text>

        <View style={styles.ornekKutu}>
          <Text style={styles.ornekBaslik}>Örnek ses odaları</Text>
          <Text style={styles.ornekNot}>
            Bunlar örnektir — gerçek kullanıcı odası değildir.
          </Text>
          <View style={styles.ornekAksiyon}>
            <Pressable
              style={styles.ornekBtn}
              disabled={busy}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  const r = await AdminOrnekSesOdalariDoldur();
                  setBusy(false);
                  if (!r.ok) {
                    Alert.alert('Örnek odalar', r.hata ?? 'Eklenemedi');
                    return;
                  }
                  await yukle();
                  Alert.alert(
                    'Örnek odalar',
                    `${r.oda_sayisi ?? 0} örnek oda eklendi.`,
                  );
                })();
              }}
            >
              <Text style={styles.ornekBtnYazi}>Örnekleri doldur</Text>
            </Pressable>
            <Pressable
              style={styles.ornekKapatBtn}
              disabled={busy}
              onPress={() => {
                Alert.alert(
                  'Örnek odaları kapat',
                  'Tüm örnek canlı odalar feed’den düşsün mü?',
                  [
                    { text: 'Vazgeç', style: 'cancel' },
                    {
                      text: 'Kapat',
                      style: 'destructive',
                      onPress: () => {
                        void (async () => {
                          setBusy(true);
                          const r = await AdminOrnekSesOdalariKapat();
                          setBusy(false);
                          if (!r.ok) {
                            Alert.alert(
                              'Örnek odalar',
                              r.hata ?? 'Kapatılamadı',
                            );
                            return;
                          }
                          await yukle();
                          Alert.alert(
                            'Kapatıldı',
                            `${r.kapatilan ?? 0} örnek oda kapatıldı.`,
                          );
                        })();
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.ornekKapatYazi}>Örnekleri kapat</Text>
            </Pressable>
          </View>
        </View>

        <Text style={AdminStil.sectionLabel}>Ses odaları</Text>
        {yukleniyor && !odalar.length && !yayinlar.length && !gorusmeler.length ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !odalar.length ? (
          <Text style={AdminStil.bos}>Şu an canlı ses odası yok</Text>
        ) : (
          odalar.map((o) => (
            <View key={o.id} style={AdminStil.kart}>
              <View style={AdminStil.satir}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={AdminStil.kartBaslik}>{o.title}</Text>
                  <Text style={AdminStil.kartAlt}>
                    {o.host_name}
                    {o.host_username ? ` · @${o.host_username}` : ''}
                    {` · ${o.mode} · ${o.listener_count} dinleyici`}
                  </Text>
                  <Text style={styles.sureYazi}>
                    Açık: {SureMetni(o.created_at)}
                  </Text>
                </View>
                <View style={AdminStil.chip}>
                  <Text
                    style={[AdminStil.chipYazi, { color: RenkTokenlari.live }]}
                  >
                    SES
                  </Text>
                </View>
              </View>
              <View style={AdminStil.aksiyonSatir}>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => router.push(`/room/${o.id}` as any)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Gir</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => sadeceKapat(o)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Kapat</Text>
                </Pressable>
                <Pressable
                  style={[
                    AdminStil.aksiyon,
                    { borderColor: RenkTokenlari.danger },
                  ]}
                  onPress={() => panelAcOda(o)}
                >
                  <Text
                    style={[
                      AdminStil.aksiyonYazi,
                      { color: RenkTokenlari.danger },
                    ]}
                  >
                    Kapat + yaptırım
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={AdminStil.sectionLabel}>Canlı yayınlar</Text>
        {!yayinlar.length ? (
          <Text style={AdminStil.bos}>Şu an canlı yayın yok</Text>
        ) : (
          yayinlar.map((y) => (
            <View key={y.id} style={AdminStil.kart}>
              <View style={AdminStil.satir}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={AdminStil.kartBaslik}>{y.title}</Text>
                  <Text style={AdminStil.kartAlt}>
                    {y.host_name}
                    {y.host_username ? ` · @${y.host_username}` : ''}
                    {` · ${y.mode} · ${y.viewer_count} izleyici`}
                  </Text>
                  <Text style={styles.sureYazi}>
                    Açık: {SureMetni(y.started_at)}
                  </Text>
                </View>
                <View style={AdminStil.chip}>
                  <Text
                    style={[AdminStil.chipYazi, { color: RenkTokenlari.live }]}
                  >
                    CANLI
                  </Text>
                </View>
              </View>
              <View style={AdminStil.aksiyonSatir}>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => router.push(`/canli/${y.id}` as any)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Gir</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => yayinSadeceKapat(y)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Kapat</Text>
                </Pressable>
                <Pressable
                  style={[
                    AdminStil.aksiyon,
                    { borderColor: RenkTokenlari.danger },
                  ]}
                  onPress={() => panelAcYayin(y)}
                >
                  <Text
                    style={[
                      AdminStil.aksiyonYazi,
                      { color: RenkTokenlari.danger },
                    ]}
                  >
                    Kapat + yaptırım
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={AdminStil.sectionLabel}>Aktif görüşmeler</Text>
        {!gorusmeler.length ? (
          <Text style={AdminStil.bos}>Şu an aktif görüşme yok</Text>
        ) : (
          gorusmeler.map((g) => {
            const sureBas = g.answered_at ?? g.started_at;
            return (
              <View key={g.id} style={AdminStil.kart}>
                <View style={AdminStil.satir}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={AdminStil.kartBaslik}>
                      {g.caller_name} ↔ {g.callee_name}
                    </Text>
                    <Text style={AdminStil.kartAlt}>
                      {g.call_type === 'video' ? 'Görüntülü' : 'Sesli'}
                      {` · ${g.status}`}
                      {g.caller_username ? ` · @${g.caller_username}` : ''}
                    </Text>
                    <Text style={styles.sureYazi}>
                      {g.status === 'active' ? 'Süre' : 'Çalıyor'}:{' '}
                      {SureMetni(sureBas)}
                    </Text>
                  </View>
                  <View style={AdminStil.chip}>
                    <Text
                      style={[
                        AdminStil.chipYazi,
                        { color: RenkTokenlari.primarySoft },
                      ]}
                    >
                      {g.call_type === 'video' ? 'VIDEO' : 'SES'}
                    </Text>
                  </View>
                </View>
                <View style={AdminStil.aksiyonSatir}>
                  <Pressable
                    style={AdminStil.aksiyon}
                    onPress={() => gorusmeSadeceKapat(g)}
                  >
                    <Text style={AdminStil.aksiyonYazi}>Bitir</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      AdminStil.aksiyon,
                      { borderColor: RenkTokenlari.danger },
                    ]}
                    onPress={() => panelAcGorusme(g)}
                  >
                    <Text
                      style={[
                        AdminStil.aksiyonYazi,
                        { color: RenkTokenlari.danger },
                      ]}
                    >
                      Bitir + yaptırım
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!panel}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setPanel(null)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalKart}>
            <Text style={styles.modalBaslik}>Kapat + yaptırım</Text>
            <Text style={styles.modalAlt}>
              {panel?.baslik} · {panel?.alt}
            </Text>

            <ScrollView
              style={{ maxHeight: 460 }}
              contentContainerStyle={{ gap: 10 }}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={AdminStil.input}
                placeholder="Sebep (yaptırımda zorunlu)"
                placeholderTextColor={RenkTokenlari.textDim}
                value={panel?.sebep ?? ''}
                onChangeText={(t) =>
                  setPanel((p) => (p ? { ...p, sebep: t } : p))
                }
                editable={!busy}
              />

              <Text style={styles.bolum}>Hedef kullanıcılar</Text>
              {panel?.uyelerYukleniyor ? (
                <ActivityIndicator color={RenkTokenlari.primarySoft} />
              ) : (
                (panel?.uyeler ?? []).map((u) => {
                  const secili = panel?.secilen.includes(u.user_id);
                  return (
                    <Pressable
                      key={u.user_id}
                      style={[
                        styles.uyeSatir,
                        secili && styles.uyeSatirSecili,
                      ]}
                      onPress={() => secimToggle(u.user_id)}
                      disabled={busy}
                    >
                      <Text style={styles.uyeYazi}>
                        {secili ? '✓ ' : ''}
                        {u.display_name}
                        {u.username ? ` · @${u.username}` : ''}
                        {u.is_host ? ' · host' : ` · ${u.role}`}
                      </Text>
                    </Pressable>
                  );
                })
              )}

              <Text style={styles.bolum}>Coin cezası</Text>
              <View style={AdminStil.aksiyonSatir}>
                {COIN_CEZA_HIZLI.map((n) => (
                  <Pressable
                    key={n}
                    style={AdminStil.aksiyon}
                    onPress={() =>
                      setPanel((p) => (p ? { ...p, coin: String(n) } : p))
                    }
                    disabled={busy}
                  >
                    <Text style={AdminStil.aksiyonYazi}>{SayiKisa(n)}</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() =>
                    setPanel((p) => (p ? { ...p, coin: '' } : p))
                  }
                  disabled={busy}
                >
                  <Text style={AdminStil.aksiyonYazi}>Yok</Text>
                </Pressable>
              </View>
              <TextInput
                style={AdminStil.input}
                placeholder="Miktar (boş = yok)"
                placeholderTextColor={RenkTokenlari.textDim}
                value={panel?.coin ?? ''}
                onChangeText={(t) =>
                  setPanel((p) => (p ? { ...p, coin: t } : p))
                }
                keyboardType="number-pad"
                editable={!busy}
              />

              <Pressable
                style={[styles.toggle, panel?.ihtar && styles.toggleAcik]}
                onPress={() =>
                  setPanel((p) => (p ? { ...p, ihtar: !p.ihtar } : p))
                }
                disabled={busy}
              >
                <Text style={styles.toggleYazi}>
                  {panel?.ihtar ? '✓ ' : ''}İhtar kaydı
                </Text>
              </Pressable>

              <Text style={styles.bolum}>Yükleme cezası</Text>
              <View style={styles.chipSatir}>
                <SureChip
                  label="Yok"
                  secili={panel?.uploadHours == null}
                  onPress={() =>
                    setPanel((p) => (p ? { ...p, uploadHours: null } : p))
                  }
                />
                {YAPTIRIM_SURE_SECENEKLERI.map((s) => (
                  <SureChip
                    key={`u-${s.hours}`}
                    label={s.label}
                    secili={panel?.uploadHours === s.hours}
                    onPress={() =>
                      setPanel((p) =>
                        p ? { ...p, uploadHours: s.hours } : p,
                      )
                    }
                  />
                ))}
              </View>

              <Text style={styles.bolum}>Ses odası açma yasağı</Text>
              <View style={styles.chipSatir}>
                <SureChip
                  label="Yok"
                  secili={panel?.roomHours == null}
                  onPress={() =>
                    setPanel((p) => (p ? { ...p, roomHours: null } : p))
                  }
                />
                {YAPTIRIM_SURE_SECENEKLERI.map((s) => (
                  <SureChip
                    key={`r-${s.hours}`}
                    label={s.label}
                    secili={panel?.roomHours === s.hours}
                    onPress={() =>
                      setPanel((p) =>
                        p ? { ...p, roomHours: s.hours } : p,
                      )
                    }
                  />
                ))}
              </View>

              <Pressable
                style={[styles.toggle, panel?.hesapBan && styles.toggleTehlike]}
                onPress={() =>
                  setPanel((p) =>
                    p ? { ...p, hesapBan: !p.hesapBan } : p,
                  )
                }
                disabled={busy}
              >
                <Text
                  style={[
                    styles.toggleYazi,
                    panel?.hesapBan && { color: RenkTokenlari.danger },
                  ]}
                >
                  {panel?.hesapBan ? '✓ ' : ''}Hesabı banla
                </Text>
              </Pressable>

              {panel?.hesapBan ? (
                <>
                  <Text style={styles.bolum}>Ban süresi</Text>
                  <View style={styles.chipSatir}>
                    {YAPTIRIM_SURE_SECENEKLERI.map((s) => (
                      <SureChip
                        key={`b-${s.hours}`}
                        label={s.label}
                        secili={panel.hesapBanHours === s.hours}
                        onPress={() =>
                          setPanel((p) =>
                            p ? { ...p, hesapBanHours: s.hours } : p,
                          )
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalAksiyon}>
              <Pressable
                style={AdminStil.aksiyon}
                disabled={busy}
                onPress={() => setPanel(null)}
              >
                <Text style={AdminStil.aksiyonYazi}>Vazgeç</Text>
              </Pressable>
              <Pressable
                style={[
                  AdminStil.aksiyon,
                  {
                    borderColor: RenkTokenlari.danger,
                    flex: 1.4,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
                disabled={busy}
                onPress={yaptirimliKapat}
              >
                {busy ? (
                  <ActivityIndicator color={RenkTokenlari.danger} />
                ) : (
                  <Text
                    style={[
                      AdminStil.aksiyonYazi,
                      { color: RenkTokenlari.danger },
                    ]}
                  >
                    Kapat ve uygula
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalKart: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.lg,
    borderTopRightRadius: YaricapTokenlari.lg,
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    maxHeight: '92%',
  },
  modalBaslik: {
    ...TipografiTokenlari.titleSm,
    color: RenkTokenlari.text,
  },
  modalAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    marginBottom: 4,
  },
  bolum: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSecili: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  chipYaziSecili: {
    color: RenkTokenlari.primarySoft,
  },
  toggle: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    padding: BoslukTokenlari.sm,
  },
  toggleAcik: {
    borderColor: RenkTokenlari.primarySoft,
  },
  toggleTehlike: {
    borderColor: RenkTokenlari.danger,
  },
  toggleYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
  },
  uyeSatir: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  uyeSatirSecili: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  uyeYazi: {
    ...TipografiTokenlari.bodySm,
    color: RenkTokenlari.text,
  },
  sureYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    marginTop: 2,
  },
  modalAksiyon: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  ornekKutu: {
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    borderRadius: YaricapTokenlari.md,
    padding: BoslukTokenlari.md,
    gap: 8,
    marginBottom: BoslukTokenlari.sm,
  },
  ornekBaslik: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '600',
  },
  ornekNot: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
  },
  ornekAksiyon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ornekBtn: {
    borderWidth: 1,
    borderColor: RenkTokenlari.primarySoft,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ornekBtnYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
  },
  ornekKapatBtn: {
    borderWidth: 1,
    borderColor: RenkTokenlari.danger,
    borderRadius: YaricapTokenlari.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ornekKapatYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.danger,
  },
});
