import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!stripeKey || !supabaseUrl || !anon || !serviceKey) {
      return Response.json({ error: 'Stripe/Supabase env missing' }, { status: 500, headers: corsHeaders });
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
    } = await userClient.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as {
      packageId?: string;
      successUrl?: string;
      cancelUrl?: string;
      idempotencyKey?: string;
    };
    if (!body.packageId || !body.idempotencyKey) {
      return Response.json({ error: 'packageId and idempotencyKey required' }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: flag } = await admin
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'stripe_enabled')
      .maybeSingle();
    if (!flag?.enabled) {
      return Response.json({ error: 'Stripe disabled' }, { status: 403, headers: corsHeaders });
    }

    const { data: pkg, error: pkgErr } = await admin
      .from('coin_packages')
      .select('*')
      .eq('id', body.packageId)
      .eq('is_active', true)
      .maybeSingle();
    if (pkgErr || !pkg) {
      return Response.json({ error: 'Package not found' }, { status: 404, headers: corsHeaders });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });
    const successUrl =
      body.successUrl ??
      Deno.env.get('STRIPE_SUCCESS_URL') ??
      'muta://wallet?stripe=success';
    const cancelUrl =
      body.cancelUrl ?? Deno.env.get('STRIPE_CANCEL_URL') ?? 'muta://wallet?stripe=cancel';

    const lineItems = pkg.stripe_price_id
      ? [{ price: pkg.stripe_price_id as string, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(Number(pkg.price_usd) * 100),
              product_data: {
                name: `${pkg.title} — ${pkg.coins + (pkg.bonus_coins ?? 0)} coins`,
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          package_id: pkg.id,
          idempotency_key: body.idempotencyKey,
        },
      },
      { idempotencyKey: body.idempotencyKey },
    );

    await admin.from('payment_orders').upsert(
      {
        user_id: user.id,
        package_id: pkg.id,
        provider: 'stripe',
        provider_session_id: session.id,
        amount_usd: pkg.price_usd,
        status: 'pending',
        idempotency_key: body.idempotencyKey,
        metadata: { checkout_url: session.url },
      },
      { onConflict: 'idempotency_key' },
    );

    return Response.json(
      { ok: true, url: session.url, sessionId: session.id },
      { headers: corsHeaders },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'checkout failed';
    return Response.json({ error: message }, { status: 500, headers: corsHeaders });
  }
});
