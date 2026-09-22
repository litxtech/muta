import React, { useCallback, useState } from 'react';
import { Alert, Image, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansBolumBaslik,
  AjansCta,
  AjansHint,
  AjansInput,
  AjansKart,
  AjansListeSatir,
} from '../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import { useAjansRouteId, ajansHref } from '../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansKurallariKaydet,
  AjansOdemeSablonuKaydet,
  AjansPanelDetayGetir,
  AjansSil,
  type AjansPanelDetay,
} from '../../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import {
  AjansAkademiEkle,
  AjansAkademiListesi,
  AjansFormGetir,
  AjansFormKaydet,
  AjansKanalHazirla,
  AjansKanalListesi,
  AjansOdulTanimla,
  AjansStaffListesi,
  AjansStaffYetkiAyarla,
} from '../../../src/moduller/ajanslar/islemler/AjansYonetimV2Islemleri';
import {
  AjansMedyaYukle,
  AjansProfilGuncelle,
} from '../../../src/moduller/ajanslar/okuma/AjansProfilGetir';
import { MedyaUriGuvenli } from '../../../src/moduller/mesajlasma/yardimcilar/MedyaUriGecerliMi';
import { RenkTokenlari } from '../../../src/tasarim-sistemi/RenkTokenlari';

const YONETICI_TOGGLELARI: Array<{ code: string; label: string }> = [
  { code: 'agency.manage_members', label: 'Üyeleri yönet' },
  { code: 'agency.manage_applications', label: 'Başvuruları yönet' },
  { code: 'agency.manage_announcements', label: 'Duyuru gönder' },
  { code: 'agency.manage_events', label: 'Etkinlik oluştur' },
  { code: 'agency.manage_schedule', label: 'Program yönet' },
  { code: 'agency.view_analytics', label: 'Analitik gör' },
  { code: 'agency.view_finance', label: 'İşlemleri gör' },
  { code: 'agency.manage_coin_operations', label: 'Coin işlemi yap' },
  { code: 'agency.manage_profile', label: 'Ajans profilini değiştir' },
  { code: 'agency.manage_support', label: 'Destek taleplerini gör' },
];

