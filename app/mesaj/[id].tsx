import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { MesajlariGetir, type DirektMesaj } from '../../src/moduller/mesajlasma/okuma/MesajlariGetir';
import { MesajGonder } from '../../src/moduller/mesajlasma/islemler/MesajGonder';
import { ModulHataSiniri } from '../../src/ortak/hata-sinirlari/ModulHataSiniri';
import { RenkTokenlari } from '../../src/tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../src/tasarim-sistemi/TipografiTokenlari';

export default function MesajDetayEkrani() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [mesajlar, setMesajlar] = useState<DirektMesaj[]>([]);
  const [metin, setMetin] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id || id === 'yeni') return;
    try {
      setMesajlar(await MesajlariGetir({ threadId: id, limit: 40 }));
    } catch {
      setMesajlar([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const gonder = async () => {
    if (!id || id === 'yeni' || !metin.trim()) return;
    setLoading(true);
    const sonuc = await MesajGonder({ threadId: id, body: metin.trim() });
    setLoading(false);
    if (!sonuc.ok) {
      Alert.alert('Gönderilemedi', sonuc.hata ?? 'Hata');
      return;
    }
    setMetin('');
    await load();
  };

  if (id === 'yeni') {
    return (
      <Screen>
        <View style={styles.pad}>
          <Text style={styles.title}>Yeni sohbet</Text>
          <Text style={styles.sub}>
            FAZ 4: kullanıcı arama sonraki adım. Şimdilik profilden Public ID ile
            `ozel_sohbet_ac_veya_getir` RPC kullanılacak.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ModulHataSiniri modulAdi="mesajlasma">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.title}>Sohbet</Text>
          <FlatList
            data={mesajlar}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const mine = item.sender_id === user?.id;
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
              );
            }}
          />
          <View style={styles.composer}>
            <TextField
              value={metin}
              onChangeText={setMetin}
              placeholder="Mesaj yaz..."
              style={{ flex: 1 }}
            />
            <GradientButton title="Gönder" onPress={gonder} loading={loading} />
          </View>
        </KeyboardAvoidingView>
      </ModulHataSiniri>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 20, gap: 8 },
  title: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sub: { ...TipografiTokenlari.body, color: RenkTokenlari.textMuted },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(232, 64, 145, 0.28)',
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: RenkTokenlari.surface,
  },
  body: { ...TipografiTokenlari.body, color: RenkTokenlari.text },
  composer: { padding: 16, gap: 10 },
});
