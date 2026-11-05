import { supabase } from '../../../supabase/client';

/**
 * Simple reporting service for Tamuso‑Chain related issues.
 * It inserts a row into the `tamuso_chain_reports` table.
 * The table should have columns: id (uuid), user_id (uuid), type (text),
 * title (text), description (text), created_at (timestamp).
 */
export async function gonderBildirim({
  userId,
  type,
  title,
  description,
}: {
  userId: string;
  type: string;
  title: string;
  description: string;
}) {
  const { data, error } = await supabase.from('tamuso_chain_reports').insert({
    user_id: userId,
    type,
    title,
    description,
  });
  if (error) {
    console.error('Tamuso‑Chain bildirim gönderilemedi:', error);
    throw error;
  }
  return data;
}
