import { useLocalSearchParams } from 'expo-router';

export function useAjansRouteId(): string {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return id ?? '';
}

export function ajansHref(agencyId: string, path = ''): string {
  const base = `/ajans/${agencyId}`;
  if (!path) return base;
  return `${base}/${path.replace(/^\//, '')}`;
}
