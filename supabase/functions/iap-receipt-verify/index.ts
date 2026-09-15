import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Body = {
  packageId?: string;
  store?: 'apple' | 'google';
  productId?: string;
  transactionId?: string;
  purchaseToken?: string;
  idempotencyKey?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anon) {
      return Response.json({ error: 'Missing Supabase env' }, { status: 500, headers: corsHeaders });
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
      return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as Body;
    if (!body.packageId || !body.store || !body.productId || !body.idempotencyKey) {
      return Response.json({ error: 'Invalid payload' }, { status: 400, headers: corsHeaders });
    }
    if (!body.transactionId && !body.purchaseToken) {
      return Response.json({ error: 'Missing transaction proof' }, { status: 400, headers: corsHeaders });
    }

    // Production: Apple App Store Server API / Google Play Developer API verify burada.
    // Sandbox/dev: token varligi + paket-SKU eslesmesi yeterli (APPLE_IAP_SKIP_VERIFY=1).
    const skip = Deno.env.get('APPLE_IAP_SKIP_VERIFY') === '1' ||
      Deno.env.get('IAP_SKIP_VERIFY') === '1';

    if (!skip) {
      const appleKey = Deno.env.get('APPLE_IAP_ISSUER_ID');
      const googleSa = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
      if (body.store === 'apple' && !appleKey) {
        return Response.json(
          { error: 'Apple IAP not configured; set APPLE_IAP_* or IAP_SKIP_VERIFY=1 for sandbox' },
          { status: 503, headers: corsHeaders },
        );
      }
      if (body.store === 'google' && !googleSa) {
        return Response.json(
          { error: 'Google Play not configured; set GOOGLE_PLAY_* or IAP_SKIP_VERIFY=1' },
          { status: 503, headers: corsHeaders },
        );
      }
      // TODO: real verify against Apple/Google when credentials present
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: pkg, error: pkgErr } = await admin
      .from('coin_packages')
      .select('*')
      .eq('id', body.packageId)
      .eq('is_active', true)
      .maybeSingle();
    if (pkgErr || !pkg) {
      return Response.json({ error: 'Package not found' }, { status: 404, headers: corsHeaders });
    }

    const expectedSku =
      body.store === 'apple' ? pkg.apple_product_id ?? pkg.sku : pkg.google_product_id ?? pkg.sku;
    if (expectedSku && body.productId !== expectedSku && body.productId !== pkg.sku) {
      return Response.json({ error: 'Product mismatch' }, { status: 400, headers: corsHeaders });
    }

    const providerTx =
      body.transactionId ?? body.purchaseToken ?? `${body.store}_${body.idempotencyKey}`;

    const { data, error } = await admin.rpc('coin_satin_al_onayla_servis', {
      p_user_id: user.id,
      p_package_id: body.packageId,
      p_idempotency_key: body.idempotencyKey,
      p_provider: body.store,
      p_provider_tx_id: providerTx,
      p_store: body.store,
      p_amount_usd: pkg.price_usd,
      p_receipt: {
        store: body.store,
        productId: body.productId,
        transactionId: body.transactionId ?? null,
        purchaseToken: body.purchaseToken ? '[redacted]' : null,
        verified: skip ? 'sandbox_skip' : 'pending_full_verify',
      },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }

    return Response.json(
      {
        ok: true,
        coinsAdded: (data as { coins_added?: number })?.coins_added ?? 0,
        purchase: data,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'verify failed';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
