import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  AdminVerifyKuyruk,
  AdminVerifyOnaylananlar,
  VERIFY_BELGE_ETIKET,
  VERIFY_DURUM_ETIKET,
  VerifyHataMetni,
  VerifyYetkiHatasi,
  type AdminVerifyKayit,
  type AdminVerifyOnayliKullanici,
  type AdminVerifyOnayliOzet,
  type VerifyDurumKodu,
} from '../../../../../src/moduller/admin/kimlik-dogrulama/AdminKimlikIslemleri';
import { RenkTokenlari } from '../../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

const OTOMATIK_KONTROL_MS = 30_000;

const BEKLEYEN_DURUMLAR: VerifyDurumKodu[] = [
  'under_review',
  'additional_verification',
  'awaiting_document',
  'awaiting_selfie',
  'appeal_review',
];

const BELGE_FILTRELERI = [
  { id: 'all', etiket: 'Tüm belgeler' },
  { id: 'id_card', etiket: 'Kimlik kartı' },
  { id: 'passport', etiket: 'Pasaport' },
  { id: 'drivers_license', etiket: 'Sürücü belgesi' },
  { id: 'residence_permit', etiket: 'Oturum kartı' },
] as const;

type BelgeFiltresi = (typeof BELGE_FILTRELERI)[number]['id'];

function tarih(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return String(iso);
  }
}

function saat(t: Date | null): string {
  if (!t) return '—';
  try {
    return t.toLocaleTimeString('tr-TR');
  } catch {
    return '—';
  }
}

function belgeAdi(kod: string): string {
  return VERIFY_BELGE_ETIKET[kod] ?? kod;
}

function kisiAdi(k: AdminVerifyOnayliKullanici): string {
  const beyan = `${k.declared_first_name ?? ''} ${k.declared_last_name ?? ''}`.trim();
  return (
    beyan ||
    k.display_name?.trim() ||
    k.legal_first_name?.trim() ||
    (k.username ? `@${k.username}` : k.user_id.slice(0, 8))
  );
}

function Bilgi({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null | undefined;
}) {
  const metin = (deger ?? '').trim();
  if (!metin) return null;
  return (
    <View style={styles.bilgi}>
      <Text style={styles.bilgiEtiket}>{etiket}</Text>
      <Text style={styles.bilgiDeger} selectable numberOfLines={3}>
        {metin}
      </Text>
    </View>
  );
}

