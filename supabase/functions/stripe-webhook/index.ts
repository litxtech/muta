import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    return Response.json({ error: 'env missing' }, { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return Response.json({ error: 'No signature' }, { status: 400, headers: corsHeaders });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'bad signature';
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id ?? session.client_reference_id;
    const packageId = session.metadata?.package_id;
    const idem = session.metadata?.idempotency_key ?? session.id;
    if (userId && packageId && session.payment_status === 'paid') {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.rpc('coin_satin_al_onayla_servis', {
        p_user_id: userId,
        p_package_id: packageId,
        p_idempotency_key: idem,
        p_provider: 'stripe',
        p_provider_tx_id: session.payment_intent?.toString() ?? session.id,
        p_store: 'manual',
        p_amount_usd: session.amount_total ? session.amount_total / 100 : null,
        p_receipt: { stripe_session: session.id },
      });
    }
  }

  return Response.json({ received: true }, { headers: corsHeaders });
});
