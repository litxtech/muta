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
import type { PolitikaTanimi } from '../icerik/PolitikaMetinleri';
import { CamArkaplan } from '../../../bilesenler/yuzey/CamArkaplan';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  politika: PolitikaTanimi | null;
  onKapat: () => void;
};

/** Kayıt / lobi — politika metnini tam ekran okutur */
export function PolitikaOkumaPaneli({ politika, onKapat }: Props) {
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
              <Text style={styles.fisilti}>YASAL METİN</Text>
              <Text style={styles.baslik}>{politika.baslik}</Text>
            </View>
            <Pressable onPress={onKapat} style={styles.kapat} hitSlop={8}>
              <Ionicons name="close" size={20} color={RenkTokenlari.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollPad}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.govde}>{politika.govde}</Text>
          </ScrollView>
          <Pressable onPress={onKapat} style={styles.tamam}>
            <Text style={styles.tamamYazi}>Anladım</Text>
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
    backgroundColor: RenkTokenlari.bgElevated ?? RenkTokenlari.bgCard,
    borderTopLeftRadius: YaricapTokenlari.lg + 4,
    borderTopRightRadius: YaricapTokenlari.lg + 4,
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
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
    color: RenkTokenlari.primarySoft,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  baslik: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
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
  govde: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
    lineHeight: 22,
  },
  tamam: {
    marginHorizontal: BoslukTokenlari.xl,
    marginTop: BoslukTokenlari.sm,
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.primary,
    alignItems: 'center',
  },
  tamamYazi: {
    ...TipografiTokenlari.body,
    color: '#fff',
    fontWeight: '700',
  },
});
