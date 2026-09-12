import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RenkTokenlari } from '../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  modulAdi: string;
  children: ReactNode;
  yedek?: ReactNode;
};

type State = { hata: Error | null };

/**
 * Modul bazli fault isolation.
 * Hediye hatasi sesi, chat hatasi odayi dusurmez.
 */
export class ModulHataSiniri extends Component<Props, State> {
  state: State = { hata: null };

  static getDerivedStateFromError(hata: Error): State {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    console.warn(`[HataSiniri:${this.props.modulAdi}]`, hata.message, bilgi.componentStack);
  }

  private sifirla = () => this.setState({ hata: null });

  render() {
    if (this.state.hata) {
      if (this.props.yedek) return this.props.yedek;
      return (
        <View style={styles.kutu}>
          <Text style={styles.baslik}>{this.props.modulAdi} gecici olarak kullanilamiyor</Text>
          <Text style={styles.metin}>Diger bolumler calismaya devam eder.</Text>
          <Pressable onPress={this.sifirla} style={styles.buton}>
            <Text style={styles.butonMetin}>Tekrar dene</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  kutu: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    gap: 8,
  },
  baslik: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  metin: { ...TipografiTokenlari.caption, color: RenkTokenlari.textMuted },
  buton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RenkTokenlari.primary,
  },
  butonMetin: { ...TipografiTokenlari.caption, color: '#12040C', fontWeight: '700' },
});
