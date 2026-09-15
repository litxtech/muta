/**
 * Kozmik Kaskad — Edge Function.
 * SERVER üretimi: crypto seed → simulate → settle RPC → client'a cascade payload.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { simulateSpin, DEFAULT_CONFIG, type MathConfig } from '../_shared/kozmik-kaskad/math.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function cryptoSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnon || !serviceKey) {
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

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = (await req.json()) as {
      betAmount?: number;
      idempotencyKey?: string;
      roomId?: string | null;
      bonusSessionId?: string | null;
    };

    const betAmount = Math.floor(Number(body.betAmount ?? 0));
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    if (!idempotencyKey) {
      return Response.json(
        { error: 'idempotencyKey required', code: 'idempotency' },
        { status: 400, headers: corsHeaders },
      );
    }
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      return Response.json(
        { error: 'Invalid bet', code: 'bet' },
        { status: 400, headers: corsHeaders },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profileRow } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = profileRow?.is_admin === true;

    const { data: cfgRow } = await admin
      .from('kaskad_math_versions')
      .select('config')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const config: MathConfig = {
      ...DEFAULT_CONFIG,
      ...(cfgRow?.config as Partial<MathConfig> | undefined),
    };

    if (betAmount < config.minBet || betAmount > config.maxBet) {
      return Response.json(
        { error: 'Bet out of range', code: 'bet_range' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: wallet } = await admin
      .from('wallets')
      .select('coins')
      .eq('user_id', user.id)
      .maybeSingle();

    const balanceBefore = Number(wallet?.coins ?? 0);

    const { data: session } = await admin
      .from('kaskad_sessions')
      .select('id, bonus_spins_remaining')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bonusLeft = Number(session?.bonus_spins_remaining ?? 0);
    const isBonusSpin = bonusLeft > 0;

    if (!isAdmin && !isBonusSpin && balanceBefore < betAmount) {
      return Response.json(
        { error: 'Insufficient coins', code: 'insufficient_balance' },
        { status: 400, headers: corsHeaders },
      );
    }

    const seed = cryptoSeed();
    const simulated = simulateSpin({
      config,
      seed,
      betAmount,
      roundId: 'pending',
      sessionId: session?.id ?? 'pending',
      balanceBefore,
      remainingBonusSpins: bonusLeft,
      isBonusSpin,
    });

    const { data: settle, error: settleErr } = await admin.rpc(
      'kozmik_kaskad_settle_spin',
      {
        p_user_id: user.id,
        p_idempotency_key: idempotencyKey,
        p_bet_amount: betAmount,
        p_room_id: body.roomId ?? null,
        p_result: simulated,
        p_is_bonus_spin: isBonusSpin,
      },
    );

    if (settleErr) {
      return Response.json(
        { error: settleErr.message, code: 'settle' },
        { status: 400, headers: corsHeaders },
      );
    }

    const payload = settle as {
      duplicate?: boolean;
      result?: Record<string, unknown>;
      balanceAfter?: number;
      roundId?: string;
      sessionId?: string;
    };

    const result = {
      ...simulated,
      ...(payload.result ?? {}),
      roundId: String(payload.roundId ?? simulated.roundId),
      sessionId: String(payload.sessionId ?? simulated.sessionId),
      balanceAfter: Number(payload.balanceAfter ?? simulated.balanceAfter),
    };

    // Bonus spin sayacı güncelle
    if (session?.id) {
      let nextBonus = Math.max(0, bonusLeft - (isBonusSpin ? 1 : 0));
      if (simulated.bonusTriggered && simulated.bonus) {
        nextBonus += simulated.bonus.freeSpins;
      }
      await admin
        .from('kaskad_sessions')
        .update({ bonus_spins_remaining: nextBonus })
        .eq('id', session.id);
      result.remainingBonusSpins = nextBonus;
    }

    return Response.json({ result }, { headers: corsHeaders });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500, headers: corsHeaders },
    );
  }
});
