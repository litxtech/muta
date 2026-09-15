import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-worker-secret',
};

/**
 * 23:59 TR gunluk kayit ozeti + pending push worker tetik.
 * Scheduler: her saat :59 veya Supabase Cron → bu fonksiyon.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const workerSecret = Deno.env.get('PUSH_WORKER_SECRET');
    if (workerSecret) {
      const got = req.headers.get('x-worker-secret');
      if (got !== workerSecret) {
        return Response.json(
          { error: 'Forbidden' },
          { status: 403, headers: corsHeaders },
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: 'Missing env' },
        { status: 500, headers: corsHeaders },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      force?: boolean;
    };

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc(
      'admin_gunluk_kayit_ozeti_gonder',
      { p_force: !!body.force },
    );
    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500, headers: corsHeaders },
      );
    }

    // Outbox'taki admin bildirimlerini hemen gondermeyi dene
    try {
      await fetch(`${supabaseUrl}/functions/v1/notification-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          ...(workerSecret
            ? { 'X-Worker-Secret': workerSecret }
            : {}),
        },
        body: JSON.stringify({ limit: 40 }),
      });
    } catch {
      /* push worker ayri cron ile de calisir */
    }

    return Response.json(
      { ok: true, digest: data },
      { headers: corsHeaders },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Hata' },
      { status: 500, headers: corsHeaders },
    );
  }
});
