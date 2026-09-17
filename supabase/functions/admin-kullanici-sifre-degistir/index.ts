import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Body = {
  user_id: string;
  password: string;
};

/**
 * Admin: hedef kullanicinin sifresini degistir.
 * Caller must be is_admin.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anon || !serviceKey) {
      return Response.json({ error: 'env missing' }, { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: me } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    if (!me?.is_admin) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const body = (await req.json()) as Body;
    const userId = (body.user_id ?? '').trim();
    const password = body.password ?? '';
    if (!userId || password.length < 6) {
      return Response.json(
        { error: 'user_id ve en az 6 karakter sifre gerekli' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, display_name, username')
      .eq('id', userId)
      .maybeSingle();
    if (!target) {
      return Response.json({ error: 'Kullanici bulunamadi' }, { status: 404, headers: corsHeaders });
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      password,
    });
    if (updateErr) {
      return Response.json(
        { error: updateErr.message ?? 'sifre guncellenemedi' },
        { status: 400, headers: corsHeaders },
      );
    }

    const etiket =
      target.display_name ??
      (target.username ? `@${target.username}` : userId.slice(0, 8));

    await admin.from('admin_audit_logs').insert({
      admin_id: user.id,
      target_user_id: userId,
      action: 'change_password',
      summary: `Sifre degistirildi: ${etiket}`,
      details: { user_id: userId },
    });

    return Response.json({ ok: true, user_id: userId }, { headers: corsHeaders });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'error' },
      { status: 500, headers: corsHeaders },
    );
  }
});
