import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminOdemeHesabiDogrula,
  AdminYayinciDetay,
  AdminYayinciOdemeProfiliGetir,
  AdminYayinciProgramDurum,
  AdminYayinciVergiDurum,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BelgeTuruEtiketi,
  BilgiKutusu,
  Etiket,
  Kart,
  KazancDurumEtiketi,
  OdemeTalimati,
  OgeDurumEtiketi,
  OnayliButon,
  ProfilDurumEtiketi,
  Sayi,
  Tarih,
  TarihSaat,
  Usd,
  YayinciNav,
  durumRengi,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

/**
 * Tek yayıncı finans detayı — program onayı, ödeme hesabı doğrulaması,
 * vergi durumu ve kazanç/ödeme geçmişi. Tutarlar sunucudaki defterden gelir;
 * bu ekran hiçbir finansal hesaplama yapmaz.
 */
export default function YayinciDetayEkrani() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [veri, setVeri] = useState<any | null>(null);
  const [odeme, setOdeme] = useState<any | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [not_, setNot] = useState('');
  const [vkn, setVkn] = useState('');

  const yukle = useCallback(async () => {
    if (!userId) return;
    setYukleniyor(true);
    setHata(null);
    try {
      const [detay, odemeProfili] = await Promise.all([
        AdminYayinciDetay(String(userId)),
        AdminYayinciOdemeProfiliGetir(String(userId)).catch(() => null),
      ]);
      setVeri(detay);
      setOdeme(odemeProfili);
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setYukleniyor(false);
    }
  }, [userId]);

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

  async function islem(fn: () => Promise<unknown>) {
    try {
      await fn();
      setNot('');
      await yukle();
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'İşlem başarısız');
      throw e;
    }
  }

  const p = veri?.profile ?? {};
  const enr = veri?.enrollment ?? null;
  const hesap = veri?.payout_account ?? null;
  const t = veri?.totals ?? {};
  const elig = veri?.eligibility ?? {};

  return (
    <Screen>
      <EkranBasligi title="Yayıncı detayı" subtitle="Program · ödeme hesabı · kazanç geçmişi" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: RenkTokenlari.bgCard,
              borderWidth: 1,
              borderColor: RenkTokenlari.border,
            }}
          >
            <Text style={{ color: RenkTokenlari.text, fontSize: 12, fontWeight: '600' }}>
              ← Genel Bakış
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/admin/finance/users/${String(userId)}` as any)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: RenkTokenlari.bgCard,
              borderWidth: 1,
              borderColor: RenkTokenlari.borderAccent,
            }}
          >
            <Text style={{ color: RenkTokenlari.text, fontSize: 12, fontWeight: '600' }}>
              Coin finans detayı
            </Text>
          </Pressable>
        </View>

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !veri ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : !veri ? (
          <Text style={AdminStil.bos}>Yayıncı bulunamadı</Text>
        ) : (
          <>
            <Kart baslik={p.display_name || p.username || '—'} alt={`${p.country_code || '—'} · ${String(userId)}`}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Etiket metin={`program ${enr?.status ?? 'none'}`} renk={durumRengi(enr?.status)} />
                <Etiket metin={`KYC ${elig.kyc_status ?? '—'}`} renk={durumRengi(elig.kyc_status)} />
                <Etiket
                  metin={`hesap ${hesap?.status ?? 'yok'}`}
                  renk={durumRengi(hesap?.status)}
                />
                <Etiket
                  metin={`vergi ${enr?.tax_status ?? 'pending'}`}
                  renk={durumRengi(enr?.tax_status === 'complete' ? 'verified' : 'pending')}
                />
                <Etiket
                  metin={elig.eligible ? 'Ödemeye uygun' : 'Uygun değil'}
                  renk={elig.eligible ? RenkTokenlari.mint : RenkTokenlari.accent}
                />
              </View>
              <Text style={AdminStil.kartAlt}>
                Ödemeye hazır {Usd(t.available_usd)} · bekleyen {Usd(t.pending_usd)} · incelemede{' '}
                {Usd(t.on_hold_usd)} · ödeme işleminde {Usd(t.in_payout_usd)} · ödenmiş{' '}
                {Usd(t.paid_usd)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Yaşam boyu uygun gelir {Usd(t.lifetime_gross_usd)} · yayıncı payı{' '}
                {Usd(t.lifetime_creator_usd)} · platform {Usd(t.lifetime_platform_usd)} · elmas{' '}
                {Sayi(t.diamonds)} · işlem {Sayi(t.created_count)}
              </Text>
              <Text style={AdminStil.kartAlt}>
                Uygulanmamış düzeltme {Usd(t.adjustments_usd)} · uygunsuz işlem{' '}
                {Sayi(t.ineligible_count)}
              </Text>
            </Kart>

            {elig.eligible === false ? (
              <BilgiKutusu
                baslik="Uygunluk engelleri"
                metin={`Yaş: ${elig.is_adult ? 'uygun' : 'uygun değil'} · program: ${
                  elig.program_approved ? 'onaylı' : 'onaylı değil'
                } · KYC: ${elig.kyc_verified ? 'doğrulanmış' : 'doğrulanmamış'} · ödeme hesabı: ${
                  elig.payout_account_verified ? 'doğrulanmış' : 'doğrulanmamış'
                } · vergi: ${elig.tax_complete ? 'tamam' : 'eksik'} · açık yüksek risk: ${
                  elig.open_high_risk ? 'var' : 'yok'
                }. Eksik olan doğrulama tamamlanmadan ödeme listesine alınmaz.`}
                tehlike
              />
            ) : null}

            <Kart
              baslik="Program durumu"
              alt="Program değişikliği geçmiş kazançları silmez; yalnızca yeni ödemeleri etkiler. Askı ve ret için gerekçe zorunludur."
            >
              <TextInput
                style={AdminStil.input}
                value={not_}
                onChangeText={setNot}
                placeholder="Gerekçe / not (denetim kaydına yazılır)"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <OnayliButon
                  etiket="Onayla"
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciProgramDurum(String(userId), 'approved', not_))}
                />
                <OnayliButon
                  etiket="Askıya al"
                  tehlike
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciProgramDurum(String(userId), 'suspended', not_))}
                />
                <OnayliButon
                  etiket="Reddet"
                  tehlike
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciProgramDurum(String(userId), 'rejected', not_))}
                />
                <OnayliButon
                  etiket="Başvuruya al"
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciProgramDurum(String(userId), 'applied', not_))}
                />
              </View>
              {enr ? (
                <Text style={AdminStil.kartAlt}>
                  Başvuru {TarihSaat(enr.applied_at)} · onay {TarihSaat(enr.approved_at)} · sözleşme{' '}
                  {TarihSaat(enr.contract_accepted_at)} · ret {enr.rejection_reason || '—'} · askı{' '}
                  {enr.suspended_reason || '—'}
                </Text>
              ) : (
                <Text style={AdminStil.kartAlt}>Kullanıcı henüz yayıncı programına başvurmadı.</Text>
              )}
            </Kart>

            <Kart
              baslik="Ödeme profili (vergi / şirket)"
              alt="Yayıncının gönderdiği profil, evrak sürümleri ve eksik listesi. Onay/ret işlemleri Ödeme Onayları ekranında yapılır."
            >
              {odeme?.profile ? (
                <>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Etiket
                      metin={ProfilDurumEtiketi(odeme.profile.status)}
                      renk={durumRengi(odeme.profile.status)}
                    />
                    <Etiket metin={`gönderim ${TarihSaat(odeme.profile.submitted_at)}`} />
                    <Etiket metin={`doğrulama ${TarihSaat(odeme.profile.verified_at)}`} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {odeme.profile.legal_first_name} {odeme.profile.legal_last_name} ·{' '}
                    {odeme.profile.country_code} ·{' '}
                    {[odeme.profile.phone_country_code, odeme.profile.phone]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Vergi no {odeme.profile.tax_number || '—'} · daire{' '}
                    {odeme.profile.tax_office || '—'} · şirket{' '}
                    {odeme.profile.has_company ? odeme.profile.company_name || 'var' : 'yok'}
                    {odeme.profile.has_company
                      ? ` · ${odeme.profile.company_tax_number || '—'}`
                      : ''}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    {Array.isArray(odeme.eksikler) && odeme.eksikler.length
                      ? `Eksik: ${odeme.eksikler.join(', ')}`
                      : 'Zorunlu alanlar tamam'}
                  </Text>
                  {(odeme.documents ?? []).length === 0 ? (
                    <Text style={AdminStil.kartAlt}>Evrak yüklenmemiş</Text>
                  ) : (
                    (odeme.documents ?? []).map((d: any) => (
                      <Text key={d.id} style={AdminStil.kartAlt}>
                        {BelgeTuruEtiketi(d.doc_type)} · sürüm {d.version} · {d.status}
                        {d.review_note ? ` · ${d.review_note}` : ''}
                      </Text>
                    ))
                  )}
                  <Pressable
                    onPress={() => router.push('/admin/finance/yayinci/onaylar' as any)}
                    style={AdminStil.aksiyon}
                  >
                    <Text style={AdminStil.aksiyonYazi}>Ödeme onayları ekranında incele</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={AdminStil.bos}>Ödeme profili henüz gönderilmedi</Text>
              )}
            </Kart>

            <Kart
              baslik="Ödeme hesabı"
              alt="Maskeli talimat gösterilir. Tam hesap bilgisi yalnızca 'Ödeme talimatını göster' ile, denetim kaydı bırakılarak açılır. Doğrulama öncesi hesap ödeme listesine alınmaz."
            >
              {hesap ? (
                <>
                  <Text style={AdminStil.kartAlt}>
                    {hesap.account_holder} · {hesap.bank_name || '—'} ·{' '}
                    {hesap.iban_masked || '—'} · {hesap.country_code || '—'} / {hesap.currency} ·{' '}
                    {hesap.method}
                  </Text>
                  {hesap.scheme ? (
                    <Text style={AdminStil.kartAlt}>
                      Talimat türü: {hesap.scheme}
                      {hesap.details_masked
                        ? ` · ${Object.entries(hesap.details_masked as Record<string, string>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}`
                        : ''}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Etiket metin={hesap.status} renk={durumRengi(hesap.status)} />
                    <Etiket metin={`son değişiklik ${Tarih(hesap.last_changed_at)}`} />
                  </View>
                  <OdemeTalimati accountId={hesap.id} />
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <OnayliButon
                      etiket="Doğrula"
                      onOnay={() =>
                        islem(() => AdminOdemeHesabiDogrula(hesap.id, 'verified', not_))
                      }
                    />
                    <OnayliButon
                      etiket="Reddet"
                      tehlike
                      onOnay={() =>
                        islem(() => AdminOdemeHesabiDogrula(hesap.id, 'rejected', not_))
                      }
                    />
                    <OnayliButon
                      etiket="Devre dışı bırak"
                      tehlike
                      onOnay={() =>
                        islem(() => AdminOdemeHesabiDogrula(hesap.id, 'disabled', not_))
                      }
                    />
                  </View>
                </>
              ) : (
                <Text style={AdminStil.bos}>Kayıtlı ödeme hesabı yok</Text>
              )}
            </Kart>

            <Kart
              baslik="Vergi bilgisi"
              alt="Vergi durumu yalnızca doğrulama kaydıdır; tutar hesaplamaz. Referans alanı zorunlu değildir."
            >
              <TextInput
                style={AdminStil.input}
                value={vkn}
                onChangeText={setVkn}
                placeholder="Vergi / VKN referansı"
                placeholderTextColor={RenkTokenlari.textDim}
              />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <OnayliButon
                  etiket="Tamamlandı"
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciVergiDurum(String(userId), 'complete', vkn))}
                />
                <OnayliButon
                  etiket="Gerekli değil"
                  disabled={!enr}
                  onOnay={() =>
                    islem(() => AdminYayinciVergiDurum(String(userId), 'not_required', vkn))
                  }
                />
                <OnayliButon
                  etiket="Bekliyor"
                  disabled={!enr}
                  onOnay={() => islem(() => AdminYayinciVergiDurum(String(userId), 'pending'))}
                />
              </View>
              <Text style={AdminStil.kartAlt}>
                Mevcut durum: {enr?.tax_status ?? 'pending'} · referans {enr?.tax_reference || '—'}
              </Text>
            </Kart>

            <Text style={AdminStil.sectionLabel}>Son kazanç kayıtları</Text>
            {(veri.entries ?? []).length === 0 ? (
              <Text style={AdminStil.bos}>Kayıt yok</Text>
            ) : (
              (veri.entries ?? []).map((e: any) => (
                <View key={e.id} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>
                      {Usd(e.creator_usd)} · {e.coin_source}
                    </Text>
                    <Etiket metin={KazancDurumEtiketi(e.status)} renk={durumRengi(e.status)} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    {TarihSaat(e.created_at)} · {e.channel} · {Sayi(e.coins)} coin · gelir{' '}
                    {Usd(e.gross_usd)}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Platform {Usd(e.platform_usd)} · net {Usd(e.net_usd)} · dönem{' '}
                    {Tarih(e.period_start)}
                    {e.eligible ? '' : ` · uygun değil: ${e.ineligible_reason || '—'}`}
                  </Text>
                </View>
              ))
            )}

            <Text style={AdminStil.sectionLabel}>Ödeme geçmişi</Text>
            {(veri.payouts ?? []).length === 0 ? (
              <Text style={AdminStil.bos}>Ödeme kaydı yok</Text>
            ) : (
              (veri.payouts ?? []).map((i: any) => (
                <View key={i.id} style={AdminStil.kart}>
                  <View style={AdminStil.satir}>
                    <Text style={AdminStil.kartBaslik}>{Usd(i.net_usd)}</Text>
                    <Etiket metin={OgeDurumEtiketi(i.status)} renk={durumRengi(i.status)} />
                  </View>
                  <Text style={AdminStil.kartAlt}>
                    Dönem {Tarih(i.period_month)} · ödeme günü {Tarih(i.payout_date)} · parti{' '}
                    {i.batch_status}
                  </Text>
                  <Text style={AdminStil.kartAlt}>
                    Gönderim {TarihSaat(i.sent_at)} · tamamlanma {TarihSaat(i.paid_at)} · referans{' '}
                    {i.external_reference || '—'}
                    {i.failure_reason ? ` · hata ${i.failure_reason}` : ''}
                  </Text>
                </View>
              ))
            )}

            <BilgiKutusu
              baslik="Yetki sınırı"
              metin="Bu ekran kazanç tutarlarını değiştiremez. Düzeltme yalnızca 'Bekleyen Gelirler' ekranındaki gerekçeli ters kayıt aracıyla yapılır; her işlem denetim kaydına yazılır."
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
