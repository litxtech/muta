import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminVerifyBelgeUrl,
  AdminVerifyDashboard,
  AdminVerifyDenetim as AdminVerifyDenetimGetir,
  AdminVerifyDetay as AdminVerifyDetayGetir,
  AdminVerifyIkinciOnay,
  AdminVerifyIslem,
  AdminVerifyItirazKarar,
  VERIFY_BELGE_ETIKET,
  VERIFY_DURUM_ETIKET,
  VERIFY_RED_KODLARI,
  VerifyHataMetni,
  type AdminIslemTuru,
  type AdminVerifyBelge,
  type AdminVerifyDenetim,
  type AdminVerifyDetay,
  type AdminVerifyOzet,
  type VerifyDurumKodu,
} from '../../../../../src/moduller/admin/kimlik-dogrulama/AdminKimlikIslemleri';
import { RenkTokenlari } from '../../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../../src/tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';

type AcikBelge = { belge: AdminVerifyBelge; url: string; bitis: number };

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

const YAN_ETIKET: Record<string, string> = {
  front: 'Ön yüz',
  back: 'Arka yüz',
  selfie: 'Canlı selfie',
};

export default function AdminKimlikDogrulamaDetay() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const uygulamaId = Array.isArray(id) ? id[0] : id;
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [detay, setDetay] = useState<AdminVerifyDetay | null>(null);
  const [ozet, setOzet] = useState<AdminVerifyOzet | null>(null);
  const [denetim, setDenetim] = useState<AdminVerifyDenetim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [acikBelge, setAcikBelge] = useState<AcikBelge | null>(null);
  const [belgeYukleniyor, setBelgeYukleniyor] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<string | null>(null);
  const [not, setNot] = useState('');
  const [secilenKod, setSecilenKod] = useState<string | null>(null);
  const [itirazNotu, setItirazNotu] = useState('');
  const [kalanSaniye, setKalanSaniye] = useState(0);

  const yukle = useCallback(async () => {
    if (!uygulamaId) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const [d, o] = await Promise.all([
        AdminVerifyDetayGetir(uygulamaId),
        AdminVerifyDashboard().catch(() => null),
      ]);
      setDetay(d);
      setOzet(o);
      try {
        setDenetim(await AdminVerifyDenetimGetir(uygulamaId, 60));
      } catch {
        setDenetim([]);
      }
    } catch (e) {
      setHata(VerifyHataMetni(e));
    } finally {
      setYukleniyor(false);
    }
  }, [uygulamaId]);

  useEffect(() => {
    if (!admin) {
      router.replace('/(tabs)/profile');
      return;
    }
    void yukle();
  }, [admin, yukle]);

  // İmzalı URL sayacı
  useEffect(() => {
    if (!acikBelge) return;
    setKalanSaniye(Math.max(0, Math.round((acikBelge.bitis - Date.now()) / 1000)));
    const zaman = setInterval(() => {
      const kalan = Math.max(0, Math.round((acikBelge.bitis - Date.now()) / 1000));
      setKalanSaniye(kalan);
      if (kalan <= 0) setAcikBelge(null);
    }, 1000);
    return () => clearInterval(zaman);
  }, [acikBelge]);

  const belgeAc = async (belge: AdminVerifyBelge) => {
    if (!ozet?.belge_goruntuleme_yetkisi) {
      Alert.alert(
        'Yetki yok',
        'Belge görüntülemek için identity.document.read izni gerekir. Genel admin yetkisi yeterli değildir.',
      );
      return;
    }
    setBelgeYukleniyor(belge.id);
    try {
      const r = await AdminVerifyBelgeUrl(belge.id, 'review');
      setAcikBelge({ belge, url: r.url, bitis: Date.now() + r.expiresIn * 1000 });
      void AdminVerifyDenetimGetir(uygulamaId ?? null, 20)
        .then(setDenetim)
        .catch(() => undefined);
    } catch (e) {
      Alert.alert('Belge', VerifyHataMetni(e));
    } finally {
      setBelgeYukleniyor(null);
    }
  };

  const islemYap = async (action: AdminIslemTuru) => {
    if (!uygulamaId) return;
    // Onay tek tıkla verilebilir; not yazmak zorunlu değildir. Ret ise
    // kullanıcıya gösterilecek bir gerekçe olmadan yapılmaz.
    if (action === 'reject' && not.trim().length < 5) {
      Alert.alert('Gerekçe gerekli', 'Ret için en az 5 karakterlik gerekçe yazın.');
      return;
    }
    if (action === 'reject' && !secilenKod) {
      Alert.alert('Ret kodu', 'Ret için bir gerekçe kodu seçin.');
      return;
    }
    setIslemde(action);
    try {
      const r = await AdminVerifyIslem(uygulamaId, action, {
        reasonCode: secilenKod,
        reason: not.trim() || null,
        note: not.trim() || null,
      });
      Alert.alert(
        'İşlem',
        r.bekliyor
          ? 'Karar ikinci yönetici onayına gönderildi. Aynı yönetici kendi talebini onaylayamaz.'
          : 'İşlem kaydedildi.',
      );
      setNot('');
      setSecilenKod(null);
      await yukle();
    } catch (e) {
      Alert.alert('İşlem', VerifyHataMetni(e));
    } finally {
      setIslemde(null);
    }
  };

  const ikinciOnay = async (onay: boolean) => {
    if (!uygulamaId) return;
    setIslemde(onay ? 'onayla' : 'reddet');
    try {
      await AdminVerifyIkinciOnay(uygulamaId, onay);
      Alert.alert('İkinci onay', onay ? 'Karar onaylandı.' : 'Karar reddedildi.');
      await yukle();
    } catch (e) {
      Alert.alert('İkinci onay', VerifyHataMetni(e));
    } finally {
      setIslemde(null);
    }
  };

  const itirazKarar = async (karar: 'reopen' | 'rejected') => {
    if (!detay?.appeal?.id) return;
    if (itirazNotu.trim().length < 5) {
      Alert.alert('Not gerekli', 'İtiraz kararı için en az 5 karakterlik not yazın.');
      return;
    }
    setIslemde(karar);
    try {
      await AdminVerifyItirazKarar(detay.appeal.id, karar, itirazNotu.trim());
      Alert.alert(
        'İtiraz',
        karar === 'reopen'
          ? 'Başvuru yeniden incelemeye açıldı.'
          : 'İtiraz reddedildi; karar kaydı oluşturuldu.',
      );
      setItirazNotu('');
      await yukle();
    } catch (e) {
      Alert.alert('İtiraz', VerifyHataMetni(e));
    } finally {
      setIslemde(null);
    }
  };

  const karsilastirma = useMemo(() => {
    if (!detay) return [];
    const app = detay.application;
    const ocrBelge = detay.documents.find((d) => d.side === 'front');
    const ocr = (ocrBelge?.ocr_fields ?? {}) as Record<string, unknown>;
    const metin = (v: unknown) => (typeof v === 'string' ? v : '');
    const kucuk = (v: string) => v.trim().toLocaleLowerCase('tr-TR');
    const uyum = (a: string, b: string) =>
      a && b ? (kucuk(a) === kucuk(b) ? 'uyumlu' : 'farklı') : 'bilgi yok';
    return [
      {
        alan: 'Ad',
        beyan: app.declared_first_name ?? '-',
        belge: metin(ocr.first_name) || '-',
        durum: uyum(metin(app.declared_first_name), metin(ocr.first_name)),
      },
      {
        alan: 'Soyad',
        beyan: app.declared_last_name ?? '-',
        belge: metin(ocr.last_name) || '-',
        durum: uyum(metin(app.declared_last_name), metin(ocr.last_name)),
      },
      {
        alan: 'Doğum tarihi',
        beyan: app.declared_birth_date ?? '-',
        belge: metin(ocr.birth_date) || '-',
        durum: uyum(metin(app.declared_birth_date), metin(ocr.birth_date)),
      },
      {
        alan: 'Geçerlilik',
        beyan: '-',
        belge: metin(ocr.expiry_date) || '-',
        durum: metin(ocr.expiry_date) ? 'bilgi var' : 'bilgi yok',
      },
    ];
  }, [detay]);

  if (!admin) return null;

  const app = detay?.application;
  const durumMetni = app ? VERIFY_DURUM_ETIKET[app.status as VerifyDurumKodu] ?? app.status : '';
  const onayYetkisi = Boolean(ozet?.onay_yetkisi);
  const redYetkisi = Boolean(ozet?.red_yetkisi);

  return (
    <Screen edges={['top']}>
      <EkranBasligi
        title="Başvuru incelemesi"
        subtitle={app ? `${durumMetni} · ${VERIFY_BELGE_ETIKET[app.doc_type] ?? app.doc_type}` : '-'}
        fallbackHref="/admin/kimlik-dogrulama"
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
        {yukleniyor && !detay ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} style={{ marginTop: 24 }} />
        ) : hata ? (
          <View style={styles.hataKart}>
            <Ionicons name="alert-circle-outline" size={16} color={RenkTokenlari.danger} />
            <Text style={styles.hataYazi}>{hata}</Text>
          </View>
        ) : !app ? (
          <Text style={AdminStil.bos}>Başvuru bulunamadı</Text>
        ) : (
          <>
            {app.pending_action ? (
              <View style={styles.ikinciOnayKart}>
                <View style={styles.ikinciUst}>
                  <Ionicons name="shield-half-outline" size={16} color={RenkTokenlari.accent} />
                  <Text style={styles.ikinciBaslik}>İkinci yönetici onayı bekliyor</Text>
                </View>
                <Text style={styles.ikinciAlt}>
                  Talep: {app.pending_action} · {app.pending_reason ?? '-'} · {tarih(app.pending_at)}
                </Text>
                <Text style={styles.ikinciAlt}>
                  Talebi oluşturan yönetici kendi kararını onaylayamaz.
                </Text>
                <View style={styles.dugmeSatir}>
                  <Pressable
                    style={[styles.dugme, { backgroundColor: RenkTokenlari.mint }]}
                    disabled={islemde != null}
                    onPress={() => void ikinciOnay(true)}
                  >
                    <Text style={[styles.dugmeYazi, { color: RenkTokenlari.bg }]}>Onayla</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dugme, { borderColor: RenkTokenlari.danger, borderWidth: 1 }]}
                    disabled={islemde != null}
                    onPress={() => void ikinciOnay(false)}
                  >
                    <Text style={[styles.dugmeYazi, { color: RenkTokenlari.danger }]}>Reddet</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Profil */}
            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartBaslik}>
                {detay?.profile?.display_name ||
                  (detay?.profile?.username ? `@${detay.profile.username}` : 'Kullanıcı')}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Public ID: {detay?.profile?.public_user_id ?? '-'} · Ülke: {app.country_code} ·
                Belge: {VERIFY_BELGE_ETIKET[app.doc_type] ?? app.doc_type}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Beyan: {app.declared_first_name ?? '-'} {app.declared_last_name ?? '-'} ·{' '}
                {app.declared_birth_date ?? '-'} · OCR durumu: {app.ocr_state ?? '-'}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Onay metni: {app.consent_version ?? '-'} · {tarih(app.consent_accepted_at)} ·
                Yaş onayı: {tarih(app.age_confirmed_at)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Cüzdan: {detay?.wallet?.wallet_number ?? '-'} ·{' '}
                {detay?.wallet?.legal_first_name ?? '-'} {detay?.wallet?.legal_last_name ?? '-'} ·
                kyc_status: {detay?.wallet?.kyc_status ?? '-'}
              </Text>
              {detay?.wallet?.legal_first_name &&
              app.declared_first_name &&
              detay.wallet.legal_first_name.trim().toLocaleLowerCase('tr-TR') !==
                app.declared_first_name.trim().toLocaleLowerCase('tr-TR') ? (
                <Text style={[styles.uyariYazi, { color: RenkTokenlari.warning }]}>
                  Uyuşmazlık: cüzdan hesabındaki yasal ad beyan edilen adla farklı.
                </Text>
              ) : null}
            </View>

            {/* Belgeler */}
            <Text style={AdminStil.sectionLabel}>Belgeler ve selfie</Text>
            {!detay?.documents.length ? (
              <Text style={AdminStil.bos}>Belge yüklenmemiş</Text>
            ) : (
              detay.documents.map((b) => (
                <View key={b.id} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>
                      {YAN_ETIKET[b.side] ?? b.side}
                    </Text>
                    <View style={[styles.rozetKucuk, { backgroundColor: `${RenkTokenlari.violet}1F` }]}>
                      <Text style={[styles.rozetKucukYazi, { color: RenkTokenlari.violet }]}>
                        {b.quality_state}
                      </Text>
                    </View>
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {b.width ?? '-'}×{b.height ?? '-'} · {b.mime} ·{' '}
                    {b.capture_source === 'camera' ? 'kamera' : 'galeri'} · {tarih(b.created_at)}
                  </Text>
                  <Pressable
                    style={[styles.dugme, { backgroundColor: RenkTokenlari.surface }]}
                    onPress={() => void belgeAc(b)}
                    disabled={belgeYukleniyor === b.id}
                  >
                    {belgeYukleniyor === b.id ? (
                      <ActivityIndicator size="small" color={RenkTokenlari.primarySoft} />
                    ) : (
                      <>
                        <Ionicons name="eye-outline" size={14} color={RenkTokenlari.text} />
                        <Text style={styles.dugmeYazi}>Güvenli görüntüle</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))
            )}
            <Text style={AdminStil.kartAlt}>
              Görüntüler herkese açık değildir. Her açma denetim kaydına yazılır ve bağlantı 300
              saniye sonra geçersiz olur.
            </Text>

            {/* Karşılaştırma */}
            <Text style={AdminStil.sectionLabel}>Beyan ↔ belge</Text>
            <View style={AdminStil.kart}>
              {karsilastirma.map((k) => (
                <View key={k.alan} style={AdminStil.satir}>
                  <Text style={AdminStil.kartAlt}>{k.alan}</Text>
                  <Text style={[AdminStil.kartAlt, { color: RenkTokenlari.text }]} numberOfLines={1}>
                    {k.beyan} ↔ {k.belge}
                  </Text>
                  <Text
                    style={[
                      styles.karsilastirmaEtiket,
                      {
                        color:
                          k.durum === 'farklı'
                            ? RenkTokenlari.danger
                            : k.durum === 'uyumlu'
                              ? RenkTokenlari.mint
                              : RenkTokenlari.textDim,
                      },
                    ]}
                  >
                    {k.durum}
                  </Text>
                </View>
              ))}
              <Text style={[AdminStil.kartAlt, { marginTop: 4 }]}>
                Bu tablo yalnızca OCR ön okumasıdır; belge gerçekliği ve yüz eşleşmesi otomatik
                olarak doğrulanmış sayılmaz.
              </Text>
            </View>

            {/* Selfie oturumu */}
            {detay?.session ? (
              <>
                <Text style={AdminStil.sectionLabel}>Canlılık ön sinyali</Text>
                <View style={AdminStil.kart}>
                  <Text style={AdminStil.kartAlt}>
                    Durum: {detay.session.state} · Deneme: {detay.session.attempts} · Hareketler:{' '}
                    {(detay.session.challenge_sequence ?? []).join(' → ')}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Cihaz: {String(detay.session.device_meta?.platform ?? '-')} · Fraud sinyali:{' '}
                    {JSON.stringify(detay.session.fraud_signals ?? {})}
                  </Text>
                  <Text style={[styles.uyariYazi, { color: RenkTokenlari.warning }]}>
                    Hareket ve yüz kontrolleri kesin canlılık kanıtı değildir (precheck_only).
                  </Text>
                </View>
              </>
            ) : null}

            {/* Karar paneli */}
            <Text style={AdminStil.sectionLabel}>Karar</Text>
            <View style={AdminStil.kart}>
              <Text style={AdminStil.kartAlt}>
                Mevcut durum: {durumMetni} · Karar: {app.decided_at ? tarih(app.decided_at) : '-'}
              </Text>
              {detay?.decision ? (
                <Text style={AdminStil.kartAlt}>
                  Son karar: {detay.decision.decision} · {detay.decision.reason_code ?? '-'} ·{' '}
                  {detay.decision.reason ?? '-'} · face_match:{' '}
                  {detay.decision.face_match_performed ? 'evet' : 'hayır'} · insan:{' '}
                  {detay.decision.decided_by_human ? 'evet' : 'hayır'}
                </Text>
              ) : null}

              <Text style={[AdminStil.kartAlt, { fontWeight: '700' }]}>Gerekçe kodu</Text>
              <View style={styles.kodSatir}>
                {VERIFY_RED_KODLARI.map((k) => {
                  const secili = secilenKod === k.kod;
                  return (
                    <Pressable
                      key={k.kod}
                      onPress={() => setSecilenKod(secili ? null : k.kod)}
                      style={[styles.kod, secili && styles.kodSecili]}
                    >
                      <Text style={[styles.kodYazi, secili && { color: RenkTokenlari.accent, fontWeight: '800' }]}>
                        {k.etiket}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={not}
                onChangeText={setNot}
                placeholder="Karar notu (isteğe bağlı) · ret ve belge talebinde zorunlu"
                placeholderTextColor={RenkTokenlari.textDim}
                style={[AdminStil.input, { minHeight: 84, textAlignVertical: 'top' }]}
                multiline
                maxLength={2000}
              />

              <View style={styles.dugmeSatir}>
                <Pressable
                  style={[styles.dugme, { backgroundColor: RenkTokenlari.surface }]}
                  disabled={islemde != null}
                  onPress={() => void islemYap('start_review')}
                >
                  <Text style={styles.dugmeYazi}>İncelemeye al</Text>
                </Pressable>
                <Pressable
                  style={[styles.dugme, { backgroundColor: RenkTokenlari.surface }]}
                  disabled={islemde != null}
                  onPress={() => void islemYap('request_document')}
                >
                  <Text style={styles.dugmeYazi}>Ek belge iste</Text>
                </Pressable>
                <Pressable
                  style={[styles.dugme, { backgroundColor: RenkTokenlari.surface }]}
                  disabled={islemde != null}
                  onPress={() => void islemYap('request_selfie')}
                >
                  <Text style={styles.dugmeYazi}>Yeniden selfie</Text>
                </Pressable>
                <Pressable
                  style={[styles.dugme, { backgroundColor: RenkTokenlari.surface }]}
                  disabled={islemde != null}
                  onPress={() => void islemYap('additional_verification')}
                >
                  <Text style={styles.dugmeYazi}>Ek doğrulama</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dugme,
                    { backgroundColor: onayYetkisi ? RenkTokenlari.mint : RenkTokenlari.surface },
                    !onayYetkisi && { opacity: 0.45 },
                  ]}
                  disabled={islemde != null || !onayYetkisi}
                  onPress={() => void islemYap('approve')}
                >
                  <Text style={[styles.dugmeYazi, onayYetkisi && { color: RenkTokenlari.bg }]}>
                    Onayla
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dugme,
                    { borderWidth: 1, borderColor: RenkTokenlari.danger },
                    !redYetkisi && { opacity: 0.45 },
                  ]}
                  disabled={islemde != null || !redYetkisi}
                  onPress={() => void islemYap('reject')}
                >
                  <Text style={[styles.dugmeYazi, { color: RenkTokenlari.danger }]}>Reddet</Text>
                </Pressable>
              </View>
              {!onayYetkisi || !redYetkisi ? (
                <Text style={AdminStil.kartAlt}>
                  Onay/ret için identity.approve veya identity.reject izni gerekir.
                </Text>
              ) : null}
            </View>

            {/* İtiraz */}
            {detay?.appeal ? (
              <>
                <Text style={AdminStil.sectionLabel}>İtiraz</Text>
                <View style={AdminStil.kart}>
                  <Text style={AdminStil.kartBaslik}>Durum: {detay.appeal.status}</Text>
                  <Text style={AdminStil.kartAlt}>{detay.appeal.message}</Text>
                  <Text style={AdminStil.kartAlt}>
                    {tarih(detay.appeal.created_at)} · İnceleme: {tarih(detay.appeal.reviewed_at)}
                  </Text>
                  {detay.appeal.resolution_note ? (
                    <Text style={AdminStil.kartAlt}>Not: {detay.appeal.resolution_note}</Text>
                  ) : null}
                  {detay.appeal.status === 'open' || detay.appeal.status === 'reviewing' ? (
                    <>
                      <TextInput
                        value={itirazNotu}
                        onChangeText={setItirazNotu}
                        placeholder="İtiraz kararı notu (en az 5 karakter)"
                        placeholderTextColor={RenkTokenlari.textDim}
                        style={[AdminStil.input, { minHeight: 70, textAlignVertical: 'top' }]}
                        multiline
                        maxLength={2000}
                      />
                      <View style={styles.dugmeSatir}>
                        <Pressable
                          style={[styles.dugme, { backgroundColor: RenkTokenlari.mint }]}
                          disabled={islemde != null}
                          onPress={() => void itirazKarar('reopen')}
                        >
                          <Text style={[styles.dugmeYazi, { color: RenkTokenlari.bg }]}>
                            Yeniden incele
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.dugme, { borderWidth: 1, borderColor: RenkTokenlari.danger }]}
                          disabled={islemde != null}
                          onPress={() => void itirazKarar('rejected')}
                        >
                          <Text style={[styles.dugmeYazi, { color: RenkTokenlari.danger }]}>
                            İtirazı reddet
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              </>
            ) : null}

            {/* Olay geçmişi */}
            <Text style={AdminStil.sectionLabel}>Süreç kaydı</Text>
            {!detay?.events.length ? (
              <Text style={AdminStil.bos}>Kayıt yok</Text>
            ) : (
              detay.events.map((e) => (
                <View key={e.id} style={[AdminStil.kart, { gap: 2 }]}>
                  <Text style={AdminStil.kartAlt}>
                    {e.action} · {e.from_status ?? '-'} → {e.to_status ?? '-'}
                  </Text>
                  <Text style={AdminStil.kartAlt} numberOfLines={2}>
                    {e.reason ?? e.note ?? '-'}
                  </Text>
                  <Text style={[AdminStil.kartAlt, { fontSize: 10 }]}>
                    {e.actor_name ?? e.actor_id?.slice(0, 8) ?? 'sistem'} · {tarih(e.created_at)}
                  </Text>
                </View>
              ))
            )}

            {/* Denetim */}
            <Text style={AdminStil.sectionLabel}>Erişim denetimi</Text>
            {!denetim.length ? (
              <Text style={AdminStil.bos}>Denetim kaydı yok</Text>
            ) : (
              denetim.slice(0, 20).map((a) => (
                <Text key={a.id} style={[AdminStil.kartAlt, { fontSize: 10.5 }]}>
                  {a.action} · {a.actor_name ?? a.actor_id?.slice(0, 8) ?? '-'} · {a.purpose ?? '-'}{' '}
                  · {tarih(a.created_at)}
                </Text>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={acikBelge != null}
        animationType="fade"
        transparent
        onRequestClose={() => setAcikBelge(null)}
      >
        <View style={styles.viewerKap}>
          <View style={styles.viewerUst}>
            <Text style={styles.viewerBaslik}>
              {acikBelge ? YAN_ETIKET[acikBelge.belge.side] ?? acikBelge.belge.side : ''}
            </Text>
            <Text style={styles.viewerSure}>{kalanSaniye} sn</Text>
            <Pressable onPress={() => setAcikBelge(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          {acikBelge ? (
            <Image source={{ uri: acikBelge.url }} style={styles.viewerResim} resizeMode="contain" />
          ) : null}
          <Text style={styles.viewerAlt}>
            Bağlantı kısa ömürlüdür ve paylaşılamaz. Bu görüntüleme denetim kaydına yazıldı.
          </Text>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  ikinciOnayKart: {
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}55`,
    backgroundColor: `${RenkTokenlari.accent}12`,
    gap: 6,
  },
  ikinciUst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ikinciBaslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.accent, fontWeight: '800' },
  ikinciAlt: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 10, lineHeight: 14 },
  dugmeSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: YaricapTokenlari.sm,
  },
  dugmeYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '700', fontSize: 11.5 },
  rozetKucuk: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: YaricapTokenlari.pill },
  rozetKucukYazi: { ...TipografiTokenlari.micro, fontSize: 9, fontWeight: '800' },
  uyariYazi: { ...TipografiTokenlari.micro, fontSize: 10, lineHeight: 14 },
  karsilastirmaEtiket: { ...TipografiTokenlari.micro, fontSize: 9, fontWeight: '800' },
  kodSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kod: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  kodSecili: { borderColor: RenkTokenlari.accent, backgroundColor: `${RenkTokenlari.accent}1A` },
  kodYazi: { ...TipografiTokenlari.micro, color: RenkTokenlari.textMuted, fontSize: 9.5 },
  viewerKap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    padding: BoslukTokenlari.lg,
    gap: 10,
  },
  viewerUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: BoslukTokenlari.xl,
  },
  viewerBaslik: { ...TipografiTokenlari.body, color: '#fff', fontWeight: '800', flex: 1 },
  viewerSure: { ...TipografiTokenlari.micro, color: '#fff', fontSize: 10 },
  viewerResim: { flex: 1, width: '100%' },
  viewerAlt: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9.5,
    textAlign: 'center',
  },
});