function OnayliKart({ k }: { k: AdminVerifyOnayliKullanici }) {
  const belgeler = [
    k.has_front ? 'ön' : null,
    k.has_back ? 'arka' : null,
    k.has_selfie ? 'selfie' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const yasalAd = `${k.legal_first_name ?? ''} ${k.legal_last_name ?? ''}`.trim();

  return (
    <View style={AdminStil.kart}>
      <View style={AdminStil.satir}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={AdminStil.kartBaslik} numberOfLines={1}>
            {kisiAdi(k)}
          </Text>
          <Text style={AdminStil.kartAlt} numberOfLines={1}>
            {k.display_name ?? '—'}
            {k.username ? ` · @${k.username}` : ''}
            {k.public_user_id ? ` · ${k.public_user_id}` : ''}
          </Text>
        </View>
        <View style={styles.onayRozet}>
          <Ionicons name="checkmark-circle" size={12} color={RenkTokenlari.mint} />
          <Text style={styles.onayRozetYazi}>Onaylı</Text>
        </View>
      </View>

      <Text style={styles.tarihSatir}>
        Başvuru: {tarih(k.submitted_at)} · Onay: {tarih(k.decided_at ?? k.decision_at)}
      </Text>

      <View style={styles.bilgiGrid}>
        <Bilgi etiket="Telefon" deger={k.phone_e164} />
        <Bilgi etiket="E-posta" deger={k.email} />
        <Bilgi etiket="Başvuru ülkesi" deger={k.country_code} />
        <Bilgi
          etiket="Profil ülkesi"
          deger={k.profile_country_code && k.profile_country_code !== k.country_code ? k.profile_country_code : null}
        />
        <Bilgi etiket="Belge türü" deger={belgeAdi(k.doc_type)} />
        <Bilgi etiket="Beyan edilen doğum" deger={k.declared_birth_date} />
        <Bilgi etiket="Profil doğum tarihi" deger={k.profile_birth_date} />
        <Bilgi etiket="Cüzdan no" deger={k.wallet_number} />
        <Bilgi etiket="Cüzdan markası" deger={k.wallet_brand} />
        <Bilgi etiket="Yasal ad soyad" deger={yasalAd} />
        <Bilgi etiket="KYC durumu" deger={k.kyc_status} />
        <Bilgi
          etiket="Karar"
          deger={`${k.decision ?? 'approved'}${k.reason_code ? ` · ${k.reason_code}` : ''}`}
        />
        <Bilgi etiket="Karar veren" deger={k.decision_reviewer_name ?? k.reviewer_name} />
        <Bilgi etiket="Karar notu" deger={k.reason ?? k.decision_reason} />
        <Bilgi etiket="Son inceleme notu" deger={k.last_review_note} />
        <Bilgi
          etiket="Belgeler"
          deger={`${k.document_count} dosya${belgeler ? ` · ${belgeler}` : ''}`}
        />
        <Bilgi etiket="Hesap türü" deger={k.is_guest ? 'Misafir hesabı' : 'Kayıtlı hesap'} />
        <Bilgi etiket="Üyelik tarihi" deger={k.profile_created_at ? tarih(k.profile_created_at) : null} />
        <Bilgi etiket="Kullanıcı ID" deger={k.user_id} />
        <Bilgi etiket="Başvuru ID" deger={k.id} />
      </View>

      <View style={styles.dugmeSatir}>
        <Pressable
          style={AdminStil.aksiyon}
          onPress={() => router.push(`/admin/kimlik-dogrulama/${k.id}` as never)}
          accessibilityRole="link"
        >
          <Text style={AdminStil.aksiyonYazi}>Başvuruyu aç</Text>
        </Pressable>
        <Pressable
          style={AdminStil.aksiyon}
          onPress={() => router.push(`/admin/kullanicilar/${k.user_id}` as never)}
          accessibilityRole="link"
        >
          <Text style={AdminStil.aksiyonYazi}>Kullanıcı dosyası</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BekleyenSatir({ k }: { k: AdminVerifyKayit }) {
  const ad =
    `${k.declared_first_name ?? ''} ${k.declared_last_name ?? ''}`.trim() ||
    k.display_name ||
    (k.username ? `@${k.username}` : k.user_id.slice(0, 8));

  return (
    <Pressable
      style={({ pressed }) => [styles.bekleyenSatir, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/admin/kimlik-dogrulama/${k.id}` as never)}
      accessibilityRole="link"
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.bekleyenAd} numberOfLines={1}>
          {ad}
        </Text>
        <Text style={styles.bekleyenAlt} numberOfLines={1}>
          {belgeAdi(k.doc_type)} · {k.country_code} · {tarih(k.submitted_at ?? k.created_at)}
        </Text>
      </View>
      <View style={styles.bekleyenDurum}>
        <Text style={styles.bekleyenDurumYazi}>
          {VERIFY_DURUM_ETIKET[k.status] ?? k.status}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
    </Pressable>
  );
}

export default function OnaylananKullanicilarEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [kayitlar, setKayitlar] = useState<AdminVerifyOnayliKullanici[]>([]);
  const [toplam, setToplam] = useState(0);
  const [ozet, setOzet] = useState<AdminVerifyOnayliOzet | null>(null);
  const [bekleyenler, setBekleyenler] = useState<AdminVerifyKayit[]>([]);
  const [arama, setArama] = useState('');
  const [belgeFiltresi, setBelgeFiltresi] = useState<BelgeFiltresi>('all');
  const [canli, setCanli] = useState(true);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kontrolEdiliyor, setKontrolEdiliyor] = useState(false);
  const [sonKontrol, setSonKontrol] = useState<Date | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yetkiYok, setYetkiYok] = useState(false);

  const sorguRef = useRef('');

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    setHata(null);
    setYetkiYok(false);
    try {
      const [liste, kuyruk] = await Promise.all([
        AdminVerifyOnaylananlar({ arama: sorguRef.current, limit: 100 }),
        AdminVerifyKuyruk({ durum: null, limit: 6 }).catch(() => ({ toplam: 0, kayitlar: [] })),
      ]);
      setKayitlar(liste.kayitlar);
      setToplam(liste.toplam);
      setOzet(liste.ozet);
      setBekleyenler(
        kuyruk.kayitlar.filter((k) => BEKLEYEN_DURUMLAR.includes(k.status)).slice(0, 5),
      );
      setSonKontrol(new Date());
    } catch (e) {
      setYetkiYok(VerifyYetkiHatasi(e));
      setHata(VerifyHataMetni(e));
      setKayitlar([]);
      setBekleyenler([]);
    } finally {
      if (!sessiz) setYukleniyor(false);
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

  // Yeni başvuru kontrolü: sayfa açıkken 30 saniyede bir bekleyen kuyruk
  // sessizce yenilenir; sayaç arttığında üst şerit güncellenir.
  useEffect(() => {
    if (!admin || !canli) return;
    const zaman = setInterval(() => {
      setKontrolEdiliyor(true);
      void yukle(true).finally(() => setKontrolEdiliyor(false));
    }, OTOMATIK_KONTROL_MS);
    return () => clearInterval(zaman);
  }, [admin, canli, yukle]);

  const gorunen = useMemo(
    () => (belgeFiltresi === 'all' ? kayitlar : kayitlar.filter((k) => k.doc_type === belgeFiltresi)),
    [belgeFiltresi, kayitlar],
  );

  if (!admin) return null;

  const yeniBasvuru = ozet?.yeni_basvuru ?? 0;
  const kpiler = [
    { etiket: 'Onaylı toplam', deger: ozet?.onayli_toplam ?? toplam, renk: RenkTokenlari.mint },
    { etiket: 'Bugün onaylanan', deger: ozet?.bugun_onay ?? 0 },
    { etiket: 'Bu hafta onaylanan', deger: ozet?.bu_hafta_onay ?? 0 },
    { etiket: 'Bu ay onaylanan', deger: ozet?.bu_ay_onay ?? 0 },
  ];

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Onaylanan Kullanıcılar"
        subtitle="Tamuso Verify · onaylı hesaplar"
        fallbackHref="/admin"
      />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={yukleniyor}
            onRefresh={() => void yukle()}
            tintColor={RenkTokenlari.primarySoft}
          />
        }
      >
        {yetkiYok ? (
          <View style={styles.yetkiKart}>
            <Ionicons name="lock-closed-outline" size={18} color={RenkTokenlari.accent} />
            <Text style={styles.yetkiBaslik}>Bu sayfa için izin gerekli</Text>
            <Text style={styles.yetkiAlt}>
              Onaylanan kullanıcılar yalnızca `identity.view` izni olan personele açılır. Yetki,
              Admin Yönetimi → roller ekranından verilir.
            </Text>
            <Pressable
              style={styles.yetkiDugme}
              onPress={() => router.push('/admin/yonetim/roller' as never)}
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

        {/* Yeni başvuru kontrol mekanizması */}
        <View style={[styles.yeniKart, yeniBasvuru > 0 && styles.yeniKartAktif]}>
          <View style={styles.yeniUst}>
            <View style={styles.yeniIkon}>
              <Ionicons
                name={yeniBasvuru > 0 ? 'notifications' : 'notifications-off-outline'}
                size={18}
                color={yeniBasvuru > 0 ? RenkTokenlari.accent : RenkTokenlari.textMuted}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.yeniBaslik}>
                {yeniBasvuru > 0
                  ? `${yeniBasvuru} yeni başvuru kontrol bekliyor`
                  : 'Kontrol bekleyen yeni başvuru yok'}
              </Text>
              <Text style={styles.yeniAlt}>
                Son kontrol: {saat(sonKontrol)}
                {ozet ? ` · Bugün gelen: ${ozet.bugun_basvuru}` : ''}
                {canli ? ' · Canlı takip 30 sn' : ' · Canlı takip kapalı'}
              </Text>
            </View>
            {kontrolEdiliyor ? (
              <ActivityIndicator size="small" color={RenkTokenlari.primarySoft} />
            ) : null}
          </View>

          {ozet ? (
            <View style={styles.yeniSayilar}>
              <Text style={styles.yeniSayi}>
                İncelemede: {ozet.inceleme_bekleyen}
              </Text>
              <Text style={styles.yeniSayi}>Ek belge: {ozet.eksik_belge}</Text>
              <Text style={styles.yeniSayi}>Selfie: {ozet.selfie_bekleyen}</Text>
              <Text style={styles.yeniSayi}>Ek doğrulama: {ozet.ek_dogrulama}</Text>
              <Text style={styles.yeniSayi}>İtiraz: {ozet.acik_itiraz}</Text>
            </View>
          ) : null}

          <View style={styles.yeniDugmeler}>
            <Pressable
              style={styles.birincilDugme}
              onPress={() => router.push('/admin/kimlik-dogrulama' as never)}
            >
              <Text style={styles.birincilDugmeYazi}>Başvuruları kontrol et</Text>
            </Pressable>
            <Pressable
              style={styles.ikincilDugme}
              onPress={() => {
                setKontrolEdiliyor(true);
                void yukle().finally(() => setKontrolEdiliyor(false));
              }}
            >
              <Ionicons name="refresh" size={13} color={RenkTokenlari.text} />
              <Text style={styles.ikincilDugmeYazi}>Şimdi kontrol et</Text>
            </Pressable>
            <Pressable
              style={[styles.ikincilDugme, canli && styles.ikincilDugmeAktif]}
              onPress={() => setCanli((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: canli }}
            >
              <Ionicons
                name={canli ? 'pulse' : 'pause'}
                size={13}
                color={canli ? RenkTokenlari.mint : RenkTokenlari.textMuted}
              />
              <Text style={[styles.ikincilDugmeYazi, canli && { color: RenkTokenlari.mint }]}>
                {canli ? 'Canlı takip açık' : 'Canlı takip kapalı'}
              </Text>
            </Pressable>
          </View>
        </View>

        {bekleyenler.length ? (
          <>
            <Text style={AdminStil.sectionLabel}>Son gelen başvurular</Text>
            <View style={styles.bekleyenListe}>
              {bekleyenler.map((k) => (
                <BekleyenSatir key={k.id} k={k} />
              ))}
            </View>
          </>
        ) : null}

        <View style={AdminStil.kpiGrid}>
          {kpiler.map((k) => (
            <View key={k.etiket} style={AdminStil.kpi}>
              <Text style={[AdminStil.kpiN, k.renk ? { color: k.renk } : null]}>{k.deger}</Text>
              <Text style={AdminStil.kpiL}>{k.etiket}</Text>
            </View>
          ))}
        </View>

        <View style={styles.aramaSatir}>
          <TextInput
            value={arama}
            onChangeText={setArama}
            onSubmitEditing={() => {
              sorguRef.current = arama;
              void yukle();
            }}
            placeholder="Ad, kullanıcı adı, public ID, telefon, e-posta, cüzdan no"
            placeholderTextColor={RenkTokenlari.textDim}
            style={[AdminStil.input, styles.aramaGirdi]}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <Pressable
            style={styles.araDugme}
            onPress={() => {
              sorguRef.current = arama;
              void yukle();
            }}
          >
            <Text style={styles.araDugmeYazi}>Ara</Text>
          </Pressable>
          {sorguRef.current ? (
            <Pressable
              style={styles.temizleDugme}
              onPress={() => {
                setArama('');
                sorguRef.current = '';
                void yukle();
              }}
            >
              <Ionicons name="close" size={16} color={RenkTokenlari.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 12 }}>
            {BELGE_FILTRELERI.map((f) => {
              const aktif = belgeFiltresi === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setBelgeFiltresi(f.id)}
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

        <View style={AdminStil.satir}>
          <Text style={AdminStil.sectionLabel}>
            Onaylı hesaplar ({belgeFiltresi === 'all' ? toplam : gorunen.length})
          </Text>
          {belgeFiltresi !== 'all' ? (
            <Text style={AdminStil.kartAlt}>Filtre: {belgeAdi(belgeFiltresi)}</Text>
          ) : null}
        </View>

        {yukleniyor && !ozet ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} style={{ marginTop: 24 }} />
        ) : gorunen.length === 0 ? (
          <Text style={AdminStil.bos}>
            {sorguRef.current || belgeFiltresi !== 'all'
              ? 'Bu aramada onaylı kullanıcı yok'
              : 'Henüz onaylanan kullanıcı yok'}
          </Text>
        ) : (
          gorunen.map((k) => <OnayliKart key={k.id} k={k} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  yeniKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
    gap: BoslukTokenlari.sm,
  },
  yeniKartAktif: {
    borderColor: `${RenkTokenlari.accent}88`,
    backgroundColor: `${RenkTokenlari.accent}10`,
  },
  yeniUst: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yeniIkon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  yeniBaslik: { ...TipografiTokenlari.body, color: RenkTokenlari.text, fontWeight: '800' },
  yeniAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  yeniSayilar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  yeniSayi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
  },
  yeniDugmeler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  birincilDugme: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
  },
  birincilDugmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  ikincilDugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  ikincilDugmeAktif: {
    borderColor: `${RenkTokenlari.mint}77`,
    backgroundColor: `${RenkTokenlari.mint}14`,
  },
  ikincilDugmeYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontSize: 10.5,
    fontWeight: '700',
  },
  bekleyenListe: { gap: 6 },
  bekleyenSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  bekleyenAd: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700' },
  bekleyenAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10 },
  bekleyenDurum: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.violet}1F`,
  },
  bekleyenDurumYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.violet,
    fontSize: 9,
    fontWeight: '800',
  },
  aramaSatir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aramaGirdi: { flex: 1, minWidth: 0 },
  araDugme: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.primary,
  },
  araDugmeYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  temizleDugme: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: YaricapTokenlari.sm,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
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
  onayRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.mint}1F`,
  },
  onayRozetYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontSize: 9,
    fontWeight: '800',
  },
  tarihSatir: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 10 },
  bilgiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bilgi: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
    gap: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.surface,
  },
  bilgiEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bilgiDeger: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontSize: 11.5 },
  dugmeSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
});
