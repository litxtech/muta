import React, { memo, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../tasarim-sistemi/TipografiTokenlari';
import {
  YaricapTokenlari,
} from '../../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../../i18n/useCeviri';
import type { CeviriAnahtari } from '../../../../i18n/useCeviri';
import type {
  OdemeBelgeDurumu,
  OdemeBelgeTuru,
  OdemeProfiliBelgesi,
} from '../OdemeProfiliApi';

const BELGE_ETIKET: Record<OdemeBelgeTuru, CeviriAnahtari> = {
  tax_certificate: 'yayinciK.belgeVergiLevha',
  company_registration: 'yayinciK.belgeTicaretSicil',
  company_signature: 'yayinciK.belgeImzaSirkuleri',
  personal_id: 'yayinciK.belgeKimlik',
  bank_letter: 'yayinciK.belgeBankaYazisi',
  address_proof: 'yayinciK.belgeIkametgah',
  other: 'yayinciK.belgeDiger',
};

const BELGE_IPUCU: Record<OdemeBelgeTuru, CeviriAnahtari> = {
  tax_certificate: 'yayinciK.belgeVergiLevhaIpucu',
  company_registration: 'yayinciK.belgeTicaretSicilIpucu',
  company_signature: 'yayinciK.belgeImzaSirkuleriIpucu',
  personal_id: 'yayinciK.belgeKimlikIpucu',
  bank_letter: 'yayinciK.belgeBankaYazisiIpucu',
  address_proof: 'yayinciK.belgeIkametgahIpucu',
  other: 'yayinciK.belgeDigerIpucu',
};

const DURUM_ETIKET: Record<OdemeBelgeDurumu, CeviriAnahtari> = {
  submitted: 'yayinciK.belgeDurumYuklendi',
  under_review: 'yayinciK.belgeDurumIncelemede',
  approved: 'yayinciK.belgeDurumOnaylandi',
  rejected: 'yayinciK.belgeDurumReddedildi',
};

function durumRengi(durum: OdemeBelgeDurumu): string {
  switch (durum) {
    case 'approved':
      return RenkTokenlari.mint;
    case 'rejected':
      return RenkTokenlari.danger;
    case 'under_review':
      return RenkTokenlari.violet;
    default:
      return RenkTokenlari.accent;
  }
}

/** Bir türün en güncel belgesi (liste version desc gelir). */
export function SonBelge(
  belgeler: OdemeProfiliBelgesi[],
  tur: OdemeBelgeTuru,
): OdemeProfiliBelgesi | null {
  const liste = belgeler.filter((b) => b.doc_type === tur);
  if (!liste.length) return null;
  return liste.reduce((a, b) => (b.version > a.version ? b : a));
}

function tarih(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function OdemeBelgeleriKartiIc({
  belgeler,
  gerekli,
  sirketVar,
  profilKayitli,
  yuklenenTur,
  onYukle,
}: {
  belgeler: OdemeProfiliBelgesi[];
  gerekli: OdemeBelgeTuru[];
  sirketVar: boolean;
  profilKayitli: boolean;
  yuklenenTur: OdemeBelgeTuru | null;
  onYukle: (tur: OdemeBelgeTuru) => void;
}) {
  const { t } = useCeviri();
  /** Tek bir yükleme sürerken diğer satırlar bekler; profil kaydı yokluğu engel değil. */
  const mesgul = yuklenenTur != null;

  const satirlar = useMemo(() => {
    const opsiyonel = ([
      'personal_id',
      ...(sirketVar ? ['company_registration', 'company_signature', 'bank_letter'] : []),
      'address_proof',
      'other',
    ] as OdemeBelgeTuru[]).filter((tur) => !gerekli.includes(tur));

    return [
      ...gerekli.map((tur) => ({ tur, zorunlu: true })),
      ...opsiyonel.map((tur) => ({ tur, zorunlu: false })),
    ];
  }, [gerekli, sirketVar]);

  return (
    <View style={styles.kart}>
      <View style={styles.ust}>
        <Ionicons name="folder-open-outline" size={17} color={RenkTokenlari.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.baslik}>{t('yayinciK.belgelerBaslik')}</Text>
          <Text style={styles.alt}>{t('yayinciK.belgelerAlt')}</Text>
        </View>
      </View>

      {!profilKayitli ? (
        <View style={styles.otoNot}>
          <Ionicons name="sync-outline" size={12} color={RenkTokenlari.accent} />
          <Text style={styles.otoNotYazi}>{t('yayinciK.belgeOtoKayit')}</Text>
        </View>
      ) : null}

      {satirlar.map(({ tur, zorunlu }) => {
        const son = SonBelge(belgeler, tur);
        const yukluyor = yuklenenTur === tur;
        const renk = son ? durumRengi(son.status) : RenkTokenlari.textDim;
        return (
          <View key={tur} style={styles.satir}>
            <View style={styles.satirUst}>
              <Ionicons
                name={son ? 'document-attach' : 'document-outline'}
                size={15}
                color={son ? renk : RenkTokenlari.textDim}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.satirBaslik} numberOfLines={1}>
                  {t(BELGE_ETIKET[tur])}
                  {zorunlu ? <Text style={styles.zorunlu}> *</Text> : null}
                </Text>
                <Text style={styles.satirIpucu} numberOfLines={2}>
                  {t(BELGE_IPUCU[tur])}
                </Text>
              </View>
              {son ? (
                <View style={[styles.cip, { backgroundColor: `${renk}1F` }]}>
                  <Text style={[styles.cipYazi, { color: renk }]}>
                    {t(DURUM_ETIKET[son.status])}
                  </Text>
                </View>
              ) : zorunlu ? (
                <View style={[styles.cip, { backgroundColor: `${RenkTokenlari.danger}14` }]}>
                  <Text style={[styles.cipYazi, { color: RenkTokenlari.danger }]}>
                    {t('yayinciK.belgeDurumEksik')}
                  </Text>
                </View>
              ) : null}
            </View>

            {son ? (
              <Text style={styles.surum} numberOfLines={1}>
                {t('yayinciK.belgeSurum', { surum: son.version })} ·{' '}
                {son.file_name ?? '—'} · {tarih(son.created_at)}
              </Text>
            ) : null}

            {son?.status === 'rejected' && son.review_note ? (
              <Text style={styles.redNotu}>{son.review_note}</Text>
            ) : null}

            <Pressable
              onPress={() => onYukle(tur)}
              disabled={mesgul}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ disabled: mesgul, busy: yukluyor }}
              accessibilityLabel={`${t(BELGE_ETIKET[tur])} · ${t(
                son ? 'yayinciK.belgeYeniSurum' : 'yayinciK.belgeSec',
              )}`}
              style={({ pressed }) => [
                styles.yukleBtn,
                son ? styles.yukleBtnYenile : null,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                mesgul && !yukluyor && { opacity: 0.45 },
              ]}
            >
              {yukluyor ? (
                <>
                  <ActivityIndicator size="small" color={RenkTokenlari.primarySoft} />
                  <Text style={styles.yukleYazi}>{t('yayinciK.belgeYukleniyor')}</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name={son ? 'cloud-upload-outline' : 'add-circle-outline'}
                    size={14}
                    color={RenkTokenlari.primarySoft}
                  />
                  <Text style={styles.yukleYazi}>
                    {t(son ? 'yayinciK.belgeYeniSurum' : 'yayinciK.belgeSec')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        );
      })}

      <View style={styles.notKart}>
        <Ionicons name="lock-closed-outline" size={13} color={RenkTokenlari.textDim} />
        <Text style={styles.notYazi}>{t('yayinciK.belgeSilinemezNotu')}</Text>
      </View>

      {belgeler.length ? (
        <View style={styles.gecmis}>
          <Text style={styles.gecmisBaslik}>{t('yayinciK.belgeGecmisBaslik')}</Text>
          {belgeler.map((b) => {
            const renk = durumRengi(b.status);
            return (
              <View key={b.id} style={styles.gecmisSatir}>
                <View style={[styles.gecmisNokta, { backgroundColor: renk }]} />
                <Text style={styles.gecmisYazi} numberOfLines={1}>
                  {t(BELGE_ETIKET[b.doc_type] ?? 'yayinciK.belgeDiger')} ·{' '}
                  {t('yayinciK.belgeSurum', { surum: b.version })}
                </Text>
                <Text style={[styles.gecmisDurum, { color: renk }]}>
                  {t(DURUM_ETIKET[b.status])}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Doküman kartı — form yazımından bağımsız.
 * Karşılaştırma yalnızca belge/durum alanlarına bakar; TextInput her tuşunda
 * yeniden çizilmez.
 */
export const OdemeBelgeleriKarti = memo(
  OdemeBelgeleriKartiIc,
  (a, b) =>
    a.belgeler === b.belgeler &&
    a.gerekli === b.gerekli &&
    a.sirketVar === b.sirketVar &&
    a.profilKayitli === b.profilKayitli &&
    a.yuklenenTur === b.yuklenenTur &&
    a.onYukle === b.onYukle,
);

const styles = StyleSheet.create({
  kart: {
    gap: 11,
    padding: 14,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ust: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  otoNot: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: `${RenkTokenlari.accent}12`,
  },
  otoNotYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    lineHeight: 13,
    flex: 1,
  },
  baslik: { ...TipografiTokenlari.caption, color: RenkTokenlari.text, fontWeight: '800', fontSize: 13 },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  satir: {
    gap: 5,
    padding: 10,
    borderRadius: 12,
    backgroundColor: RenkTokenlari.surface,
  },
  satirUst: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  satirBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 11.5,
  },
  satirIpucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 1,
  },
  zorunlu: { color: RenkTokenlari.danger },
  cip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: YaricapTokenlari.pill },
  cipYazi: { ...TipografiTokenlari.micro, fontSize: 8.5, fontWeight: '800' },
  surum: { ...TipografiTokenlari.micro, color: RenkTokenlari.textDim, fontSize: 8.5 },
  redNotu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontSize: 9,
    lineHeight: 13,
  },
  yukleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: `${RenkTokenlari.primarySoft}1A`,
  },
  yukleBtnYenile: { backgroundColor: `${RenkTokenlari.accent}14` },
  yukleYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontSize: 10,
    fontWeight: '800',
  },
  notKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 9,
    borderRadius: 10,
    backgroundColor: `${RenkTokenlari.textDim}0F`,
  },
  notYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 8.5,
    lineHeight: 12,
    flex: 1,
  },
  gecmis: { gap: 5, paddingTop: 2 },
  gecmisBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gecmisSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gecmisNokta: { width: 5, height: 5, borderRadius: 3 },
  gecmisYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 9,
    flex: 1,
  },
  gecmisDurum: { ...TipografiTokenlari.micro, fontSize: 8.5, fontWeight: '700' },
});
