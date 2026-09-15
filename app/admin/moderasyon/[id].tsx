import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { EkranBasligi } from '../../../src/components/EkranBasligi';
import { useAuth } from '../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import {
  AdminRaporDetayGetir,
  AdminRaporDurumGuncelle,
  AdminRaporIcerikKaldir,
} from '../../../src/moduller/admin/platform/AdminPlatformIslemleri';
import {
  AdminIhtarVer,
  AdminKullaniciBanKaldir,
  AdminKullaniciBanla,
  AdminKullaniciSil,
} from '../../../src/moduller/admin/kullanici/islemler/AdminKullaniciIslemleri';
import type { AdminRaporDetay } from '../../../src/moduller/admin/tipler/PlatformTipleri';
import {
  AdminStil,
  RaporDurumEtiketi,
} from '../../../src/moduller/admin/bilesenler/AdminStil';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

function kisiAd(k?: {
  display_name?: string | null;
  username?: string | null;
  id?: string;
} | null) {
  if (!k) return '—';
  return (
    k.display_name?.trim() ||
    (k.username ? `@${k.username}` : null) ||
    (k.id ? k.id.slice(0, 8) : '—')
  );
}

function icerikTurEtiket(tur?: string | null) {
  switch (tur) {
    case 'dm_message':
      return 'Özel mesaj';
    case 'room_chat':
      return 'Oda sohbeti';
    case 'live_chat':
      return 'Canlı yorum';
    case 'profile':
      return 'Profil';
    case 'room':
      return 'Oda';
    case 'user':
      return 'Kullanıcı';
    case 'status_post':
      return 'Durum gönderisi';
    case 'status_comment':
      return 'Durum yorumu';
    default:
      return tur || 'Genel';
  }
}

