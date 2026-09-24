import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PolitikaGorunum } from '../tipler/PolitikaTipleri';
import { PolitikaZenginGovde } from './PolitikaZenginGovde';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';

type Props = {
  politika: PolitikaGorunum | null;
  onKapat: () => void;
};

/** Kayıt / giriş — politika metnini modern temiz arka plan üzerinde okutur */
export function PolitikaOkumaPaneli({ politika, onKapat }: Props) {
  const { t } = useCeviri();
  if (!politika) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onKapat}>
      <View style={styles.kok}>
        <CamArkaplan
          intensity={24}
          style={StyleSheet.absoluteFill}
          fallbackColor={RenkTokenlari.scrim}
          pointerEvents="none"
        />
        <View style={styles.kart}>
          <View style={styles.ust}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.fisilti}>{t('auth.politikaFisilti')}</Text>
              <Text style={styles.baslik}>{politika.baslik}</Text>
            </View>
            <Pressable
              onPress={onKapat}
              style={styles.kapat}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('ortak.kapat')}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
          >
            <PolitikaZenginGovde
              govde={politika.govde}
              tema={{ metin: '#ffffff', link: '#93c5fd' }}
            />
          </ScrollView>
          <Pressable onPress={onKapat} style={styles.tamam}>
            <Text style={styles.tamamYazi}>{t('ortak.anladim')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kok: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  kart: {
    maxHeight: '92%',
    backgroundColor: '#0c0c0c',
    borderTopLeftRadius: YaricapTokenlari.lg + 4,
    borderTopRightRadius: YaricapTokenlari.lg + 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xl,
    zIndex: 3,
    elevation: 24,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: BoslukTokenlari.xl,
    marginBottom: BoslukTokenlari.md,
  },
  fisilti: {
    ...TipografiTokenlari.micro,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    marginBottom: 4,
    fontWeight: '700',
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: '#ffffff',
  },
  kapat: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  scroll: { flexGrow: 0 },
  scrollPad: {
    paddingHorizontal: BoslukTokenlari.xl,
    paddingBottom: BoslukTokenlari.lg,
  },
  tamam: {
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.sm,
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  tamamYazi: {
    ...TipografiTokenlari.body,
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
