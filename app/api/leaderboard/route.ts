import { NextResponse } from 'next/server';
import { getScores, getCommentary } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [scores, commentary] = await Promise.all([
      getScores(),
      getCommentary(5)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        scores,
        commentary,
        lastRefresh: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
