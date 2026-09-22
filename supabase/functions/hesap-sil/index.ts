import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/**
 * Hesap silme (edge): soft scrub + auth.users hard delete.
 *
 * Soft delete client RPC ile yapılır; burada idempotent scrub.
 * Hard delete → Apple/Spotify kimliği serbest kalır; tekrar giriş YENİ hesap açar.
 * profiles FK CASCADE kaldırıldığı için eski profil "Hesap silindi" tombstone olarak kalır.
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
      return Response.json(
        { error: 'env missing' },
        { status: 500, headers: corsHeaders },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return Response.json(
        { error: 'Invalid session' },
        { status: 401, headers: corsHeaders },
      );
    }

    let reason: string | null = null;
    try {
      const body = await req.json();
      reason = typeof body?.reason === 'string' ? body.reason : null;
    } catch {
      /* body optional */
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();
    const uname = `deleted_${user.id.replace(/-/g, '')}`;

    await admin
      .from('profiles')
      .update({
        deleted_at: now,
        deletion_requested_at: now,
        display_name: 'Hesap silindi',
        username: uname,
        avatar_url: null,
        cover_url: null,
        bio: '',
        phone_e164: null,
        birth_date: null,
        gender: null,
        country_code: null,
        region_id: null,
        updated_at: now,
      })
      .eq('id', user.id);

    await admin
      .from('device_sessions')
      .update({ revoked_at: now })
      .eq('user_id', user.id)
      .is('revoked_at', null);

    await admin
      .from('device_push_tokens')
      .update({
        push_token: null,
        active: false,
        notification_enabled: false,
      })
      .eq('user_id', user.id);

    await admin.from('user_bank_accounts').delete().eq('user_id', user.id);

    await admin.from('security_events').insert({
      user_id: user.id,
      event_type: 'account_hard_delete_attempt',
      severity: 'medium',
      metadata: { reason, mode: 'hard_delete_auth_keep_profile_tombstone' },
    });

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      // Hard delete başarısızsa ban — aynı hesaba dönüş engeli
      const { error: banErr } = await admin.auth.admin.updateUserById(user.id, {
        ban_duration: '876600h',
      });
      return Response.json(
        {
          ok: true,
          hardDeleted: false,
          softDeleted: true,
          banned: !banErr,
          note: delErr.message,
        },
        { headers: corsHeaders },
      );
    }

    return Response.json(
      { ok: true, hardDeleted: true, softDeleted: true },
      { headers: corsHeaders },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'delete failed';
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders },
    );
  }
});
