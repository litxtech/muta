/**
 * Özellik açıklaması — küçük (?) düğmesi + kompakt alt panel.
 *
 * Amaç: mevcut işlevleri kullanıcıya açıklamak. Yeni işlev eklemez.
 * Metinler gerçek uygulama davranışını anlatır; olmayan özellik tanıtılmaz.
 *
 * Kullanım:
 *   <OzellikBilgiDugmesi konu="cuzdan" />
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri, type CeviriAnahtari } from '../../i18n/useCeviri';

export type BilgiKonusu =
  | 'canli'
  | 'sesliOda'
  | 'pk'
  | 'cuzdan'
  | 'coinPaket'
  | 'hediye'
  | 'meyveCarki'
  | 'profil'
  | 'kesfet'
  | 'gonderi';

type Props = {
  konu: BilgiKonusu;
  /** Görsel boyut; dokunma alanı her zaman en az 44x44. */
  boyut?: number;
  /** Başlık satırında sağa yaslamak için. */
  style?: object;
};

const ICON_BOYUT = 15;

export function OzellikBilgiDugmesi({ konu, boyut = 26, style }: Props) {
  const { t } = useCeviri();
  const [acik, setAcik] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAcik(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('bilgi.dugme')}
        accessibilityHint={t('bilgi.dugmeIpucu')}
        style={({ pressed }) => [
          styles.dugme,
          { width: boyut, height: boyut, borderRadius: boyut / 2 },
          pressed && styles.dugmeBasili,
          style,
        ]}
      >
        <Ionicons name="help" size={ICON_BOYUT} color={RenkTokenlari.accent} />
      </Pressable>
      <OzellikBilgiPaneli konu={konu} visible={acik} onKapat={() => setAcik(false)} />
    </>
  );
}

type PanelProps = {
  konu: BilgiKonusu;
  visible: boolean;
  onKapat: () => void;
};

export function OzellikBilgiPaneli({ konu, visible, onKapat }: PanelProps) {
  const { t } = useCeviri();
  const insets = useSafeAreaInsets();

  const anahtar = (alan: string) => `bilgi.${konu}${alan}` as CeviriAnahtari;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onKapat}
      statusBarTranslucent
    >
      <Pressable style={styles.maske} onPress={onKapat}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + BoslukTokenlari.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.tutamac} />
          <View style={styles.baslikSatir}>
            <View style={styles.ikonWrap}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={RenkTokenlari.accent}
              />
            </View>
            <Text style={styles.baslik}>{t(anahtar('Baslik'))}</Text>
            <Pressable
              onPress={onKapat}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('ortak.kapat')}
              style={styles.kapatDugme}
            >
              <Ionicons name="close" size={20} color={RenkTokenlari.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.icerik}
            contentContainerStyle={styles.icerikBosluk}
            showsVerticalScrollIndicator={false}
          >
            <Bolum baslik={t('bilgi.neBaslik')} metin={t(anahtar('Ne'))} />
            <Bolum baslik={t('bilgi.nasilBaslik')} metin={t(anahtar('Nasil'))} />
            <Bolum baslik={t('bilgi.kosulBaslik')} metin={t(anahtar('Kosullar'))} />
          </ScrollView>

          <Pressable style={styles.btn} onPress={onKapat} accessibilityRole="button">
            <Text style={styles.btnYazi}>{t('bilgi.kapat')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Bolum({ baslik, metin }: { baslik: string; metin: string }) {
  return (
    <View style={styles.bolum}>
      <Text style={styles.bolumBaslik}>{baslik}</Text>
      <Text style={styles.bolumMetin}>{metin}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dugme: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.borderAccent,
    backgroundColor: RenkTokenlari.pressFill,
  },
  dugmeBasili: {
    opacity: 0.7,
  },
  maske: {
    flex: 1,
    backgroundColor: RenkTokenlari.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: RenkTokenlari.bgElevated,
    borderTopLeftRadius: YaricapTokenlari.xl,
    borderTopRightRadius: YaricapTokenlari.xl,
    paddingHorizontal: BoslukTokenlari.xl,
    paddingTop: BoslukTokenlari.sm,
    gap: BoslukTokenlari.md,
    maxHeight: '82%',
  },
  tutamac: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.border,
    marginBottom: BoslukTokenlari.xs,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.sm,
  },
  ikonWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.pressFill,
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    flex: 1,
  },
  kapatDugme: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icerik: {
    flexGrow: 0,
  },
  icerikBosluk: {
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.sm,
  },
  bolum: {
    gap: BoslukTokenlari.xs,
  },
  bolumBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bolumMetin: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textMuted,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  btnYazi: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
});
