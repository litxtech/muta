import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DurumOggesi } from '../islemler/DurumIslemleri';
import { DurumOyunKazanciPayloadAl } from '../islemler/DurumIslemleri';
import { DurumOyunKazanciKart } from './DurumOyunKazanciKart';
import { DurumVideoOnizleme } from './DurumVideoOnizleme';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { BoslukTokenlari } from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  items: DurumOggesi[];
  yukleniyor?: boolean;
  baslik?: string;
  bosMetin?: string;
  /** Dış padding parent’ta varsa false yap */
  yatayPadding?: boolean;
  onPress: (oge: DurumOggesi) => void;
  onPaylas?: () => void;
  /** Uzun basınca (kendi gönderilerinde sil vb.) */
  onUzunBas?: (oge: DurumOggesi) => void;
};

export function DurumProfilIzgarasi({
  items,
  yukleniyor,
  baslik = 'Gönderiler',
  bosMetin = 'Henüz paylaşım yok',
  yatayPadding = true,
  onPress,
  onPaylas,
  onUzunBas,
}: Props) {
  return (
    <View style={[styles.wrap, !yatayPadding && styles.wrapSik]}>
      <View style={styles.baslikSatir}>
        <Text style={styles.baslik}>{baslik}</Text>
        {onPaylas ? (
          <Pressable onPress={onPaylas} hitSlop={8} style={styles.paylasHit}>
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={RenkTokenlari.primarySoft}
            />
            <Text style={styles.paylasYazi}>Paylaş</Text>
          </Pressable>
        ) : null}
      </View>

      {yukleniyor && !items.length ? (
        <ActivityIndicator
          color={RenkTokenlari.primarySoft}
          style={{ marginVertical: 24 }}
        />
      ) : !items.length ? (
        <Text style={styles.bos}>{bosMetin}</Text>
      ) : (
        <View style={styles.grid}>
          {items.map((oge) => {
            const kazanc = DurumOyunKazanciPayloadAl(oge);
            return (
              <Pressable
                key={oge.id}
                style={styles.hucre}
                onPress={() => onPress(oge)}
                onLongPress={
                  onUzunBas ? () => onUzunBas(oge) : undefined
                }
                accessibilityRole="imagebutton"
                accessibilityLabel={
                  kazanc ? 'Oyun kazancı durumu' : 'Durum gönderisi'
                }
              >
                {kazanc ? (
                  <DurumOyunKazanciKart payload={kazanc} compact />
                ) : oge.media_type === 'video' ? (
                  <DurumVideoOnizleme
                    uri={oge.media_url}
                    style={styles.img}
                  />
                ) : (
                  <Image source={{ uri: oge.media_url }} style={styles.img} />
                )}
                {oge.media_type === 'video' && !kazanc ? (
                  <View style={styles.videoBadge} pointerEvents="none">
                    <Ionicons name="play" size={12} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: BoslukTokenlari.lg,
    paddingHorizontal: BoslukTokenlari.lg,
    gap: 12,
    width: '100%',
  },
  wrapSik: {
    paddingHorizontal: 0,
  },
  baslikSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  baslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
    fontSize: 17,
    fontWeight: '800',
  },
  paylasHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paylasYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
  },
  bos: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    paddingVertical: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  hucre: {
    width: '32.5%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: RenkTokenlari.bgElevated,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
