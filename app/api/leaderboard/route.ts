import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOG_PREFIX = '[API/leaderboard]';

export async function GET() {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`${LOG_PREFIX} [${requestId}] Request received - GET /api/leaderboard`);

  try {
    // Read from local file
    const scoresPath = path.join(process.cwd(), '.data/scores.json');

    if (!fs.existsSync(scoresPath)) {
      console.log(`${LOG_PREFIX} [${requestId}] No scores file found at ${scoresPath}`);
      return NextResponse.json({
        success: true,
        data: {
          scores: [],
          lastRefresh: new Date().toISOString()
        }
      });
    }

    const fileContent = fs.readFileSync(scoresPath, 'utf-8');
    const localScores = JSON.parse(fileContent);

    // Transform to expected format
    const scores = localScores.map((s: any) => ({
      id: s.teamId,
      team_name: s.teamName,
      repo: s.repo,
      track: s.track,
      problem: s.problem,
      solution: s.solution,
      execution: s.execution,
      total: s.total,
      lines_of_code: s.linesOfCode,
      commentary: s.commentary,
      last_updated: s.lastUpdated
    }));

    // Sort by total descending
    scores.sort((a: any, b: any) => b.total - a.total);

    const resultsCount = scores.length;
    console.log(`${LOG_PREFIX} [${requestId}] Loaded ${resultsCount} scores from local file`);

    return NextResponse.json({
      success: true,
      data: {
        scores,
        lastRefresh: new Date().toISOString()
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${LOG_PREFIX} [${requestId}] Error:`, errorMessage);

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
