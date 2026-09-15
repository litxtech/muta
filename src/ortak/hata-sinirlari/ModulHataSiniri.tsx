import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import type { Href } from 'expo-router';
import { HataKurtarmaEkrani } from './HataKurtarmaEkrani';

type Props = {
  modulAdi: string;
  children: ReactNode;
  yedek?: ReactNode;
  /** Varsayilan: ekran — kullanici geri donebilir */
  varyant?: 'kart' | 'ekran';
  fallbackHref?: Href;
};

type State = { hata: Error | null };

/**
 * Modul bazli fault isolation + kurtarma (geri don / tekrar dene).
 * Hediye hatasi sesi, chat hatasi odayi dusurmez; sayfada kilitlenmez.
 */
export class ModulHataSiniri extends Component<Props, State> {
  state: State = { hata: null };

  static getDerivedStateFromError(hata: Error): State {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    console.warn(
      `[HataSiniri:${this.props.modulAdi}]`,
      hata.message,
      bilgi.componentStack,
    );
  }

  private sifirla = () => this.setState({ hata: null });

  render() {
    if (this.state.hata) {
      if (this.props.yedek) return this.props.yedek;
      const varyant = this.props.varyant ?? 'ekran';
      return (
        <HataKurtarmaEkrani
          varyant={varyant}
          baslik={`${this.props.modulAdi} geçici olarak kullanılamıyor`}
          aciklama="Bu özellik şu an yanıt vermiyor. Geri dönüp uygulamayı kullanmaya devam edebilirsin."
          detay={__DEV__ ? this.state.hata.message : null}
          onTekrarDene={this.sifirla}
          fallbackHref={this.props.fallbackHref ?? '/(tabs)'}
        />
      );
    }
    return this.props.children;
  }
}
