import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { HataKurtarmaEkrani } from './HataKurtarmaEkrani';

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
        <HataKurtarmaEkrani
          varyant="ekran"
          baslik="Bir şeyler ters gitti"
          aciklama="Uygulama bu ekranda takıldı. Ana sayfaya dönüp devam edebilirsin."
          detay={__DEV__ ? this.state.hata.message : null}
          onTekrarDene={this.sifirla}
          fallbackHref="/(tabs)"
        />
      );
    }
    return (
      <React.Fragment key={this.state.anahtar}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
