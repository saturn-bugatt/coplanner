import { NextResponse } from 'next/server';
import { analyzeRepo, generateHypeCommentary } from '@/lib/analyzer';
import { getScores, saveScores, addCommentary } from '@/lib/storage';
import { TeamScore } from '@/lib/rubric';
import repos from '@/data/repos.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for analysis

const LOG_PREFIX = '[API/refresh]';

interface Team {
  id: string;
  name: string;
  repo: string;
  track: number;
}

export async function GET(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`${LOG_PREFIX} [${requestId}] Request received - GET /api/refresh`);

  // Verify cron secret for production
  const authHeader = request.headers.get('authorization');
  console.log(`${LOG_PREFIX} [${requestId}] Authorization header present: ${!!authHeader}`);

  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development without secret
    if (process.env.NODE_ENV === 'production') {
      console.warn(`${LOG_PREFIX} [${requestId}] Unauthorized request - invalid or missing CRON_SECRET`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`${LOG_PREFIX} [${requestId}] Development mode - bypassing CRON_SECRET check`);
  }

  return handleRefresh(requestId);
}

export async function POST() {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`${LOG_PREFIX} [${requestId}] Request received - POST /api/refresh`);
  return handleRefresh(requestId);
}

async function handleRefresh(requestId: string) {
  const refreshStartTime = Date.now();
  console.log(`${LOG_PREFIX} [${requestId}] Refresh triggered - starting analysis`);

  try {
    const teams = repos.teams as Team[];
    console.log(`${LOG_PREFIX} [${requestId}] Teams to analyze: ${teams.length}`);
    console.log(`${LOG_PREFIX} [${requestId}] Team list:`, teams.map(t => ({ id: t.id, name: t.name, track: t.track })));

    console.log(`${LOG_PREFIX} [${requestId}] Fetching previous scores for comparison`);
    const previousScores = await getScores();
    console.log(`${LOG_PREFIX} [${requestId}] Previous scores count: ${previousScores.length}`);

    // Analyze all repos in parallel (with some batching to avoid rate limits)
    const batchSize = 5;
    const newScores: TeamScore[] = [];

    console.log(`${LOG_PREFIX} [${requestId}] Starting batch analysis with batch size: ${batchSize}`);

    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(teams.length / batchSize);

      console.log(`${LOG_PREFIX} [${requestId}] Processing batch ${batchNumber}/${totalBatches}:`,
        batch.map(t => t.name)
      );

      const batchStartTime = Date.now();

      try {
        const batchResults = await Promise.all(
          batch.map(async (team) => {
            console.log(`${LOG_PREFIX} [${requestId}] Analyzing team: ${team.name} (${team.id}) - repo: ${team.repo}`);
            try {
              const result = await analyzeRepo(team.id, team.name, team.repo, team.track);
              console.log(`${LOG_PREFIX} [${requestId}] Analysis complete for ${team.name}: total score = ${result.total}`);
              return result;
            } catch (teamError) {
              const errorMessage = teamError instanceof Error ? teamError.message : 'Unknown error';
              console.error(`${LOG_PREFIX} [${requestId}] Error analyzing team ${team.name}:`, errorMessage);
              // Return a zero-score entry for failed teams to avoid breaking the batch
              return {
                teamId: team.id,
                teamName: team.name,
                repo: team.repo,
                track: team.track,
                problem: 0,
                solution: 0,
                execution: 0,
                total: 0,
                linesOfCode: 0,
                commentary: `Analysis failed: ${errorMessage}`,
                lastUpdated: new Date().toISOString()
              } as TeamScore;
            }
          })
        );

        const batchDuration = Date.now() - batchStartTime;
        console.log(`${LOG_PREFIX} [${requestId}] Batch ${batchNumber} completed in ${batchDuration}ms`);

        newScores.push(...batchResults);
      } catch (batchError) {
        const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error';
        console.error(`${LOG_PREFIX} [${requestId}] Batch ${batchNumber} failed:`, errorMessage);
        // Continue with next batch instead of failing entirely
      }
    }

    console.log(`${LOG_PREFIX} [${requestId}] All batches processed. Total scores collected: ${newScores.length}`);
    console.log(`${LOG_PREFIX} [${requestId}] Scores summary:`,
      newScores.map(s => ({ team: s.teamName, total: s.total, hasError: !!(s as any).error }))
    );

    // Save the new scores
    console.log(`${LOG_PREFIX} [${requestId}] Saving ${newScores.length} scores to database`);
    try {
      await saveScores(newScores);
      console.log(`${LOG_PREFIX} [${requestId}] Scores saved successfully`);
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
      console.error(`${LOG_PREFIX} [${requestId}] Error saving scores:`, errorMessage);
      throw saveError;
    }

    // Check for significant events and generate commentary
    console.log(`${LOG_PREFIX} [${requestId}] Checking for significant events and generating commentary`);
    let commentaryCount = 0;

    for (const newScore of newScores) {
      const oldScore = previousScores.find(s => s.teamId === newScore.teamId);

      // Check for rank changes
      if (oldScore?.currentRank && newScore.currentRank) {
        if (newScore.currentRank < oldScore.currentRank) {
          console.log(`${LOG_PREFIX} [${requestId}] Rank change detected for ${newScore.teamName}: ${oldScore.currentRank} -> ${newScore.currentRank}`);
          try {
            const commentary = await generateHypeCommentary('rank_change', newScore.teamName, {
              oldRank: oldScore.currentRank,
              newRank: newScore.currentRank
            });
            await addCommentary(commentary);
            commentaryCount++;
          } catch (commentaryError) {
            console.error(`${LOG_PREFIX} [${requestId}] Error generating rank change commentary:`, commentaryError);
          }
        }
      }

      // Check for score changes
      if (oldScore && oldScore.total !== newScore.total && newScore.total > 0) {
        console.log(`${LOG_PREFIX} [${requestId}] Score change detected for ${newScore.teamName}: ${oldScore.total} -> ${newScore.total}`);
        try {
          const commentary = await generateHypeCommentary('score_update', newScore.teamName, {
            score: newScore.total
          });
          await addCommentary(commentary);
          commentaryCount++;
        } catch (commentaryError) {
          console.error(`${LOG_PREFIX} [${requestId}] Error generating score update commentary:`, commentaryError);
        }
      }

      // Add team's own commentary
      if (newScore.commentary && newScore.total > 0) {
        console.log(`${LOG_PREFIX} [${requestId}] Adding team commentary for ${newScore.teamName}`);
        try {
          await addCommentary(newScore.commentary);
          commentaryCount++;
        } catch (commentaryError) {
          console.error(`${LOG_PREFIX} [${requestId}] Error adding team commentary:`, commentaryError);
        }
      }
    }

    const totalDuration = Date.now() - refreshStartTime;
    console.log(`${LOG_PREFIX} [${requestId}] Refresh completed successfully in ${totalDuration}ms`);
    console.log(`${LOG_PREFIX} [${requestId}] Results summary: ${newScores.length} teams analyzed, ${commentaryCount} commentary items added`);

    return NextResponse.json({
      success: true,
      message: `Refreshed ${newScores.length} team scores`,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      commentaryAdded: commentaryCount
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const totalDuration = Date.now() - refreshStartTime;

    console.error(`${LOG_PREFIX} [${requestId}] Refresh failed after ${totalDuration}ms:`, {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh scores',
        details: errorMessage,
        duration: totalDuration
      },
      { status: 500 }
    );
  }
}
