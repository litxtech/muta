import { Stack } from 'expo-router';
import { useTema } from '../../src/tasarim-sistemi/tema/TemaSaglayici';

export default function AuthLayout() {
  const { palet } = useTema();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palet.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