export default function AdminRaporDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);
  const { width, height } = useWindowDimensions();
  const [detay, setDetay] = useState<AdminRaporDetay | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uyari, setUyari] = useState('');
  const [not, setNot] = useState('');
  const [tamEkran, setTamEkran] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AdminRaporDetayGetir(id);
      setDetay(d);
      setNot(d.rapor.admin_note ?? '');
      setUyari(
        d.rapor.reason
          ? `Rapor nedeniyle uyarı: ${d.rapor.reason}`
          : 'Topluluk kurallarını ihlal ettin. Tekrarında hesabın kısıtlanabilir.',
      );
    } catch (e) {
      Alert.alert(
        'Rapor',
        e instanceof Error ? e.message : 'Detay yüklenemedi (migration 033?)',
      );
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

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

  const hedefId = detay?.target?.id ?? detay?.rapor.target_user_id ?? null;
  const mediaUrl = detay?.icerik.media_url ?? null;
  const metin =
    detay?.icerik.metin ||
    detay?.rapor.details ||
    (detay?.rapor.context as { body?: string } | null)?.body ||
    null;

  const calistir = async (fn: () => Promise<void>, basari?: string) => {
    setBusy(true);
    try {
      await fn();
      if (basari) Alert.alert('Tamam', basari);
      await yukle();
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const durum = (st: string) =>
    void calistir(
      () => AdminRaporDurumGuncelle(id!, st, not.trim() || undefined),
      st === 'resolved'
        ? 'Rapor çözüldü'
        : st === 'dismissed'
          ? 'Rapor reddedildi'
          : 'Durum güncellendi',
    );

  const uyariVer = () => {
    if (!hedefId) {
      Alert.alert('Uyarı', 'Hedef kullanıcı yok.');
      return;
    }
    if (!uyari.trim()) {
      Alert.alert('Uyarı', 'Mesaj yaz.');
      return;
    }
    void calistir(async () => {
      const r = await AdminIhtarVer({
        userId: hedefId,
        reason: uyari.trim(),
        severity: 'medium',
        notes: `report:${id}`,
      });
      if (!r.ok) throw new Error(r.hata);
      await AdminRaporDurumGuncelle(id!, 'reviewing', not.trim() || undefined);
    }, 'Uyarı gönderildi');
  };

  const banla = () => {
    if (!hedefId) return;
    Alert.alert('Ban', 'Kullanıcı banlansın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Banla',
        style: 'destructive',
        onPress: () =>
          void calistir(async () => {
            const r = await AdminKullaniciBanla(
              hedefId,
              detay?.rapor.reason || 'report_ban',
            );
            if (!r.ok) throw new Error(r.hata);
            await AdminRaporDurumGuncelle(id!, 'resolved', not.trim() || 'Ban');
          }, 'Kullanıcı banlandı'),
      },
    ]);
  };

  const banKaldir = () => {
    if (!hedefId) return;
    void calistir(async () => {
      const r = await AdminKullaniciBanKaldir(hedefId);
      if (!r.ok) throw new Error(r.hata);
    }, 'Ban kaldırıldı');
  };

  const hesapSil = () => {
    if (!hedefId) return;
    Alert.alert('Hesap sil', 'Hesap soft-delete edilecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          void calistir(async () => {
            const r = await AdminKullaniciSil(hedefId, 'report_delete');
            if (!r.ok) throw new Error(r.hata);
            await AdminRaporDurumGuncelle(
              id!,
              'resolved',
              not.trim() || 'Hesap silindi',
            );
          }, 'Hesap silindi'),
      },
    ]);
  };

  const icerikKaldir = () => {
    Alert.alert('İçerik kaldır', 'İlgili içerik platformdan kaldırılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: () =>
          void calistir(async () => {
            await AdminRaporIcerikKaldir(id!);
            await AdminRaporDurumGuncelle(
              id!,
              'reviewing',
              not.trim() || 'İçerik kaldırıldı',
            );
          }, 'İçerik kaldırıldı'),
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Rapor detayı"
        subtitle="Neden bildirildi · ne yaptı"
        fallbackHref={"/admin" as any}
      />
      {yukleniyor || !detay ? (
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginTop: 40 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={AdminStil.content}
          refreshControl={
            <RefreshControl
              refreshing={yukleniyor || busy}
              onRefresh={() => void yukle()}
              tintColor={RenkTokenlari.primarySoft}
            />
          }
        >
          <View style={AdminStil.kart}>
            <View style={AdminStil.satir}>
              <Text style={AdminStil.kartBaslik}>{detay.rapor.reason}</Text>
              <View style={AdminStil.chip}>
                <Text style={AdminStil.chipYazi}>
                  {RaporDurumEtiketi(detay.rapor.status)}
                </Text>
              </View>
            </View>
            <Text style={AdminStil.kartAlt}>
              {icerikTurEtiket(detay.icerik.tur)} ·{' '}
              {new Date(detay.rapor.created_at).toLocaleString('tr-TR')}
            </Text>
            {detay.rapor.details ? (
              <Text style={styles.detayMetin}>{detay.rapor.details}</Text>
            ) : null}
          </View>

          <Text style={AdminStil.sectionLabel}>Kimler</Text>
          <View style={AdminStil.kart}>
            <Text style={styles.kisiEtiket}>Bildiren</Text>
            <Text style={AdminStil.kartBaslik}>{kisiAd(detay.reporter)}</Text>
            {detay.reporter?.public_user_id ? (
              <Text style={AdminStil.kartAlt}>
                {detay.reporter.public_user_id}
              </Text>
            ) : null}
          </View>
          <View style={AdminStil.kart}>
            <Text style={styles.kisiEtiket}>Bildirilen</Text>
            <Text style={AdminStil.kartBaslik}>{kisiAd(detay.target)}</Text>
            <Text style={AdminStil.kartAlt}>
              {detay.target?.banned_at
                ? `Banlı · ${detay.target.ban_reason ?? ''}`
                : detay.target?.deleted_at
                  ? 'Silinmiş hesap'
                  : 'Aktif'}
            </Text>
            {hedefId ? (
              <Pressable
                style={AdminStil.aksiyon}
                onPress={() =>
                  router.push(`/admin/kullanicilar/${hedefId}` as any)
                }
              >
                <Text
                  style={[
                    AdminStil.aksiyonYazi,
                    { color: RenkTokenlari.primarySoft },
                  ]}
                >
                  Tam kullanıcı dosyası
                </Text>
              </Pressable>
            ) : null}
          </View>

          {detay.room ? (
            <View style={AdminStil.kart}>
              <Text style={styles.kisiEtiket}>Oda</Text>
              <Text style={AdminStil.kartBaslik}>
                {detay.room.title || detay.room.id}
              </Text>
              <Text style={AdminStil.kartAlt}>
                {detay.room.mode}
                {detay.room.is_live ? ' · canlı' : ''}
              </Text>
            </View>
          ) : null}

          <Text style={AdminStil.sectionLabel}>İlgili içerik</Text>
          <Pressable
            style={AdminStil.kart}
            onPress={() => {
              if (mediaUrl || metin) setTamEkran(true);
            }}
          >
            <View style={AdminStil.satir}>
              <Text style={AdminStil.kartBaslik}>
                {icerikTurEtiket(detay.icerik.tur)}
              </Text>
              {detay.icerik.kaldirildi ? (
                <View style={[AdminStil.chip, styles.chipTehlike]}>
                  <Text style={[AdminStil.chipYazi, { color: RenkTokenlari.danger }]}>
                    Kaldırıldı
                  </Text>
                </View>
              ) : (
                <Text style={styles.tamEkranHint}>Tam ekran →</Text>
              )}
            </View>
            {mediaUrl ? (
              <Image
                source={{ uri: mediaUrl }}
                style={styles.onizleme}
                resizeMode="cover"
              />
            ) : null}
            {metin ? (
              <Text style={styles.detayMetin} numberOfLines={8}>
                {metin}
              </Text>
            ) : (
              <Text style={AdminStil.kartAlt}>
                Metin/medya snapshot yok — kullanıcı raporu
              </Text>
            )}
          </Pressable>

          {(detay.hedef_ihtarlar ?? []).length > 0 ? (
            <>
              <Text style={AdminStil.sectionLabel}>Önceki uyarılar</Text>
              {detay.hedef_ihtarlar.map((w) => (
                <View key={w.id} style={AdminStil.kart}>
                  <Text style={AdminStil.kartBaslik}>{w.reason}</Text>
                  <Text style={AdminStil.kartAlt}>
                    {w.severity} ·{' '}
                    {new Date(w.created_at).toLocaleString('tr-TR')}
                    {w.cleared_at ? ' · kaldırıldı' : ''}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          <Text style={AdminStil.sectionLabel}>Admin notu</Text>
          <TextInput
            value={not}
            onChangeText={setNot}
            placeholder="İç not (isteğe bağlı)"
            placeholderTextColor={RenkTokenlari.textDim}
            style={[AdminStil.input, { minHeight: 64 }]}
            multiline
          />

          <Text style={AdminStil.sectionLabel}>Uyarı mesajı</Text>
          <TextInput
            value={uyari}
            onChangeText={setUyari}
            placeholder="Kullanıcıya gidecek uyarı"
            placeholderTextColor={RenkTokenlari.textDim}
            style={[AdminStil.input, { minHeight: 72 }]}
            multiline
          />

          <Text style={AdminStil.sectionLabel}>İşlemler</Text>
          <View style={AdminStil.aksiyonSatir}>
            <Pressable
              style={[AdminStil.aksiyon, styles.aksiyonOnemli]}
              onPress={uyariVer}
              disabled={busy}
            >
              <Text style={AdminStil.aksiyonYazi}>Uyarı ver</Text>
            </Pressable>
            <Pressable
              style={AdminStil.aksiyon}
              onPress={icerikKaldir}
              disabled={busy}
            >
              <Text style={AdminStil.aksiyonYazi}>İçeriği kaldır</Text>
            </Pressable>
            {detay.target?.banned_at ? (
              <Pressable
                style={AdminStil.aksiyon}
                onPress={banKaldir}
                disabled={busy}
              >
                <Text style={AdminStil.aksiyonYazi}>Ban kaldır</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[AdminStil.aksiyon, styles.aksiyonTehlike]}
                onPress={banla}
                disabled={busy}
              >
                <Text
                  style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.danger }]}
                >
                  Banla
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[AdminStil.aksiyon, styles.aksiyonTehlike]}
              onPress={hesapSil}
              disabled={busy}
            >
              <Text
                style={[AdminStil.aksiyonYazi, { color: RenkTokenlari.danger }]}
              >
                Hesabı sil
              </Text>
            </Pressable>
          </View>

          <Text style={AdminStil.sectionLabel}>Rapor durumu</Text>
          <View style={AdminStil.aksiyonSatir}>
            {(
              [
                ['reviewing', 'İncelemede'],
                ['resolved', 'Çözüldü'],
                ['dismissed', 'Reddet'],
                ['open', 'Açık bırak'],
              ] as const
            ).map(([st, label]) => (
              <Pressable
                key={st}
                style={AdminStil.aksiyon}
                onPress={() => durum(st)}
                disabled={busy}
              >
                <Text style={AdminStil.aksiyonYazi}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={tamEkran}
        animationType="fade"
        onRequestClose={() => setTamEkran(false)}
      >
        <View style={[styles.tamEkran, { width, height }]}>
          <Pressable
            style={styles.tamEkranKapat}
            onPress={() => setTamEkran(false)}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <ScrollView
            contentContainerStyle={styles.tamEkranIcerik}
            maximumZoomScale={3}
          >
            {mediaUrl ? (
              <Image
                source={{ uri: mediaUrl }}
                style={{ width: width - 24, height: height * 0.55 }}
                resizeMode="contain"
              />
            ) : null}
            {metin ? <Text style={styles.tamEkranMetin}>{metin}</Text> : null}
            <Text style={styles.tamEkranAlt}>
              {detay?.rapor.reason}
              {'\n'}
              {icerikTurEtiket(detay?.icerik.tur)}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kisiEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  detayMetin: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    lineHeight: 22,
  },
  onizleme: {
    width: '100%',
    height: 180,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
  },
  tamEkranHint: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
  },
  chipTehlike: {
    backgroundColor: 'rgba(232,64,64,0.12)',
  },
  aksiyonOnemli: {
    borderColor: RenkTokenlari.primarySoft,
  },
  aksiyonTehlike: {
    borderColor: 'rgba(232,64,64,0.35)',
  },
  tamEkran: {
    flex: 1,
    backgroundColor: '#000',
  },
  tamEkranKapat: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tamEkranIcerik: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: BoslukTokenlari.lg,
    paddingTop: 100,
    gap: BoslukTokenlari.lg,
  },
  tamEkranMetin: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
  },
  tamEkranAlt: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.55)',
    marginTop: BoslukTokenlari.md,
  },
});