export default function AjansAyarlarEkrani() {
  const id = useAjansRouteId();
  const [detay, setDetay] = useState<AjansPanelDetay | null>(null);
  const [ad, setAd] = useState('');
  const [slogan, setSlogan] = useState('');
  const [ulke, setUlke] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [kurallar, setKurallar] = useState('');
  const [holder, setHolder] = useState('');
  const [banka, setBanka] = useState('');
  const [iban, setIban] = useState('');
  const [telefon, setTelefon] = useState('');
  const [odemeNot, setOdemeNot] = useState('');
  const [staff, setStaff] = useState<Array<Record<string, unknown>>>([]);
  const [seciliStaff, setSeciliStaff] = useState<string | null>(null);
  const [akademi, setAkademi] = useState<Array<Record<string, unknown>>>([]);
  const [akademiBaslik, setAkademiBaslik] = useState('');
  const [kanallar, setKanallar] = useState<Array<Record<string, unknown>>>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AjansPanelDetayGetir(id);
      setDetay(d);
      setAd(d.agency.name ?? '');
      setSlogan(d.agency.slogan ?? '');
      setUlke(d.agency.country ?? '');
      setAciklama(d.agency.description ?? '');
      setKurallar(d.rules?.body ?? '');
      setHolder(d.payment_template?.account_holder ?? '');
      setBanka(d.payment_template?.bank_name ?? '');
      setIban(d.payment_template?.iban ?? '');
      setTelefon(d.payment_template?.phone ?? '');
      setOdemeNot(d.payment_template?.note ?? '');
      const [s, a, k] = await Promise.all([
        AjansStaffListesi(id).catch(() => []),
        AjansAkademiListesi(id).catch(() => []),
        AjansKanalListesi(id).catch(() => []),
      ]);
      setStaff(s);
      setAkademi(a);
      setKanallar(k);
    } catch {
      setDetay(null);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void yukle(); }, [yukle]));

  const logoUrl = MedyaUriGuvenli(detay?.agency.logo_url);
  const bannerUrl = MedyaUriGuvenli(detay?.agency.banner_url);
  const secili = staff.find((s) => s.user_id === seciliStaff);
  const overrides = (secili?.overrides as Array<{ permission: string; granted: boolean }>) ?? [];

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title="Ayarlar"
      subtitle="Profil · roller · akademi"
      aktif="ayarlar"
      yukleniyor={yukleniyor && !detay}
      refreshing={yukleniyor && !!detay}
      onRefresh={() => void yukle()}
    >
      <AjansBolumBaslik>Ajans profili</AjansBolumBaslik>
      <AjansKart>
        {(bannerUrl || logoUrl) && (
          <View>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: 80, borderRadius: 8 }} />
            ) : null}
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 48, height: 48, borderRadius: 12, marginTop: -24, marginLeft: 12 }}
              />
            ) : null}
          </View>
        )}
        <AjansCta
          ghost
          label="Logo yükle"
          onPress={() => {
            void (async () => {
              setBusy(true);
              const r = await AjansMedyaYukle({ agencyId: id, tur: 'logo' });
              setBusy(false);
              if (!r.ok && !r.iptal) Alert.alert('Medya', r.hata);
              else await yukle();
            })();
          }}
        />
        <AjansCta
          ghost
          label="Banner yükle"
          onPress={() => {
            void (async () => {
              setBusy(true);
              const r = await AjansMedyaYukle({ agencyId: id, tur: 'banner' });
              setBusy(false);
              if (!r.ok && !r.iptal) Alert.alert('Medya', r.hata);
              else await yukle();
            })();
          }}
        />
        <AjansInput value={ad} onChangeText={setAd} placeholder="Ajans adı" />
        <AjansInput value={slogan} onChangeText={setSlogan} placeholder="Slogan" />
        <AjansInput value={ulke} onChangeText={setUlke} placeholder="Ülke" />
        <AjansInput value={aciklama} onChangeText={setAciklama} placeholder="Açıklama" multiline />
        <AjansCta
          label="Profili kaydet"
          onPress={() => {
            void (async () => {
              const r = await AjansProfilGuncelle({
                agencyId: id,
                name: ad.trim(),
                slogan: slogan.trim() || undefined,
                country: ulke.trim() || undefined,
                description: aciklama.trim() || undefined,
              });
              if (!r.ok) Alert.alert('Profil', r.hata);
              else Alert.alert('Tamam', 'Güncellendi');
            })();
          }}
        />
        <AjansCta
          ghost
          label="Davetler"
          onPress={() => router.push(ajansHref(id, 'davetler') as any)}
        />
      </AjansKart>

      <AjansBolumBaslik>Yönetici yetkileri</AjansBolumBaslik>
      <AjansKart>
        {staff.length === 0 ? (
          <AjansHint>Henüz staff yok — üye detayından rol ata</AjansHint>
        ) : (
          staff.map((s) => (
            <AjansListeSatir
              key={String(s.user_id)}
              title={`${s.display_name || s.username} · ${s.role_code}`}
              subtitle="Yetki toggle için seç"
              onPress={() => setSeciliStaff(String(s.user_id))}
            />
          ))
        )}
        {seciliStaff ? (
          <View style={{ gap: 8 }}>
            {YONETICI_TOGGLELARI.map((t) => {
              const override = overrides.find((o) => o.permission === t.code);
              const granted = override?.granted ?? false;
              return (
                <View
                  key={t.code}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ color: RenkTokenlari.text, flex: 1 }}>{t.label}</Text>
                  <Switch
                    value={granted}
                    disabled={busy}
                    onValueChange={(v) => {
                      void (async () => {
                        setBusy(true);
                        const r = await AjansStaffYetkiAyarla({
                          agencyId: id,
                          userId: seciliStaff,
                          permission: t.code,
                          granted: v,
                        });
                        setBusy(false);
                        if (!r.ok) Alert.alert('Yetki', r.hata);
                        else await yukle();
                      })();
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </AjansKart>

      <AjansBolumBaslik>Ajans kanalları</AjansBolumBaslik>
      <AjansKart>
        <AjansCta
          label="Kanalları hazırla"
          onPress={() => {
            void (async () => {
              const r = await AjansKanalHazirla(id);
              if (!r.ok) Alert.alert('Kanal', r.hata);
              else {
                setKanallar(r.kanallar);
                Alert.alert('Tamam', 'Kanallar hazır');
              }
            })();
          }}
        />
        {kanallar.map((k) => (
          <AjansListeSatir
            key={String(k.id)}
            title={String(k.channel_kind)}
            subtitle={String(k.thread_id ?? '')}
            onPress={() =>
              k.thread_id && router.push(`/mesaj/${k.thread_id}` as any)
            }
          />
        ))}
      </AjansKart>

      <AjansBolumBaslik>Akademi</AjansBolumBaslik>
      <AjansKart>
        <AjansInput
          value={akademiBaslik}
          onChangeText={setAkademiBaslik}
          placeholder="Rehber başlığı"
        />
        <AjansCta
          label="Ekle (Başlangıç)"
          onPress={() => {
            void (async () => {
              const r = await AjansAkademiEkle({
                agencyId: id,
                category: 'baslangic',
                title: akademiBaslik.trim() || 'Başlangıç rehberi',
                body: 'Ajans kurallarını oku ve profilini tamamla.',
              });
              if (!r.ok) Alert.alert('Akademi', r.hata);
              else {
                setAkademiBaslik('');
                await yukle();
              }
            })();
          }}
        />
        {akademi.map((a) => (
          <AjansListeSatir
            key={String(a.id)}
            title={String(a.title)}
            subtitle={`${a.category}${a.completed ? ' · tamamlandı' : ''}`}
          />
        ))}
      </AjansKart>

      <AjansBolumBaslik>Başvuru formu</AjansBolumBaslik>
      <AjansKart>
        <AjansCta
          label="Varsayılan formu kaydet"
          onPress={() => {
            void (async () => {
              const r = await AjansFormKaydet({
                agencyId: id,
                title: 'Host Başvuru Formu',
                fields: [
                  {
                    field_type: 'short_text',
                    label: 'Hangi saatlerde aktifsın?',
                    required: true,
                    sort_order: 1,
                  },
                  {
                    field_type: 'single_choice',
                    label: 'Ne tür yayın yapıyorsun?',
                    options: ['Sohbet', 'Müzik', 'Oyun'],
                    required: true,
                    sort_order: 2,
                  },
                  {
                    field_type: 'yes_no',
                    label: 'Daha önce yayın yaptın mı?',
                    required: false,
                    sort_order: 3,
                  },
                ],
              });
              if (!r.ok) Alert.alert('Form', r.hata);
              else {
                const f = await AjansFormGetir(id);
                Alert.alert('Tamam', `${f.fields?.length ?? 0} alan kaydedildi`);
              }
            })();
          }}
        />
        <AjansCta
          ghost
          label="Ödül tanımla (rozet)"
          onPress={() => {
            void (async () => {
              const r = await AjansOdulTanimla({
                agencyId: id,
                rewardType: 'badge',
                title: 'Ajans Yıldızı',
                description: 'Aktif host ödülü',
              });
              if (!r.ok) Alert.alert('Ödül', r.hata);
              else Alert.alert('Tamam', 'Ödül tanımlandı');
            })();
          }}
        />
      </AjansKart>

      <AjansBolumBaslik>Kurallar</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={kurallar} onChangeText={setKurallar} multiline placeholder="Ajans kuralları" />
        <AjansCta
          label="Kuralları kaydet"
          onPress={() => {
            void (async () => {
              const r = await AjansKurallariKaydet({ agencyId: id, body: kurallar });
              if (!r.ok) Alert.alert('Kurallar', r.hata);
              else Alert.alert('Tamam', 'Kaydedildi');
            })();
          }}
        />
      </AjansKart>

      <AjansBolumBaslik>IBAN şablonu</AjansBolumBaslik>
      <AjansKart>
        <AjansInput value={holder} onChangeText={setHolder} placeholder="Hesap sahibi" />
        <AjansInput value={banka} onChangeText={setBanka} placeholder="Banka" />
        <AjansInput value={iban} onChangeText={setIban} placeholder="IBAN" autoCapitalize="characters" />
        <AjansInput value={telefon} onChangeText={setTelefon} placeholder="Telefon" />
        <AjansInput value={odemeNot} onChangeText={setOdemeNot} placeholder="Not" />
        <AjansCta
          label="Ödeme şablonunu kaydet"
          onPress={() => {
            void (async () => {
              const r = await AjansOdemeSablonuKaydet({
                agencyId: id,
                accountHolder: holder,
                bankName: banka,
                iban,
                phone: telefon,
                note: odemeNot,
              });
              if (!r.ok) Alert.alert('Ödeme', r.hata);
              else Alert.alert('Tamam', 'Kaydedildi');
            })();
          }}
        />
      </AjansKart>

      <AjansBolumBaslik>Tehlikeli alan</AjansBolumBaslik>
      <AjansKart>
        <AjansCta
          ghost
          label="Ajansı kapat"
          onPress={() => {
            Alert.alert('Ajansı kapat', 'Emin misin?', [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Kapat',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    const r = await AjansSil(id);
                    if (!r.ok) Alert.alert('Ajans', r.hata);
                    else router.replace('/ajans/yonetim' as any);
                  })();
                },
              },
            ]);
          }}
        />
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}
