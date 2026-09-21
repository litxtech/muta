import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TamusoModal } from '../../../bilesenler/yuzey/TamusoModal';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { ODA_UST_BTN, ODA_UST_ICON } from '../../ses-odalari/bilesenler/OdaButonOlculeri';
import {
  OdaOyunSiralamasiniGetir,
  type OdaOyunSiralamaSatiri,
} from './OdaOyunSiralamasiniGetir';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';

type Props = {
  roomId: string;
};

const MEDAL: Record<number, readonly [string, string]> = {
  1: ['#F6D365', '#FDA085'],
  2: ['#C9D6FF', '#E2E2E2'],
  3: ['#F2994A', '#F2C94C'],
};

function tutarYazi(n: number): string {
  return n.toLocaleString('tr-TR');
}

function netYazi(n: number): string {
  const isaret = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${isaret}${tutarYazi(Math.abs(n))}`;
}

function satirAdi(r: OdaOyunSiralamaSatiri): string {
  return r.display_name?.trim() || r.username?.trim() || 'Oyuncu';
}

export function OdaOyunSiralamaPaneli({ roomId }: Props) {
  const { height } = useWindowDimensions();
  const [rows, setRows] = useState<OdaOyunSiralamaSatiri[]>([]);
  const [loading, setLoading] = useState(false);
  const [acik, setAcik] = useState(false);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await OdaOyunSiralamasiniGetir(roomId, 50));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const ac = () => {
    setAcik(true);
    void yukle();
  };

  const kapat = () => setAcik(false);

  const profilAc = (userId: string) => {
    kapat();
    router.push(`/kullanici/${userId}` as any);
  };

  return (
    <>
      <Pressable
        onPress={ac}
        style={styles.ustBtn}
        accessibilityLabel="Oyun sıralaması"
        accessibilityRole="button"
      >
        <LinearGradient
          colors={[...RenkTokenlari.gradientGold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ustBtnInner}
        >
          <Ionicons name="trophy" size={ODA_UST_ICON} color="#1A1208" />
        </LinearGradient>
      </Pressable>

      <TamusoModal visible={acik} onClose={kapat} animationType="fade">
        <View style={styles.kartWrap}>
          <LinearGradient colors={['#2A1C34', '#16101F']} style={styles.kart}>
            <View style={styles.kartUst}>
              <View style={styles.kartBaslikBlok}>
                <View style={styles.kartBaslikRow}>
                  <Ionicons name="trophy" size={16} color={RenkTokenlari.accent} />
                  <Text style={styles.kartBaslik}>Oyun sıralaması</Text>
                </View>
                <Text style={styles.kartAlt}>
                  Bu odada kazanılan, harcanan ve net coin
                </Text>
              </View>
              <Pressable onPress={kapat} style={styles.kapatBtn} hitSlop={8}>
                <Ionicons name="close" size={18} color={RenkTokenlari.text} />
              </Pressable>
            </View>

            {loading && rows.length === 0 ? (
              <ActivityIndicator
                color={RenkTokenlari.primarySoft}
                style={styles.yukleniyor}
              />
            ) : rows.length === 0 ? (
              <Text style={styles.bos}>Henüz oyun hareketi yok</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: Math.min(height * 0.58, 480) }}
                contentContainerStyle={styles.liste}
                showsVerticalScrollIndicator={false}
              >
                {rows.map((r) => (
                  <SiralamaDetaySatiri
                    key={r.user_id}
                    satir={r}
                    onPress={() => profilAc(r.user_id)}
                  />
                ))}
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </TamusoModal>
    </>
  );
}

function SiralamaDetaySatiri({
  satir,
  onPress,
}: {
  satir: OdaOyunSiralamaSatiri;
  onPress: () => void;
}) {
  const ad = satirAdi(satir);
  const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
  const medal = MEDAL[satir.rank];
  const netRenk =
    satir.net_coin > 0
      ? RenkTokenlari.mint
      : satir.net_coin < 0
        ? RenkTokenlari.danger
        : RenkTokenlari.textMuted;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.satir, satir.rank <= 3 && styles.satirTop]}
      accessibilityRole="button"
      accessibilityLabel={`${satir.rank}. ${ad}`}
    >
      <View style={styles.rankWrap}>
        {medal ? (
          <LinearGradient colors={[...medal]} style={styles.medal}>
            <Text style={styles.medalText}>{satir.rank}</Text>
          </LinearGradient>
        ) : (
          <Text style={styles.rank}>#{satir.rank}</Text>
        )}
      </View>

      {MedyaUriGuvenli(satir.avatar_url) ? (
        <Image
          source={{ uri: MedyaUriGuvenli(satir.avatar_url)! }}
          style={styles.avatar}
        />
      ) : (
        <LinearGradient
          colors={[RenkTokenlari.primary, RenkTokenlari.accent]}
          style={styles.avatar}
        >
          <Text style={styles.harf}>{harf}</Text>
        </LinearGradient>
      )}

      <View style={styles.bilgi}>
        <Text style={styles.ad} numberOfLines={1}>
          {ad}
        </Text>
        {satir.username ? (
          <Text style={styles.kullanici} numberOfLines={1}>
            @{satir.username}
          </Text>
        ) : null}
        <View style={styles.istatistikGrid}>
          <View style={styles.istatistikHucre}>
            <Text style={styles.etiket}>Kazanılan</Text>
            <Text style={styles.kazanc}>+{tutarYazi(satir.won_coin)}</Text>
          </View>
          <View style={styles.istatistikHucre}>
            <Text style={styles.etiket}>Harcanan</Text>
            <Text style={styles.harcama}>−{tutarYazi(satir.spent_coin)}</Text>
          </View>
          <View style={styles.istatistikHucre}>
            <Text style={styles.etiket}>Net</Text>
            <Text style={[styles.net, { color: netRenk }]}>
              {netYazi(satir.net_coin)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ustBtn: {
    width: ODA_UST_BTN,
    height: ODA_UST_BTN,
    borderRadius: ODA_UST_BTN / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.55)',
    flexShrink: 0,
  },
  ustBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kartWrap: {
    borderRadius: YaricapTokenlari.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RenkTokenlari.borderAccent,
  },
  kart: {
    padding: BoslukTokenlari.lg,
    gap: BoslukTokenlari.md,
  },
  kartUst: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: BoslukTokenlari.sm,
  },
  kartBaslikBlok: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kartBaslikRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kartBaslik: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.text,
  },
  kartAlt: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  kapatBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: RenkTokenlari.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yukleniyor: {
    paddingVertical: BoslukTokenlari.xl,
  },
  bos: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.textDim,
    paddingVertical: BoslukTokenlari.lg,
    textAlign: 'center',
  },
  liste: {
    gap: BoslukTokenlari.sm,
    paddingBottom: BoslukTokenlari.sm,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  satirTop: {
    borderColor: 'rgba(246, 211, 101, 0.35)',
    backgroundColor: 'rgba(246, 211, 101, 0.06)',
  },
  rankWrap: {
    width: 28,
    alignItems: 'center',
    paddingTop: 6,
  },
  medal: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A1208',
  },
  rank: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harf: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  bilgi: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ad: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  kullanici: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
  },
  istatistikGrid: {
    flexDirection: 'row',
    gap: BoslukTokenlari.sm,
    marginTop: 6,
  },
  istatistikHucre: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kazanc: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.mint,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  harcama: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  net: {
    ...TipografiTokenlari.caption,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.3,
  },
});
