import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { EkranBasligi } from '../../../components/EkranBasligi';
import { ModulHataSiniri } from '../../../ortak/hata-sinirlari/ModulHataSiniri';
import { AjansBolumRayi } from './AjansBolumRayi';
import { AjansAtmosfer } from './AjansAtmosfer';
import { ajansHref } from '../kancalar/useAjansRouteId';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useTemayaAboneOl } from '../../../tasarim-sistemi/tema/useTemayaAboneOl';

export {
  AjansKart,
  AjansBolumBaslik,
  AjansHint,
  AjansBos,
  AjansInput,
  AjansCta,
  AjansKpiHucre,
  AjansListeSatir,
  AjansCanliNokta,
  AjansHeroKapak,
} from './AjansYonetimPrimitifleri';

export function AjansAltEkranKabuk({
  agencyId,
  title,
  subtitle,
  aktif,
  yukleniyor,
  refreshing,
  children,
  onRefresh,
  hideRail,
}: {
  agencyId: string;
  title: string;
  subtitle?: string;
  aktif: string;
  yukleniyor?: boolean;
  refreshing?: boolean;
  children: React.ReactNode;
  onRefresh?: () => void;
  hideRail?: boolean;
}) {
  useTemayaAboneOl();

  return (
    <Screen edges={['top']}>
      <ModulHataSiniri
        modulAdi={`ajans-${aktif}`}
        varyant="ekran"
        fallbackHref={ajansHref(agencyId) as any}
      >
        <View style={styles.root}>
          <AjansAtmosfer />
          <EkranBasligi
            title={title}
            subtitle={subtitle}
            fallbackHref={ajansHref(agencyId) as any}
          />
          {yukleniyor ? (
            <ActivityIndicator
              color={RenkTokenlari.primarySoft}
              style={{ marginTop: 32 }}
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={!!refreshing}
                    onRefresh={onRefresh}
                    tintColor={RenkTokenlari.primarySoft}
                  />
                ) : undefined
              }
            >
              {!hideRail ? (
                <AjansBolumRayi agencyId={agencyId} aktif={aktif} />
              ) : null}
              {children}
            </ScrollView>
          )}
        </View>
      </ModulHataSiniri>
    </Screen>
  );
}

export function gitMesaj(threadId: string) {
  router.push(`/mesaj/${threadId}` as any);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: BoslukTokenlari.lg,
    paddingBottom: BoslukTokenlari.xxxl,
    gap: BoslukTokenlari.md,
  },
});
