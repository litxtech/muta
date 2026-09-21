import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import { KonusmaciAktiflikEfekti } from './KonusmaciAktiflikEfekti';
import { KoltukTahti } from './KoltukTahti';
import { SeviyeTaci } from './SeviyeTaci';
import { MedyaUriGuvenli } from '../../mesajlasma/yardimcilar/MedyaUriGecerliMi';
import type { RoomSeat } from '../../../types/models';

type Props = {
  seat: RoomSeat;
  hostId?: string | null;
  tahtMi?: boolean;
  onPress?: (seat: RoomSeat) => void;
};

function KonusmaciKartiIc({ seat, hostId, tahtMi = false, onPress }: Props) {
  const dolu = !!seat.user_id;
  const hostMu = !!seat.user_id && !!hostId && seat.user_id === hostId;
  const yardimciMu = !hostMu && !!seat.is_cohost;
  const seviye = Number(seat.profile?.level) || 0;
  const avatarBoy = tahtMi ? 58 : 40;
  const efektBoy = tahtMi ? 66 : 46;
  const muted = !!seat.is_muted;
  const micKilitli = !!seat.is_mic_locked;
  const koltukNo = seat.seat_index + 1;

  const ad =
    seat.profile?.display_name?.trim() ||
    seat.profile?.username?.trim() ||
    (tahtMi || seat.seat_index === 0 ? 'Ev sahibi' : `Koltuk ${koltukNo}`);
  const harf = ad.charAt(0).toLocaleUpperCase('tr-TR');
  const avatarUrl = MedyaUriGuvenli(seat.profile?.avatar_url);

  return (
    <Pressable
      onPress={onPress ? () => onPress(seat) : undefined}
      style={[styles.wrap, tahtMi && styles.wrapTaht]}
    >
      <View style={styles.avatarKutu}>
        {dolu ? (
          <KonusmaciAktiflikEfekti
            userId={seat.user_id}
            size={avatarBoy}
            hostMu={hostMu || tahtMi}
          >
            <SeviyeTaci
              level={seviye}
              size={tahtMi ? 'md' : 'sm'}
              avatarBoy={avatarBoy}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  resizeMode="cover"
                  style={{
                    width: avatarBoy,
                    height: avatarBoy,
                    borderRadius: avatarBoy / 2,
                  }}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.filled,
                    {
                      width: avatarBoy,
                      height: avatarBoy,
                      borderRadius: avatarBoy / 2,
                    },
                    (tahtMi || hostMu) && styles.avatarHost,
                    {
                      backgroundColor:
                        tahtMi || hostMu
                          ? RenkTokenlari.accent
                          : RenkTokenlari.primary,
                    },
                  ]}
                >
                  <Text style={[styles.harf, tahtMi && styles.harfTaht]}>
                    {harf}
                  </Text>
                </View>
              )}
            </SeviyeTaci>
          </KonusmaciAktiflikEfekti>
        ) : (
          <KonusmaciAktiflikEfekti
            userId={seat.user_id}
            size={efektBoy}
            hostMu={hostMu || tahtMi}
          >
            <View
              style={[
                styles.avatar,
                tahtMi && styles.avatarTahtBos,
                {
                  width: avatarBoy,
                  height: avatarBoy,
                  borderRadius: avatarBoy / 2,
                },
              ]}
            >
              <Ionicons
                name={tahtMi ? 'ribbon-outline' : 'add'}
                size={tahtMi ? 20 : 14}
                color={tahtMi ? RenkTokenlari.accent : RenkTokenlari.textMuted}
              />
            </View>
          </KonusmaciAktiflikEfekti>
        )}
        {dolu && (muted || micKilitli) ? (
          <View style={styles.micBadge} pointerEvents="none">
            <Ionicons
              name={micKilitli ? 'lock-closed' : 'mic-off'}
              size={9}
              color="#fff"
            />
          </View>
        ) : null}
      </View>

      <KoltukTahti
        numara={tahtMi ? null : koltukNo}
        tahtMi={tahtMi}
        doluMu={dolu}
        hostMu={hostMu}
        yardimciMu={yardimciMu}
      />

      {tahtMi ? (
        <Text style={[styles.name, styles.nameTaht]} numberOfLines={1}>
          {ad}
        </Text>
      ) : (
        <Text
          style={[styles.name, dolu && styles.nameDolu]}
          numberOfLines={1}
        >
          {ad}
        </Text>
      )}
      {hostMu ? (
        <View style={styles.hostRozet}>
          <Ionicons name="ribbon" size={8} color={RenkTokenlari.accent} />
          <Text style={styles.hostYazi}>SAHİP</Text>
        </View>
      ) : yardimciMu ? (
        <View style={styles.cohostRozet}>
          <Ionicons name="shield-checkmark" size={8} color="#8ec8ff" />
          <Text style={styles.cohostYazi}>ADMIN</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ayniKart(a: Props, b: Props) {
  return (
    a.tahtMi === b.tahtMi &&
    a.hostId === b.hostId &&
    a.onPress === b.onPress &&
    a.seat.id === b.seat.id &&
    a.seat.user_id === b.seat.user_id &&
    a.seat.is_muted === b.seat.is_muted &&
    a.seat.is_mic_locked === b.seat.is_mic_locked &&
    a.seat.is_cohost === b.seat.is_cohost &&
    a.seat.seat_index === b.seat.seat_index &&
    a.seat.profile?.avatar_url === b.seat.profile?.avatar_url &&
    a.seat.profile?.display_name === b.seat.profile?.display_name &&
    a.seat.profile?.username === b.seat.profile?.username &&
    a.seat.profile?.level === b.seat.profile?.level
  );
}

export const KonusmaciKarti = memo(KonusmaciKartiIc, ayniKart);

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 2 },
  wrapTaht: {
    width: '100%',
    maxWidth: 130,
    alignSelf: 'center',
    marginBottom: 4,
    gap: 0,
  },
  avatarKutu: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 4,
  },
  avatar: {
    backgroundColor: RenkTokenlari.seatEmpty,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarTahtBos: {
    borderColor: 'rgba(240,180,41,0.55)',
    borderWidth: 2,
  },
  avatarImg: {
    borderWidth: 1.5,
    borderColor: RenkTokenlari.primarySoft,
  },
  avatarHost: {
    borderColor: RenkTokenlari.accent,
    borderWidth: 2,
  },
  filled: {
    borderColor: RenkTokenlari.primarySoft,
    borderWidth: 1.5,
  },
  harf: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  harfTaht: {
    fontSize: 20,
  },
  name: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
    maxWidth: 68,
    marginTop: 1,
    fontSize: 10,
  },
  nameDolu: {
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  nameTaht: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 110,
    color: RenkTokenlari.accent,
  },
  hostRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(240,180,41,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.35)',
  },
  hostYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cohostRozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(100,180,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(100,180,255,0.35)',
  },
  cohostYazi: {
    ...TipografiTokenlari.micro,
    color: '#8ec8ff',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  micBadge: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(18,16,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
});
