import React, { useCallback, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminVerifyAyarGuncelle,
  AdminVerifyAyarlar as AdminVerifyAyarlarGetir,
  AdminVerifyDashboard,
  AdminVerifyItirazlar,
  AdminVerifyKuyruk,
  VERIFY_BELGE_ETIKET,
  VERIFY_DURUM_ETIKET,
  VerifyHataMetni,
  VerifyYetkiHatasi,
  type AdminVerifyAyarlar,
  type AdminVerifyItiraz,
  type AdminVerifyKayit,
  type AdminVerifyOzet,
  type VerifyDurumKodu,
} from '../../../../../src/moduller/admin/kimlik-dogrulama/AdminKimlikIslemleri';
import { RenkTokenlari } from '../../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type Sekme = 'kuyruk' | 'itiraz' | 'ayarlar';

const DURUM_FILTRELERI: { id: VerifyDurumKodu | 'all'; etiket: string }[] = [
  { id: 'all', etiket: 'Tümü' },
  { id: 'under_review', etiket: 'İncelemede' },
  { id: 'appeal_review', etiket: 'İtiraz' },
  { id: 'additional_verification', etiket: 'Ek doğrulama' },
  { id: 'awaiting_document', etiket: 'Belge bekleyen' },
  { id: 'awaiting_selfie', etiket: 'Selfie bekleyen' },
  { id: 'approved', etiket: 'Onaylı' },
  { id: 'rejected', etiket: 'Red' },
];

function durumRengi(durum: string): string {
  switch (durum) {
    case 'approved':
      return RenkTokenlari.mint;
    case 'rejected':
      return RenkTokenlari.danger;
    case 'under_review':
    case 'appeal_review':
      return RenkTokenlari.violet;
    case 'additional_verification':
      return RenkTokenlari.warning;
    default:
      return RenkTokenlari.accent;
  }
}

function tarih(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return String(iso);
  }
}

