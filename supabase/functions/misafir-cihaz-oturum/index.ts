import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/**
 * Misafir cihaz oturumu yenile — yalnız guest_active binding.
 * Body: { device_id, user_id }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: 'env missing' },
        { status: 500, headers: corsHeaders },
      );
    }

    let deviceId = '';
    let userId = '';
    try {
      const body = await req.json();
      deviceId =
        typeof body?.device_id === 'string' ? body.device_id.trim() : '';
      userId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    } catch {
      return Response.json(
        { error: 'invalid body' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!deviceId || !userId) {
      return Response.json(
        { error: 'device_id and user_id required' },
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: dogrula, error: dogrulaErr } = await admin.rpc(
      'misafir_cihaz_oturum_dogrula',
      { p_device_id: deviceId, p_user_id: userId },
    );
    if (dogrulaErr) {
      return Response.json(
        { error: dogrulaErr.message },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!dogrula || (dogrula as { ok?: boolean }).ok !== true) {
      return Response.json(
        { error: (dogrula as { hata?: string })?.hata ?? 'not_allowed' },
        { status: 403, headers: corsHeaders },
      );
    }

    const synthetic = `guest-${userId.replace(/-/g, '')}@guest.muta.internal`;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      email: synthetic,
      email_confirm: true,
      user_metadata: { is_guest: true },
    });
    if (updErr) {
      return Response.json(
        { error: updErr.message },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: synthetic,
      });
    if (linkErr || !linkData?.properties?.hashed_token) {
      return Response.json(
        { error: linkErr?.message ?? 'link failed' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: otpData, error: otpErr } = await admin.auth.verifyOtp({
      type: 'email',
      token_hash: linkData.properties.hashed_token,
    });
    if (otpErr || !otpData.session) {
      return Response.json(
        { error: otpErr?.message ?? 'session failed' },
        { status: 400, headers: corsHeaders },
      );
    }

    return Response.json(
      {
        access_token: otpData.session.access_token,
        refresh_token: otpData.session.refresh_token,
        user_id: userId,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500, headers: corsHeaders },
    );
  }
});
