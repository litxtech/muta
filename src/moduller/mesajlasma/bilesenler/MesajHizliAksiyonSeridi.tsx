import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

const SAKLAMA_ANAHTAR = '@muta/mesaj_hizli_aksiyon_gizli';

type Props = {
  /** Ajans sohbetinde daha vurgulu */
  ajansMi?: boolean;
  onCuzdanNoPaylas: () => void;
  onIdPaylas: () => void;
  onMetinPaylas?: (etiket: string, metin: string) => void;
};

/**
 * WhatsApp tarzı hızlı paylaşım çipleri — kullanıcı kapatabilir.
 */
export function MesajHizliAksiyonSeridi({
  ajansMi,
  onCuzdanNoPaylas,
  onIdPaylas,
}: Props) {
  const { t } = useCeviri();
  const [gizli, setGizli] = useState(false);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(SAKLAMA_ANAHTAR).then((v) => {
      setGizli(v === '1');
      setHazir(true);
    });
  }, []);

  const kapat = useCallback(() => {
    setGizli(true);
    void AsyncStorage.setItem(SAKLAMA_ANAHTAR, '1');
  }, []);

  const ac = useCallback(() => {
    setGizli(false);
    void AsyncStorage.removeItem(SAKLAMA_ANAHTAR);
  }, []);

  if (!hazir) return null;

  if (gizli) {
    return (
      <Pressable style={styles.gizliSatir} onPress={ac}>
        <Ionicons name="apps-outline" size={14} color={RenkTokenlari.textDim} />
        <Text style={styles.gizliYazi}>{t('mesajlar.hizliGoster')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrap, ajansMi && styles.wrapAjans]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Pressable style={styles.cip} onPress={onCuzdanNoPaylas}>
          <Ionicons name="wallet-outline" size={15} color={RenkTokenlari.mint} />
          <Text style={styles.cipYazi}>{t('mesajlar.cuzdanNoPaylas')}</Text>
        </Pressable>
        <Pressable style={styles.cip} onPress={onIdPaylas}>
          <Ionicons
            name="id-card-outline"
            size={15}
            color={RenkTokenlari.primarySoft}
          />
          <Text style={styles.cipYazi}>{t('mesajlar.idPaylas')}</Text>
        </Pressable>
      </ScrollView>
      <Pressable
        style={styles.kapat}
        onPress={kapat}
        hitSlop={8}
        accessibilityLabel={t('mesajlar.hizliGizle')}
      >
        <Ionicons name="close" size={16} color={RenkTokenlari.textDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.sm,
    paddingTop: 6,
    gap: 4,
  },
  wrapAjans: {
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  scroll: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  cip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  cipYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kapat: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gizliSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: BoslukTokenlari.md,
    paddingVertical: 6,
  },
  gizliYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
  },
});
