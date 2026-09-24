import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AjansAltEkranKabuk,
  AjansHint,
  AjansInput,
  AjansKart,
  AjansListeSatir,
} from '../../../../src/moduller/ajanslar/bilesenler/AjansAltEkranKabuk';
import {
  useAjansRouteId,
  ajansHref,
} from '../../../../src/moduller/ajanslar/kancalar/useAjansRouteId';
import {
  AjansPanelDetayGetir,
  type AjansUyeOzet,
} from '../../../../src/moduller/ajanslar/islemler/AjansPanelIslemleri';
import { RenkTokenlari } from '../../../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../../src/tasarim-sistemi/TipografiTokenlari';
import { YaricapTokenlari } from '../../../../src/tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../../src/i18n/useCeviri';

export default function AjansUyelerEkrani() {
  const { t } = useCeviri();
  const id = useAjansRouteId();
  const [uyeler, setUyeler] = useState<AjansUyeOzet[]>([]);
  const [arama, setArama] = useState('');
  const [filtre, setFiltre] = useState<'all' | 'active' | 'new' | 'suspended'>('all');
  const [yukleniyor, setYukleniyor] = useState(true);

  const dk = useCallback(
    (n: number) => {
      const m = Math.max(0, Math.floor(n || 0));
      const sa = Math.floor(m / 60);
      const kalan = m % 60;
      return sa > 0
        ? t('ajans.dkSa', { sa, dk: kalan })
        : t('ajans.dkSadece', { dk: kalan });
    },
    [t],
  );

  const filtreler = useMemo(
    () =>
      [
        { key: 'all' as const, label: t('ajans.filtreTumu') },
        { key: 'active' as const, label: t('ajans.filtreAktif') },
        { key: 'new' as const, label: t('ajans.filtreYeni') },
        { key: 'suspended' as const, label: t('ajans.filtreAski') },
      ] as const,
    [t],
  );

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    try {
      const d = await AjansPanelDetayGetir(id);
      setUyeler(d.uyeler ?? []);
    } catch {
      setUyeler([]);
    } finally {
      setYukleniyor(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void yukle();
    }, [yukle]),
  );

  const filtreli = useMemo(() => {
    const q = arama.trim().toLowerCase();
    return uyeler.filter((u) => {
      if (filtre === 'suspended' && u.status !== 'suspended') return false;
      if (filtre === 'new') {
        const j = u.joined_at ? new Date(u.joined_at).getTime() : 0;
        if (j < Date.now() - 14 * 86400000) return false;
      }
      if (filtre === 'active' && u.status === 'suspended') return false;
      if (!q) return true;
      return (
        (u.display_name ?? '').toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.public_user_id ?? '').toLowerCase().includes(q) ||
        u.user_id.toLowerCase().includes(q)
      );
    });
  }, [uyeler, arama, filtre]);

  return (
    <AjansAltEkranKabuk
      agencyId={id}
      title={t('ajans.uyeler')}
      subtitle={t('ajans.uyelerAlt', { count: filtreli.length })}
      aktif="uyeler"
      yukleniyor={yukleniyor && uyeler.length === 0}
      refreshing={yukleniyor && uyeler.length > 0}
      onRefresh={() => void yukle()}
    >
      <AjansInput
        value={arama}
        onChangeText={setArama}
        placeholder={t('ajans.phUyeAra')}
      />
      <View style={styles.filtreSatir}>
        {filtreler.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filtre === f.key && styles.chipAktif]}
            onPress={() => setFiltre(f.key)}
          >
            <Text style={[styles.chipYazi, filtre === f.key && styles.chipYaziAktif]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <AjansKart>
        {filtreli.length === 0 ? (
          <AjansHint>{t('ajans.uyeBulunamadi')}</AjansHint>
        ) : (
          filtreli.map((u) => {
            const durum =
              u.status === 'suspended' ? t('ajans.durumAskida') : t('ajans.durumAktifKisa');
            return (
              <AjansListeSatir
                key={u.user_id}
                title={u.display_name || u.username || t('ajans.uyeVarsayilan')}
                subtitle={`@${u.username || '—'} · ID ${u.public_user_id || '—'}\n${t(
                  'ajans.uyeAltSatir',
                  {
                    durum,
                    ses: dk(u.ses_dakika_ay),
                    yayin: dk(u.yayin_dakika_ay),
                  },
                )}`}
                avatarUrl={u.avatar_url}
                onPress={() =>
                  router.push(ajansHref(id, `uyeler/${u.user_id}`) as any)
                }
              />
            );
          })
        )}
      </AjansKart>
    </AjansAltEkranKabuk>
  );
}

const styles = StyleSheet.create({
  filtreSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.surface,
  },
  chipAktif: {
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  chipYazi: { ...TipografiTokenlari.caption, color: RenkTokenlari.textDim },
  chipYaziAktif: { color: RenkTokenlari.text, fontWeight: '700' },
});
