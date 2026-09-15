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
  COIN_CEZA_HIZLI,
  YAPTIRIM_SURE_SECENEKLERI,
} from '../../src/moduller/admin/ses-odalari/AdminSesOdasiIslemleri';
import {
  AdminCanliYayinKapat,
  AdminCanliYayinlari,
} from '../../src/moduller/admin/canli-yayin/AdminCanliYayinIslemleri';
import type { AdminCanliOda } from '../../src/moduller/admin/tipler/PlatformTipleri';
import type { AdminCanliYayin } from '../../src/moduller/admin/canli-yayin/AdminCanliYayinIslemleri';
import { AdminStil, SayiKisa } from '../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type PanelDurum = {
  oda: AdminCanliOda;
  sebep: string;
  coin: string;
  ihtar: boolean;
  uploadHours: number | null;
  roomHours: number | null;
  hesapBan: boolean;
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
  const [yukleniyor, setYukleniyor] = useState(true);
  const [panel, setPanel] = useState<PanelDurum | null>(null);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [o, y] = await Promise.all([
        AdminCanliSesOdalari(50),
        AdminCanliYayinlari(50).catch(() => [] as AdminCanliYayin[]),
      ]);
      setOdalar(o);
      setYayinlar(y);
    } catch (e) {
      Alert.alert('Odalar', e instanceof Error ? e.message : 'Liste alınamadı');
      setOdalar([]);
      setYayinlar([]);
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
    }, [admin, yukle]),
  );

  if (!admin) return null;

  const sadeceKapat = (oda: AdminCanliOda) => {
    Alert.alert(
      'Odayı kapat',
      `"${oda.title}" feed’den düşer, üyeler dağıtılır. Host’a yaptırım yok.`,
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

  const yayinKapat = (y: AdminCanliYayin) => {
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

  const panelAc = (oda: AdminCanliOda) => {
    setPanel({
      oda,
      sebep: '',
      coin: '',
      ihtar: true,
      uploadHours: null,
      roomHours: null,
      hesapBan: false,
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

    const ozet = [
      'Oda feed’den kaldırılacak',
      coinN > 0 ? `Coin cezası: −${coinN.toLocaleString('tr-TR')}` : null,
      panel.ihtar ? 'İhtar' : null,
      panel.uploadHours != null
        ? `Yükleme cezası: ${
            panel.uploadHours < 0 ? 'kalıcı' : `${panel.uploadHours} sa`
          }`
        : null,
      panel.roomHours != null
        ? `Oda açma yasağı: ${
            panel.roomHours < 0 ? 'kalıcı' : `${panel.roomHours} sa`
          }`
        : null,
      panel.hesapBan ? 'Hesap banı' : null,
    ]
      .filter(Boolean)
      .join('\n');

    Alert.alert(`Kapat · ${panel.oda.host_name}`, ozet, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Onayla',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await AdminSesOdasiKapatVeYaptirim(panel.oda.id, {
                reason: panel.sebep.trim() || undefined,
                coin_penalty: coinN > 0 ? coinN : undefined,
                warning: panel.ihtar,
                upload_ban_hours: panel.uploadHours ?? undefined,
                room_create_ban_hours: panel.roomHours ?? undefined,
                account_ban: panel.hesapBan,
              });
              setPanel(null);
              await yukle();
              Alert.alert('Tamam', 'Oda kapatıldı · yaptırımlar uygulandı.');
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
        subtitle="Ses odası · yayın · kapat"
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
          Kapatınca içerik anında feed’den düşer. Ses odasında isteğe bağlı
          host yaptırımı da koyabilirsin.
        </Text>

        <Text style={AdminStil.sectionLabel}>Ses odaları</Text>
        {yukleniyor && !odalar.length && !yayinlar.length ? (
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
                  <Text style={AdminStil.aksiyonYazi}>Odaya git</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() =>
                    router.push(`/admin/kullanicilar/${o.host_id}` as any)
                  }
                >
                  <Text style={AdminStil.aksiyonYazi}>Host dosyası</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => sadeceKapat(o)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Sadece kapat</Text>
                </Pressable>
                <Pressable
                  style={[
                    AdminStil.aksiyon,
                    { borderColor: RenkTokenlari.danger },
                  ]}
                  onPress={() => panelAc(o)}
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

        <Text style={[AdminStil.sectionLabel, { marginTop: 16 }]}>
          Canlı yayınlar
        </Text>
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
                </View>
                <View style={AdminStil.chip}>
                  <Text
                    style={[AdminStil.chipYazi, { color: RenkTokenlari.live }]}
                  >
                    YAYIN
                  </Text>
                </View>
              </View>
              <View style={AdminStil.aksiyonSatir}>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() => router.push(`/canli/${y.id}` as any)}
                >
                  <Text style={AdminStil.aksiyonYazi}>Yayına git</Text>
                </Pressable>
                <Pressable
                  style={AdminStil.aksiyon}
                  onPress={() =>
                    router.push(`/admin/kullanicilar/${y.host_id}` as any)
                  }
                >
                  <Text style={AdminStil.aksiyonYazi}>Host dosyası</Text>
                </Pressable>
                <Pressable
                  style={[
                    AdminStil.aksiyon,
                    { borderColor: RenkTokenlari.danger },
                  ]}
                  onPress={() => yayinKapat(y)}
                >
                  <Text
                    style={[
                      AdminStil.aksiyonYazi,
                      { color: RenkTokenlari.danger },
                    ]}
                  >
                    Yayını kapat
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
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
              {panel?.oda.title} · {panel?.oda.host_name}
            </Text>

            <ScrollView
              style={{ maxHeight: 420 }}
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
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.xxl,
  },
  modalBaslik: {
    ...TipografiTokenlari.title,
    fontSize: 20,
    color: RenkTokenlari.text,
  },
  modalAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    marginBottom: 4,
  },
  bolum: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
    marginTop: 4,
  },
  chipSatir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  chipSecili: {
    borderColor: RenkTokenlari.primarySoft,
    backgroundColor: `${RenkTokenlari.primarySoft}22`,
  },
  chipYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
  chipYaziSecili: {
    color: RenkTokenlari.primarySoft,
  },
  toggle: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  toggleAcik: {
    borderColor: `${RenkTokenlari.mint}66`,
  },
  toggleTehlike: {
    borderColor: `${RenkTokenlari.danger}66`,
  },
  toggleYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  modalAksiyon: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
