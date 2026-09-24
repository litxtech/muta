/**
 * Politika gövdesi — düz metin + satır içi [etiket](url) + ![alt](url) görseller.
 */

import React, { useMemo } from 'react';
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import i18n from '../../../i18n';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

export type PolitikaGovdeTema = {
  metin: string;
  link: string;
};

type Parca =
  | { tur: 'text'; deger: string }
  | { tur: 'link'; etiket: string; url: string }
  | { tur: 'image'; alt: string; url: string };

const LINK_RE = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;

function satiriAyikla(satir: string): Parca[] {
  const out: Parca[] = [];
  let last = 0;
  const re = new RegExp(LINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(satir)) !== null) {
    if (m.index > last) {
      out.push({ tur: 'text', deger: satir.slice(last, m.index) });
    }
    if (m[1] === '!') {
      out.push({ tur: 'image', alt: m[2], url: m[3].trim() });
    } else {
      out.push({ tur: 'link', etiket: m[2], url: m[3].trim() });
    }
    last = m.index + m[0].length;
  }
  if (last < satir.length) {
    out.push({ tur: 'text', deger: satir.slice(last) });
  }
  return out.length ? out : [{ tur: 'text', deger: satir }];
}

export function PolitikaGovdesiniAyikla(govde: string): Parca[][] {
  const satirlar = (govde || '').replace(/\r\n/g, '\n').split('\n');
  return satirlar.map(satiriAyikla);
}

type Props = {
  govde: string;
  tema: PolitikaGovdeTema;
  stil?: ViewStyle;
  metinStil?: TextStyle;
};

export function PolitikaZenginGovde({ govde, tema, stil, metinStil }: Props) {
  const satirlar = useMemo(() => PolitikaGovdesiniAyikla(govde), [govde]);

  return (
    <View style={stil}>
      {satirlar.map((parcalar, i) => {
        const sadeceBos =
          parcalar.length === 1 &&
          parcalar[0].tur === 'text' &&
          !parcalar[0].deger.trim();
        if (sadeceBos) {
          return <View key={`b-${i}`} style={{ height: 14 }} />;
        }

        const metinParcalari = parcalar.filter(
          (p): p is Exclude<Parca, { tur: 'image' }> => p.tur !== 'image',
        );
        const gorseller = parcalar.filter(
          (p): p is Extract<Parca, { tur: 'image' }> => p.tur === 'image',
        );

        return (
          <View key={`s-${i}`}>
            {metinParcalari.length > 0 &&
            !(
              metinParcalari.length === 1 &&
              metinParcalari[0].tur === 'text' &&
              !metinParcalari[0].deger.trim()
            ) ? (
              <Text style={[styles.satir, { color: tema.metin }, metinStil]}>
                {metinParcalari.map((p, j) => {
                  if (p.tur === 'text') {
                    return <Text key={j}>{p.deger}</Text>;
                  }
                  return (
                    <Text
                      key={j}
                      style={{
                        color: tema.link,
                        fontWeight: '700',
                        textDecorationLine: 'underline',
                      }}
                      onPress={() => {
                        const url = MedyaUriGuvenli(p.url);
                        if (!url) return;
                        void Linking.openURL(url).catch(() => undefined);
                      }}
                    >
                      {p.etiket}
                    </Text>
                  );
                })}
              </Text>
            ) : null}
            {gorseller.map((p, j) => {
              const uri = MedyaUriGuvenli(p.url);
              if (!uri) return null;
              return (
                <Image
                  key={`img-${i}-${j}`}
                  source={{ uri }}
                  style={styles.img}
                  resizeMode="contain"
                  accessibilityLabel={p.alt || i18n.t('auth.politikaGorseli')}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function PolitikaLinkMarkdown(etiket: string, url: string) {
  return `[${etiket.trim() || i18n.t('auth.politikaBaglanti')}](${url.trim()})`;
}

export function PolitikaGorselMarkdown(url: string, alt?: string) {
  return `![${alt?.trim() || i18n.t('auth.politikaGorseli')}](${url.trim()})`;
}

const styles = StyleSheet.create({
  satir: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 4,
  },
  img: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginVertical: 12,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
});
