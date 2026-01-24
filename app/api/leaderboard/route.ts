import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOG_PREFIX = '[API/leaderboard]';

export async function GET() {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`${LOG_PREFIX} [${requestId}] Request received - GET /api/leaderboard`);

  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(`${LOG_PREFIX} [${requestId}] Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY`);
      return NextResponse.json(
        {
          success: false,
          error: 'Server configuration error',
          details: 'Missing database configuration'
        },
        { status: 500 }
      );
    }

    console.log(`${LOG_PREFIX} [${requestId}] Initializing Supabase client`);
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`${LOG_PREFIX} [${requestId}] Executing Supabase query: SELECT * FROM scores ORDER BY total DESC`);
    const queryStartTime = Date.now();

    const { data: scores, error } = await supabase
      .from('scores')
      .select('*')
      .order('total', { ascending: false });

    const queryDuration = Date.now() - queryStartTime;
    console.log(`${LOG_PREFIX} [${requestId}] Supabase query completed in ${queryDuration}ms`);

    if (error) {
      console.error(`${LOG_PREFIX} [${requestId}] Supabase query error:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Database query failed',
          details: error.message
        },
        { status: 500 }
      );
    }

    const resultsCount = scores?.length ?? 0;
    console.log(`${LOG_PREFIX} [${requestId}] Query successful - Results count: ${resultsCount}`);

    if (resultsCount > 0) {
      console.log(`${LOG_PREFIX} [${requestId}] Top scores preview:`,
        scores.slice(0, 3).map(s => ({ teamId: s.team_id, total: s.total }))
      );
    }

    const response = {
      success: true,
      data: {
        scores: scores || [],
        lastRefresh: new Date().toISOString()
      }
    };

    console.log(`${LOG_PREFIX} [${requestId}] Response sent successfully - ${resultsCount} scores returned`);
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`${LOG_PREFIX} [${requestId}] Unhandled exception:`, {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch leaderboard data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
