import { NextResponse } from 'next/server';
import { analyzeRepo, generateHypeCommentary } from '@/lib/analyzer';
import { getScores, saveScores, addCommentary } from '@/lib/storage';
import { TeamScore } from '@/lib/rubric';
import repos from '@/data/repos.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for analysis

interface Team {
  id: string;
  name: string;
  repo: string;
  track: number;
}

export async function GET(request: Request) {
  // Verify cron secret for production
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development without secret
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return handleRefresh();
}

export async function POST() {
  return handleRefresh();
}

async function handleRefresh() {
  try {
    const teams = repos.teams as Team[];
    const previousScores = await getScores();

    // Analyze all repos in parallel (with some batching to avoid rate limits)
    const batchSize = 5;
    const newScores: TeamScore[] = [];

    for (let i = 0; i < teams.length; i += batchSize) {
      const batch = teams.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(team =>
          analyzeRepo(team.id, team.name, team.repo, team.track)
        )
      );
      newScores.push(...batchResults);
    }

    // Save the new scores
    await saveScores(newScores);

    // Check for significant events and generate commentary
    for (const newScore of newScores) {
      const oldScore = previousScores.find(s => s.teamId === newScore.teamId);

      // Check for rank changes
      if (oldScore?.currentRank && newScore.currentRank) {
        if (newScore.currentRank < oldScore.currentRank) {
          const commentary = await generateHypeCommentary('rank_change', newScore.teamName, {
            oldRank: oldScore.currentRank,
            newRank: newScore.currentRank
          });
          await addCommentary(commentary);
        }
      }

      // Check for score changes
      if (oldScore && oldScore.total !== newScore.total && newScore.total > 0) {
        const commentary = await generateHypeCommentary('score_update', newScore.teamName, {
          score: newScore.total
        });
        await addCommentary(commentary);
      }

      // Add team's own commentary
      if (newScore.commentary && newScore.total > 0) {
        await addCommentary(newScore.commentary);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${newScores.length} team scores`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during refresh:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh scores' },
      { status: 500 }
    );
  }
}
