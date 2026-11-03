import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../../../src/components/Screen';
import { EkranBasligi } from '../../../../../../src/components/EkranBasligi';
import { useAuth } from '../../../../../../src/contexts/AuthContext';
import { AdminYetkisiVarMi } from '../../../../../../src/moduller/admin/yetki/AdminYetkisiVarMi';
import { AdminStil } from '../../../../../../src/moduller/admin/bilesenler/AdminStil';
import {
  AdminOdemeHesabiDogrula,
  AdminYayinciOdemeBelgesiImzaliUrl,
  AdminYayinciOdemeBelgesiKarar,
  AdminYayinciOdemeProfiliKarar,
  AdminYayinciOnayKuyrugu,
  type YayinciOnayKuyrugu,
  type YayinciOnayOgesi,
} from '../../../../../../src/moduller/admin/finance/AdminYayinciFinanceApi';
import {
  BelgeTuruEtiketi,
  BilgiKutusu,
  Etiket,
  Kart,
  OdemeTalimati,
  OnayliButon,
  ProfilDurumEtiketi,
  Sayi,
  TarihSaat,
  YayinciNav,
} from '../../../../../../src/moduller/admin/finance/bilesenler/YayinciFinanceUi';
import { RenkTokenlari } from '../../../../../../src/tasarim-sistemi/RenkTokenlari';

const FILTRELER = [
  { key: 'all', label: 'Tümü' },
  { key: 'profil', label: 'Ödeme profili' },
  { key: 'belge', label: 'Belgeler' },
  { key: 'hesap', label: 'Banka talimatı' },
] as const;

type Filtre = (typeof FILTRELER)[number]['key'];

const TUR_ETIKET: Record<string, string> = {
  profil: 'Ödeme profili',
  belge: 'Evrak',
  hesap: 'Banka talimatı',
};

const EKSIK_ETIKET: Record<string, string> = {
  profil: 'Profil kaydı',
  ad: 'Ad',
  soyad: 'Soyad',
  telefon: 'Telefon',
  ulke: 'Ülke',
  vergi_no: 'Vergi no',
  sirket_adi: 'Şirket unvanı',
  sirket_vergi_no: 'Şirket vergi no',
  vergi_belgesi: 'Vergi levhası',
  sirket_belgesi: 'Şirket evrakı',
};

const SEMA_ETIKET: Record<string, string> = {
  iban: 'IBAN havalesi',
  uk_iban: 'İngiltere IBAN',
  us_ach: 'ABD banka hesabı (ACH)',
  local_account: 'Yerel banka transferi',
  wallet: 'Mobil cüzdan',
  rib: 'Fransa RIB',
};

