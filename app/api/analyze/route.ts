import { NextResponse } from 'next/server';
import { analyzeRepo } from '@/lib/analyzer';
import { updateScore } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamId, teamName, repo, track } = body;

    if (!teamId || !teamName || !repo || !track) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: teamId, teamName, repo, track' },
        { status: 400 }
      );
    }

    const score = await analyzeRepo(teamId, teamName, repo, track);
    await updateScore(score);

    return NextResponse.json({
      success: true,
      data: score
    });
  } catch (error) {
    console.error('Error analyzing repo:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze repository' },
      { status: 500 }
    );
  }
}
