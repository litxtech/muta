/**
 * Realm of Storms — spin Edge Function.
 * SERVER üretimi: crypto seed → simulate → atomik settle RPC → client'a
 * deterministic cascade timeline. Client sonucu asla üretmez.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  simulateSpin,
  DEFAULT_CONFIG,
  type MathConfig,
} from '../_shared/kozmik-kaskad/math.ts';

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

function jsonError(
  message: string,
  code: string,
  status: number,
): Response {
  return Response.json({ error: message, code }, { status, headers: corsHeaders });
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
      return jsonError('Supabase env missing', 'env', 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Unauthorized', 'auth', 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonError('Unauthorized', 'auth', 401);
    }

    const body = (await req.json()) as {
      betAmount?: number;
      idempotencyKey?: string;
      roomId?: string | null;
    };

    const betAmount = Math.floor(Number(body.betAmount ?? 0));
    const idempotencyKey = String(body.idempotencyKey ?? '').trim();
    if (!idempotencyKey) {
      return jsonError('idempotencyKey required', 'idempotency', 400);
    }
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      return jsonError('Invalid bet', 'bet', 400);
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

    // Client arbitrary bet gönderemez: preset + aralık server'da doğrulanır.
    if (betAmount < config.minBet || betAmount > config.maxBet) {
      return jsonError('Bet out of range', 'bet_range', 400);
    }
    if (
      config.betPresets.length > 0 &&
      !config.betPresets.includes(betAmount)
    ) {
      return jsonError('Bet not allowed', 'bet_preset', 400);
    }

    const { data: wallet } = await admin
      .from('wallets')
      .select('coins')
      .eq('user_id', user.id)
      .maybeSingle();

    const balanceBefore = Number(wallet?.coins ?? 0);

    const { data: session } = await admin
      .from('kaskad_sessions')
      .select('id, bonus_spins_remaining, bonus_persistent_multiplier')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const bonusLeft = Number(session?.bonus_spins_remaining ?? 0);
    const isBonusSpin = bonusLeft > 0;
    const persistentMultiplier = Number(
      session?.bonus_persistent_multiplier ?? 0,
    );

    if (!isAdmin && !isBonusSpin && balanceBefore < betAmount) {
      return jsonError('Insufficient coins', 'insufficient_balance', 400);
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
      persistentMultiplier,
    });

    // Atomik settle: bet debit + round insert + ledger + bonus sayaçları
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
      return jsonError(settleErr.message, 'settle', 400);
    }

    const payload = settle as {
      duplicate?: boolean;
      result?: Record<string, unknown>;
      balanceAfter?: number;
      roundId?: string;
      sessionId?: string;
    };

    if (payload.duplicate) {
      return Response.json(
        { result: payload.result, duplicate: true },
        { headers: corsHeaders },
      );
    }

    const result = {
      ...simulated,
      roundId: String(payload.roundId ?? simulated.roundId),
      sessionId: String(payload.sessionId ?? simulated.sessionId),
      balanceAfter: Number(payload.balanceAfter ?? simulated.balanceAfter),
    };

    return Response.json({ result }, { headers: corsHeaders });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500, headers: corsHeaders },
    );
  }
});