function boyut(y: number | null | undefined): string {
  const b = Number(y ?? 0);
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** İmzalı belge bağlantısını yeni sekmede açar (web) / tarayıcıya devreder. */
function belgeyiAc(url: string) {
  const g = globalThis as unknown as { open?: (u: string, t?: string, f?: string) => unknown };
  if (typeof g.open === 'function') {
    g.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}

function BelgeDugmesi({ belgeId }: { belgeId: string }) {
  const [yuk, setYuk] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        disabled={yuk}
        onPress={async () => {
          setYuk(true);
          setHata(null);
          try {
            const url = await AdminYayinciOdemeBelgesiImzaliUrl(belgeId);
            if (!url) throw new Error('Bağlantı üretilemedi');
            belgeyiAc(url);
          } catch (e) {
            setHata(e instanceof Error ? e.message : 'Belge açılamadı');
          } finally {
            setYuk(false);
          }
        }}
        style={AdminStil.aksiyon}
      >
        {yuk ? (
          <ActivityIndicator size="small" color={RenkTokenlari.text} />
        ) : (
          <Text style={AdminStil.aksiyonYazi}>Belgeyi aç</Text>
        )}
      </Pressable>
      {hata ? <Text style={{ color: RenkTokenlari.danger, fontSize: 11 }}>{hata}</Text> : null}
    </View>
  );
}

function OnayKarti({
  oge,
  not_,
  onNot,
  onKarar,
}: {
  oge: YayinciOnayOgesi;
  not_: string;
  onNot: (v: string) => void;
  onKarar: (onay: boolean) => Promise<void>;
}) {
  const d = oge.detay ?? {};
  const eksikler = Array.isArray(d.eksikler) ? (d.eksikler as string[]) : [];

  return (
    <Kart>
      <View style={AdminStil.satir}>
        <Text style={AdminStil.kartBaslik}>
          {oge.ad || '—'}
          {oge.kullanici_adi ? ` · @${oge.kullanici_adi}` : ''}
        </Text>
        <Etiket metin={TUR_ETIKET[oge.tur] ?? oge.tur} renk={RenkTokenlari.accent} />
      </View>
      <Text style={AdminStil.kartAlt}>
        {TarihSaat(oge.gonderim)} · {oge.ulke || '—'} · durum {oge.durum}
      </Text>

      {oge.tur === 'profil' ? (
        <>
          <Text style={AdminStil.kartAlt}>
            Ad soyad {d.ad || '—'} {d.soyad || ''} · telefon{' '}
            {[d.telefon_ulke, d.telefon].filter(Boolean).join(' ') || '—'}
          </Text>
          <Text style={AdminStil.kartAlt}>
            Vergi no {d.vergi_no || '—'} · daire {d.vergi_dairesi || '—'} · şirket{' '}
            {d.sirket_var ? d.sirket_adi || 'var' : 'yok'}
          </Text>
          {d.sirket_var ? (
            <Text style={AdminStil.kartAlt}>
              Şirket vergi no {d.sirket_vergi_no || '—'} · ülke {d.sirket_ulke || '—'}
            </Text>
          ) : null}
          <Text style={AdminStil.kartAlt}>
            {eksikler.length
              ? `Eksik: ${eksikler.map((e) => EKSIK_ETIKET[e] ?? e).join(', ')}`
              : 'Zorunlu alanlar tamam'}
          </Text>
        </>
      ) : null}

      {oge.tur === 'belge' ? (
        <>
          <Text style={AdminStil.kartAlt}>
            {BelgeTuruEtiketi(String(d.doc_type ?? ''))} · sürüm {Sayi(d.version)} ·{' '}
            {String(d.mime ?? '—')} · {boyut(d.byte_size)}
          </Text>
          <Text style={AdminStil.kartAlt}>
            Dosya {d.file_name || '—'} · profil {d.profil_durumu || '—'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <BelgeDugmesi belgeId={oge.kayit_id} />
          </View>
        </>
      ) : null}

      {oge.tur === 'hesap' ? (
        <>
          <Text style={AdminStil.kartAlt}>
            {d.account_holder || '—'} · {d.bank_name || '—'} · {d.iban_masked || '—'} ·{' '}
            {oge.ulke || '—'} / {d.currency || '—'}
          </Text>
          <Text style={AdminStil.kartAlt}>
            Şema {SEMA_ETIKET[String(d.scheme ?? '')] ?? String(d.scheme ?? '—')} · yöntem{' '}
            {String(d.method ?? '—')}
            {d.details_masked
              ? ` · ${Object.entries(d.details_masked as Record<string, string>)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}`
              : ''}
          </Text>
          <OdemeTalimati accountId={oge.kayit_id} kompakt />
        </>
      ) : null}

      <TextInput
        style={AdminStil.input}
        value={not_}
        onChangeText={onNot}
        placeholder="Gerekçe / not (ret için zorunlu, denetim kaydına yazılır)"
        placeholderTextColor={RenkTokenlari.textDim}
      />

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <OnayliButon
          etiket={oge.tur === 'belge' ? 'Belgeyi onayla' : 'Onayla'}
          onOnay={() => onKarar(true)}
        />
        <OnayliButon etiket="Reddet" tehlike onOnay={() => onKarar(false)} />
        <Pressable
          onPress={() => router.push(`/admin/finance/yayinci/${oge.user_id}` as any)}
          style={AdminStil.aksiyon}
        >
          <Text style={AdminStil.aksiyonYazi}>Yayıncı detayı</Text>
        </Pressable>
      </View>
    </Kart>
  );
}

export default function YayinciOnaylariEkrani() {
  const { profile } = useAuth();
  const admin = AdminYetkisiVarMi(profile);

  const [kuyruk, setKuyruk] = useState<YayinciOnayKuyrugu | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      setKuyruk(await AdminYayinciOnayKuyrugu());
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Onay kuyruğu yüklenemedi');
      setKuyruk(null);
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

  const sayilar = kuyruk?.sayilar;
  const tumItems = kuyruk?.items ?? [];
  const gorunen = filtre === 'all' ? tumItems : tumItems.filter((i) => i.tur === filtre);

  async function kararUygula(oge: YayinciOnayOgesi, onay: boolean) {
    const not_ = (notlar[oge.kayit_id] ?? '').trim();
    if (!onay && !not_) throw new Error('Ret için gerekçe zorunlu');

    if (oge.tur === 'profil') {
      await AdminYayinciOdemeProfiliKarar(oge.user_id, onay ? 'verified' : 'rejected', not_);
    } else if (oge.tur === 'belge') {
      await AdminYayinciOdemeBelgesiKarar(oge.kayit_id, onay ? 'approved' : 'rejected', not_);
    } else {
      await AdminOdemeHesabiDogrula(oge.kayit_id, onay ? 'verified' : 'rejected', not_);
    }

    setNotlar((eski) => ({ ...eski, [oge.kayit_id]: '' }));
    await yukle();
  }

  return (
    <Screen>
      <EkranBasligi title="Ödeme Onayları" subtitle="Profil · evrak · banka talimatı" />
      <ScrollView
        contentContainerStyle={AdminStil.content}
        refreshControl={<RefreshControl refreshing={yukleniyor} onRefresh={yukle} />}
      >
        <YayinciNav />

        <BilgiKutusu
          baslik="Kuyruk kuralları"
          metin="Yayıncı ödeme profilini tamamlayıp gönderdiğinde profil, yüklediği her evrak ve banka talimatı buraya düşer. Onay/ret sunucuda denetim kaydı bırakır; ret gerekçesi kullanıcıya bildirim olarak gider. Banka talimatı doğrulanmadan yayıncı ödeme listesine alınmaz."
        />

        {sayilar && sayilar.kazanc > 0 ? (
          <Pressable
            onPress={() => router.push('/admin/finance/yayinci/bekleyen' as any)}
            style={[AdminStil.kart, { borderColor: RenkTokenlari.accent }]}
          >
            <View style={AdminStil.satir}>
              <Text style={AdminStil.kartBaslik}>Bekleyen yayıncı kazancı</Text>
              <Etiket metin={`${Sayi(sayilar.kazanc)} kayıt`} renk={RenkTokenlari.accent} />
            </View>
            <Text style={AdminStil.kartAlt}>
              Onay bekleyen, incelemede, ödemeye hazır ve ödeme işlemindeki kazanç kayıtlarını
              görmek için dokun.
            </Text>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {FILTRELER.map((f) => {
            const adet =
              f.key === 'all' ? tumItems.length : tumItems.filter((i) => i.tur === f.key).length;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFiltre(f.key)}
                style={[
                  AdminStil.aksiyon,
                  filtre === f.key && { borderColor: RenkTokenlari.borderAccent },
                ]}
              >
                <Text style={AdminStil.aksiyonYazi}>
                  {f.label} ({adet})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sayilar ? (
          <Text style={AdminStil.kartAlt}>
            Onay bekleyen: {Sayi(sayilar.profil)} profil · {Sayi(sayilar.belge)} belge ·{' '}
            {Sayi(sayilar.hesap)} banka talimatı
          </Text>
        ) : null}

        {hata ? <Text style={{ color: RenkTokenlari.danger }}>{hata}</Text> : null}

        {yukleniyor && !kuyruk ? (
          <ActivityIndicator color={RenkTokenlari.primarySoft} />
        ) : gorunen.length === 0 ? (
          <Text style={AdminStil.bos}>Bu filtrede onay bekleyen kayıt yok</Text>
        ) : (
          gorunen.map((oge) => (
            <OnayKarti
              key={`${oge.tur}:${oge.kayit_id}`}
              oge={oge}
              not_={notlar[oge.kayit_id] ?? ''}
              onNot={(v) => setNotlar((eski) => ({ ...eski, [oge.kayit_id]: v }))}
              onKarar={(onay) => kararUygula(oge, onay)}
            />
          ))
        )}

        <BilgiKutusu
          baslik="Durum anlamları"
          metin="Onaylanan ödeme profili 'verified' olur ve profil içeriği değişirse yeniden incelemeye döner. Reddedilen evrak kullanıcıya bildirilir ve profil 'incomplete' durumuna geçer; yeni sürüm yüklendiğinde tekrar buraya düşer. Doğrulanmış banka talimatı değişirse yeniden doğrulama gerekir."
        />
      </ScrollView>
    </Screen>
  );
}
