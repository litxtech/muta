import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { HataKurtarmaEkrani } from './HataKurtarmaEkrani';
import i18n from '../../i18n';

type Props = { children: ReactNode };
type State = { hata: Error | null; anahtar: number };

/**
 * Kok hata siniri — en kotu durumda uygulama tamamen kilitlenmesin.
 */
export class UygulamaHataSiniri extends Component<Props, State> {
  state: State = { hata: null, anahtar: 0 };

  static getDerivedStateFromError(hata: Error): Partial<State> {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    console.warn('[HataSiniri:uygulama]', hata.message, bilgi.componentStack);
  }

  private sifirla = () => {
    this.setState((s) => ({ hata: null, anahtar: s.anahtar + 1 }));
  };

  render() {
    if (this.state.hata) {
      return (
        <View style={styles.dolgu}>
          <HataKurtarmaEkrani
            varyant="ekran"
            baslik={i18n.t('ortak.birHataOlustu')}
            aciklama={i18n.t('ortak.uygulamaTakildi')}
            detay={__DEV__ ? this.state.hata.message : null}
            onTekrarDene={this.sifirla}
            fallbackHref="/(tabs)"
          />
        </View>
      );
    }
    return (
      <React.Fragment key={this.state.anahtar}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  dolgu: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
});
