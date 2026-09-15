import { createClient } from 'npm:@supabase/supabase-js@2';
import { RtcRole, RtcTokenBuilder } from 'npm:agora-token@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type AgoraRol = 'listener' | 'speaker' | 'host' | 'publisher';

function rolPublisherMi(role: AgoraRol) {
  return role === 'host' || role === 'publisher' || role === 'speaker';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');

    if (!appId || !appCertificate) {
      return Response.json(
        { error: 'Agora secrets missing (AGORA_APP_ID / AGORA_APP_CERTIFICATE)' },
        { status: 500, headers: corsHeaders },
      );
    }
    if (!supabaseUrl || !supabaseAnon) {
      return Response.json(
        { error: 'Supabase env missing' },
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

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json(
        { error: 'Invalid session' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = (await req.json()) as {
      channelName?: string;
      role?: AgoraRol;
      expireSeconds?: number;
    };
    const channelName = body.channelName?.trim();
    const role: AgoraRol = body.role ?? 'listener';
    if (!channelName || channelName.length > 64) {
      return Response.json(
        { error: 'Invalid channelName' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Audit + kill_live (FAZ 5 RPC)
    const { error: auditError } = await supabase.rpc('livekit_token_istegi_kaydet', {
      p_room_name: channelName,
      p_role: role,
    });
    if (auditError) {
      return Response.json(
        { error: auditError.message },
        { status: 403, headers: corsHeaders },
      );
    }

    const uid = 0; // string UID kullanmak icin 0 + account
    const expire = Math.max(60, Math.min(body.expireSeconds ?? 3600, 86400));
    const privilegeExpire = Math.floor(Date.now() / 1000) + expire;
    const rtcRole = rolPublisherMi(role) ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      user.id,
      rtcRole,
      privilegeExpire,
      privilegeExpire,
    );

    return Response.json(
      {
        token,
        appId,
        channelName,
        uid: user.id,
        role,
        expireSeconds: expire,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Agora token failed';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
