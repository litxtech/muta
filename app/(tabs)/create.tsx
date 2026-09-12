import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { GradientButton } from '../../src/components/GradientButton';
import { useAuth } from '../../src/contexts/AuthContext';
import { createRoom } from '../../src/services/api';
import type { Room } from '../../src/types/models';
import { HesabiTamamlaKarti } from '../../src/moduller/misafir-hesabi/bilesenler/HesabiTamamlaKarti';
import { useMisafirIslemKapisi } from '../../src/moduller/misafir-hesabi/islemler/useMisafirIslemKapisi';
import { colors, radii, typography } from '../../src/theme/colors';

const MODES: { id: Room['mode']; label: string; emoji: string }[] = [
  { id: 'dating', label: 'Dating', emoji: '💘' },
  { id: 'party', label: 'Party', emoji: '🎉' },
  { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
  { id: 'game', label: 'Game', emoji: '🎮' },
];

export default function CreateRoomScreen() {
  const { user, isGuest, refreshProfile, refreshWallet } = useAuth();
  const { upgradeAcik, upgradeKapat, islemiDene } = useMisafirIslemKapisi(isGuest);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<Room['mode']>('dating');
  const [loading, setLoading] = useState(false);

  const onCreate = () => {
    islemiDene('oda_olustur', async () => {
      if (!user) {
        Alert.alert('Giriş gerekli');
        return;
      }
      if (!title.trim()) {
        Alert.alert('Başlık gerekli');
        return;
      }
      setLoading(true);
      try {
        const room = await createRoom({
          hostId: user.id,
          title: title.trim(),
          topic: topic.trim() || undefined,
          mode,
          maxSeats: 8,
        });
        router.push(`/lobi/${room.id}` as any);
      } catch (e) {
        Alert.alert(
          'Oda açılamadı',
          e instanceof Error
            ? e.message
            : 'Supabase migration çalıştırıldığından emin ol.',
        );
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Canlı oda aç</Text>
        <Text style={styles.sub}>Mikrofonuna geç, hediye yağmurunu başlat.</Text>

        <View style={styles.modes}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[styles.mode, mode === m.id && styles.modeActive]}
            >
              <Text style={styles.emoji}>{m.emoji}</Text>
              <Text style={[styles.modeLabel, mode === m.id && styles.modeLabelActive]}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextField
          label="Oda başlığı"
          value={title}
          onChangeText={setTitle}
          placeholder="Gece sohbeti..."
          maxLength={40}
        />
        <TextField
          label="Konu (opsiyonel)"
          value={topic}
          onChangeText={setTopic}
          placeholder="Flört, müzik, oyun..."
          maxLength={60}
        />

        <GradientButton title="Yayını başlat" onPress={onCreate} loading={loading} />
      </View>

      <HesabiTamamlaKarti
        visible={upgradeAcik}
        onClose={upgradeKapat}
        onCompleted={() => {
          void refreshProfile();
          void refreshWallet();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 20, gap: 14 },
  title: { ...typography.title, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted, marginBottom: 6 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mode: {
    width: '47%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 6,
  },
  modeActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(232, 64, 145, 0.14)',
  },
  emoji: { fontSize: 22 },
  modeLabel: { ...typography.h2, color: colors.textMuted },
  modeLabelActive: { color: colors.text },
});