export default function AdminKimlikDogrulamaMerkezi() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [ozet, setOzet] = useState<AdminVerifyOzet | null>(null);
  const [kayitlar, setKayitlar] = useState<AdminVerifyKayit[]>([]);
  const [itirazlar, setItirazlar] = useState<AdminVerifyItiraz[]>([]);
  const [ayarlar, setAyarlar] = useState<AdminVerifyAyarlar | null>(null);
  const [sekme, setSekme] = useState<Sekme>('kuyruk');
  const [durum, setDurum] = useState<VerifyDurumKodu | 'all'>('all');
  const [arama, setArama] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [yetkiYok, setYetkiYok] = useState(false);
  const [ayarKaydediliyor, setAyarKaydediliyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    setYetkiYok(false);
    try {
      const [o, k] = await Promise.all([
        AdminVerifyDashboard(),
        AdminVerifyKuyruk({ durum: durum === 'all' ? null : durum, arama, limit: 60 }),
      ]);
      setOzet(o);
      setKayitlar(k.kayitlar);
      if (o.ikinci_onay_bekleyen >= 0) {
        const [i, a] = await Promise.all([
          AdminVerifyItirazlar({ limit: 40 }).catch(() => []),
          AdminVerifyAyarlarGetir().catch(() => null),
        ]);
        setItirazlar(i);
        setAyarlar(a);
      }
    } catch (e) {
      setYetkiYok(VerifyYetkiHatasi(e));
      setHata(VerifyHataMetni(e));
      setKayitlar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [arama, durum]);

  useFocusEffect(
    useCallback(() => {
      if (!admin) {
        router.replace('/(tabs)/profile');
        return;
      }
      void yukle();
    }, [admin, yukle]),
  );

  const ikinciOnayDegistir = async (yeni: boolean) => {
    if (!ayarlar || ayarKaydediliyor) return;
    setAyarKaydediliyor(true);
    try {
      await AdminVerifyAyarGuncelle({ ikinciOnayZorunlu: yeni });
      setAyarlar({ ...ayarlar, ikinci_onay_zorunlu: yeni });
    } catch (e) {
      Alert.alert('Ayar', VerifyHataMetni(e));
    } finally {
      setAyarKaydediliyor(false);
    }
  };

  if (!admin) return null;

  const kpiler: { etiket: string; deger: number; renk?: string }[] = ozet
    ? [
        { etiket: 'Toplam başvuru', deger: ozet.toplam },
        { etiket: 'Bugünkü başvuru', deger: ozet.bugun },
        { etiket: 'İnceleme bekleyen', deger: ozet.inceleme_bekleyen, renk: RenkTokenlari.violet },
        { etiket: 'Eksik belge', deger: ozet.eksik_belge, renk: RenkTokenlari.warning },
        { etiket: 'Selfie bekleyen', deger: ozet.selfie_bekleyen },
        { etiket: 'Ek doğrulama', deger: ozet.ek_dogrulama, renk: RenkTokenlari.warning },
        { etiket: 'Onaylanan', deger: ozet.onaylanan, renk: RenkTokenlari.mint },
        { etiket: 'Reddedilen', deger: ozet.reddedilen, renk: RenkTokenlari.danger },
        { etiket: 'İtiraz', deger: ozet.itiraz, renk: RenkTokenlari.violet },
        { etiket: 'İkinci onay bekleyen', deger: ozet.ikinci_onay_bekleyen, renk: RenkTokenlari.accent },
      ]
    : [];

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Tamuso Verify Merkezi"
        subtitle="Güvenlik · Kimlik Doğrulama"
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
        <View style={styles.heroKart}>
          <View style={styles.heroUst}>
            <View style={styles.heroIkon}>
              <Ionicons name="shield-checkmark" size={20} color={RenkTokenlari.primarySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBaslik}>Kimlik doğrulama operasyonu</Text>
              <Text style={styles.heroAlt}>
                Ham belgeler özel depoda; her görüntüleme denetim kaydına yazılır. Otomatik yüz
                eşleştirme veya kesin canlılık iddiası yoktur — karar insan incelemesindedir.
              </Text>
            </View>
          </View>
          <View style={styles.rozetSatir}>
            <Text style={styles.rozet}>Saklama: {ozet?.saklama_gun ?? '-'} gün</Text>
            <Text style={styles.rozet}>
              Ort. inceleme: {ozet?.ortalama_inceleme_saat ?? 0} sa
            </Text>
            <Text style={styles.rozet}>
              Belge izni: {ozet?.belge_goruntuleme_yetkisi ? 'var' : 'yok'}
            </Text>
          </View>
        </View>

        {yetkiYok ? (
          <View style={styles.yetkiKart}>
            <Ionicons name="lock-closed-outline" size={18} color={RenkTokenlari.accent} />
            <Text style={styles.yetkiBaslik}>Bu merkez için izin gerekli</Text>
            <Text style={styles.yetkiAlt}>
              Kimlik Doğrulama Merkezi yalnızca `identity.view` izni olan personele açılır. Genel
              admin yetkisi tek başına yeterli değildir.
            </Text>
            <Text style={styles.yetkiAlt}>
              Yetki, Admin Yönetimi → roller ekranından verilir. Super admin hesapları tüm izinlere
              sahiptir.
            </Text>
            <Pressable
              style={styles.yetkiDugme}
              onPress={() => router.push('/admin/yonetim/roller' as any)}
            >
              <Text style={styles.yetkiDugmeYazi}>Rolleri aç</Text>
            </Pressable>
          </View>
        ) : hata ? (
          <View style={styles.hataKart}>
            <Ionicons name="alert-circle-outline" size={16} color={RenkTokenlari.danger} />
            <Text style={styles.hataYazi}>{hata}</Text>
          </View>
        ) : null}

        <View style={styles.sekmeSatir}>
          {(
            [
              { id: 'kuyruk', etiket: 'Başvurular' },
              { id: 'itiraz', etiket: `İtirazlar${itirazlar.length ? ` (${itirazlar.length})` : ''}` },
              { id: 'ayarlar', etiket: 'Ayarlar' },
            ] as { id: Sekme; etiket: string }[]
          ).map((s) => {
            const aktif = sekme === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSekme(s.id)}
                style={[styles.sekme, aktif && styles.sekmeAktif]}
              >
                <Text style={[styles.sekmeYazi, aktif && styles.sekmeYaziAktif]}>{s.etiket}</Text>
              </Pressable>
            );
          })}
        </View>

        {yukleniyor && !ozet ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} style={{ marginTop: 24 }} />
        ) : sekme === 'kuyruk' ? (
          <>
            <View style={AdminStil.kpiGrid}>
              {kpiler.map((k) => (
                <View key={k.etiket} style={AdminStil.kpi}>
                  <Text style={[AdminStil.kpiN, k.renk ? { color: k.renk } : null]}>{k.deger}</Text>
                  <Text style={AdminStil.kpiL}>{k.etiket}</Text>
                </View>
              ))}
            </View>

            <TextInput
              value={arama}
              onChangeText={setArama}
              onSubmitEditing={() => void yukle()}
              placeholder="Ad, kullanıcı adı, public ID veya başvuru ID"
              placeholderTextColor={RenkTokenlari.textDim}
              style={AdminStil.input}
              autoCapitalize="none"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>
                {DURUM_FILTRELERI.map((f) => {
                  const aktif = durum === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setDurum(f.id)}
                      style={[styles.filtre, aktif && styles.filtreAktif]}
                    >
                      <Text style={[styles.filtreYazi, aktif && styles.filtreYaziAktif]}>
                        {f.etiket}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {!kayitlar.length ? (
              <Text style={AdminStil.bos}>Bu filtrede başvuru yok</Text>
            ) : (
              kayitlar.map((r) => {
                const renk = durumRengi(r.status);
                const kisi =
                  r.display_name ||
                  (r.username ? `@${r.username}` : r.user_id.slice(0, 8));
                return (
                  <Pressable
                    key={r.id}
                    style={({ pressed }) => [AdminStil.kart, pressed && { opacity: 0.88 }]}
                    onPress={() => router.push(`/admin/kimlik-dogrulama/${r.id}` as any)}
                  >
                    <View style={AdminStil.satir}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={AdminStil.kartBaslik} numberOfLines={1}>
                          {r.declared_first_name || r.declared_last_name
                            ? `${r.declared_first_name ?? ''} ${r.declared_last_name ?? ''}`.trim()
                            : 'Beyan edilmemiş'}
                        </Text>
                        <Text style={AdminStil.kartAlt} numberOfLines={1}>
                          {kisi}
                          {r.public_user_id ? ` · ${r.public_user_id}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.rozetKucuk, { backgroundColor: `${renk}1F` }]}>
                        <Text style={[styles.rozetKucukYazi, { color: renk }]}>
                          {VERIFY_DURUM_ETIKET[r.status] ?? r.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={AdminStil.kartAlt}>
                      {VERIFY_BELGE_ETIKET[r.doc_type] ?? r.doc_type} · {r.country_code} · selfie{' '}
                      {r.selfie_attempts ?? 0}
                    </Text>
                    {r.pending_action ? (
                      <Text style={[styles.uyariYazi, { color: RenkTokenlari.accent }]}>
                        İkinci onay bekliyor: {r.pending_action}
                      </Text>
                    ) : null}
                    <Text style={AdminStil.kartAlt} numberOfLines={1}>
                      Gönderim: {tarih(r.submitted_at ?? r.created_at)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </>
        ) : sekme === 'itiraz' ? (
          <>
            {!itirazlar.length ? (
              <Text style={AdminStil.bos}>Açık itiraz yok</Text>
            ) : (
              itirazlar.map((i) => (
                <Pressable
                  key={i.id}
                  style={({ pressed }) => [AdminStil.kart, pressed && { opacity: 0.88 }]}
                  onPress={() => router.push(`/admin/kimlik-dogrulama/${i.application_id}` as any)}
                >
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik} numberOfLines={1}>
                      {i.display_name ?? (i.username ? `@${i.username}` : i.user_id.slice(0, 8))}
                    </Text>
                    <View style={[styles.rozetKucuk, { backgroundColor: `${RenkTokenlari.violet}1F` }]}>
                      <Text style={[styles.rozetKucukYazi, { color: RenkTokenlari.violet }]}>
                        {i.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={AdminStil.kartAlt} numberOfLines={3}>
                    {i.message}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    {VERIFY_BELGE_ETIKET[i.doc_type] ?? i.doc_type} · {i.country_code} ·{' '}
                    {tarih(i.created_at)}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartBaslik}>İkinci yönetici onayı</Text>
              <Text style={AdminStil.kartAlt}>
                Açıkken onay/ret kararı ikinci bir yetkili tarafından teyit edilir. Aynı yönetici
                kendi talebini onaylayamaz.
              </Text>
              <Pressable
                onPress={() => void ikinciOnayDegistir(!ayarlar?.ikinci_onay_zorunlu)}
                disabled={!ozet?.ayar_yetkisi || ayarKaydediliyor}
                style={[
                  styles.ayarDugme,
                  ayarlar?.ikinci_onay_zorunlu && styles.ayarDugmeAktif,
                  (!ozet?.ayar_yetkisi || ayarKaydediliyor) && { opacity: 0.45 },
                ]}
              >
                <Text style={styles.ayarDugmeYazi}>
                  {ayarlar?.ikinci_onay_zorunlu ? 'Zorunlu' : 'Kapalı'}
                </Text>
              </Pressable>
              {!ozet?.ayar_yetkisi ? (
                <Text style={AdminStil.kartAlt}>
                  Ayarı değiştirmek için identity.settings.manage izni gerekir.
                </Text>
              ) : null}
            </View>

            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartBaslik}>Saklama ve selfie limitleri</Text>
              <Text style={AdminStil.kartAlt}>
                Selfie deneme limiti: {ayarlar?.selfie_deneme_limiti ?? '-'} · Oturum süresi:{' '}
                {ayarlar?.selfie_oturum_saniye ?? '-'} sn · Belge saklama:{' '}
                {ayarlar?.belge_saklama_gun ?? '-'} gün
              </Text>
              <Text style={AdminStil.kartAlt}>
                Saklama işi (identity_saklama_calistir) süresi dolan ham görüntüleri işaretler ve
                imha eder; karar kayıtları yasal yükümlülük için saklanır.
              </Text>
            </View>

            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartBaslik}>Erişim modeli</Text>
              <Text style={AdminStil.kartAlt}>
                Genel admin yetkisi belge görüntülemeye yetmez. Yalnızca identity.document.read
                izni olan personel denetimli görüntüleyiciyi açabilir; her erişim
                identity_access_audit tablosuna yazılır.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroKart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.bgCard,
    gap: BoslukTokenlari.sm,
  },
  heroUst: { flexDirection: 'row', gap: 10 },
  heroIkon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.primarySoft}1F`,
  },
  heroBaslik: { ...TipografiTokenlari.h2, color: RenkTokenlari.text, fontSize: 16 },
  heroAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  rozetSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rozet: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  hataKart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.danger}44`,
    backgroundColor: `${RenkTokenlari.danger}12`,
  },
  hataYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.danger, flex: 1, fontSize: 12 },
  yetkiKart: {
    padding: BoslukTokenlari.lg,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}55`,
    backgroundColor: `${RenkTokenlari.accent}12`,
    gap: 6,
  },
  yetkiBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.accent, fontWeight: '800' },
  yetkiAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  yetkiDugme: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.accent,
  },
  yetkiDugmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  sekmeSatir: { flexDirection: 'row', gap: 8 },
  sekme: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  sekmeAktif: { borderColor: RenkTokenlari.primarySoft, backgroundColor: `${RenkTokenlari.primarySoft}1F` },
  sekmeYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10.5 },
  sekmeYaziAktif: { color: RenkTokenlari.primarySoft, fontWeight: '800' },
  filtre: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  filtreAktif: { borderColor: RenkTokenlari.accent, backgroundColor: `${RenkTokenlari.accent}1A` },
  filtreYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10 },
  filtreYaziAktif: { color: RenkTokenlari.accent, fontWeight: '800' },
  rozetKucuk: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: YaricapTokenlari.pill },
  rozetKucukYazi: { ...TipografiTokenlari.micro, fontSize: 9, fontWeight: '800' },
  uyariYazi: { ...TipografiTokenlari.micro, fontSize: 9.5 },
  ayarDugme: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  ayarDugmeAktif: {
    borderColor: RenkTokenlari.mint,
    backgroundColor: `${RenkTokenlari.mint}1F`,
  },
  ayarDugmeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 12 },
});
