import { NextResponse } from 'next/server';
import { analyzeRepo } from '@/lib/analyzer';
import { updateScore } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LOG_PREFIX = '[API/analyze]';

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`${LOG_PREFIX} [${requestId}] Request received - POST /api/analyze`);

  let body: any;

  try {
    // Parse and validate request body
    console.log(`${LOG_PREFIX} [${requestId}] Parsing request body`);
    try {
      body = await request.json();
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      console.error(`${LOG_PREFIX} [${requestId}] Failed to parse request body:`, errorMessage);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
          details: errorMessage
        },
        { status: 400 }
      );
    }

    console.log(`${LOG_PREFIX} [${requestId}] Request body received:`, {
      teamId: body?.teamId,
      teamName: body?.teamName,
      repo: body?.repo,
      track: body?.track
    });

    const { teamId, teamName, repo, track } = body;

    // Validate required fields
    const missingFields: string[] = [];
    if (!teamId) missingFields.push('teamId');
    if (!teamName) missingFields.push('teamName');
    if (!repo) missingFields.push('repo');
    if (!track) missingFields.push('track');

    if (missingFields.length > 0) {
      console.warn(`${LOG_PREFIX} [${requestId}] Missing required fields:`, missingFields);
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          details: `Missing: ${missingFields.join(', ')}`,
          requiredFields: ['teamId', 'teamName', 'repo', 'track']
        },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof teamId !== 'string') {
      console.warn(`${LOG_PREFIX} [${requestId}] Invalid teamId type: expected string, got ${typeof teamId}`);
      return NextResponse.json(
        { success: false, error: 'Invalid field type', details: 'teamId must be a string' },
        { status: 400 }
      );
    }
    if (typeof teamName !== 'string') {
      console.warn(`${LOG_PREFIX} [${requestId}] Invalid teamName type: expected string, got ${typeof teamName}`);
      return NextResponse.json(
        { success: false, error: 'Invalid field type', details: 'teamName must be a string' },
        { status: 400 }
      );
    }
    if (typeof repo !== 'string') {
      console.warn(`${LOG_PREFIX} [${requestId}] Invalid repo type: expected string, got ${typeof repo}`);
      return NextResponse.json(
        { success: false, error: 'Invalid field type', details: 'repo must be a string' },
        { status: 400 }
      );
    }
    if (typeof track !== 'number') {
      console.warn(`${LOG_PREFIX} [${requestId}] Invalid track type: expected number, got ${typeof track}`);
      return NextResponse.json(
        { success: false, error: 'Invalid field type', details: 'track must be a number' },
        { status: 400 }
      );
    }

    // Validate repo URL format (basic check)
    if (!repo.includes('github.com')) {
      console.warn(`${LOG_PREFIX} [${requestId}] Invalid repo URL format: ${repo}`);
      return NextResponse.json(
        { success: false, error: 'Invalid repo URL', details: 'repo must be a valid GitHub URL' },
        { status: 400 }
      );
    }

    console.log(`${LOG_PREFIX} [${requestId}] Validation passed - starting analysis`);
    console.log(`${LOG_PREFIX} [${requestId}] Analysis parameters:`, { teamId, teamName, repo, track });

    const analysisStartTime = Date.now();

    let score;
    try {
      console.log(`${LOG_PREFIX} [${requestId}] Calling analyzeRepo for ${teamName}`);
      score = await analyzeRepo(teamId, teamName, repo, track);
      const analysisDuration = Date.now() - analysisStartTime;
      console.log(`${LOG_PREFIX} [${requestId}] Analysis completed in ${analysisDuration}ms`);
      console.log(`${LOG_PREFIX} [${requestId}] Analysis results:`, {
        teamId: score.teamId,
        teamName: score.teamName,
        total: score.total,
        problem: score.problem,
        solution: score.solution,
        execution: score.execution,
        hasCommentary: !!score.commentary
      });
    } catch (analyzeError) {
      const errorMessage = analyzeError instanceof Error ? analyzeError.message : 'Unknown error';
      const errorStack = analyzeError instanceof Error ? analyzeError.stack : undefined;
      const analysisDuration = Date.now() - analysisStartTime;

      console.error(`${LOG_PREFIX} [${requestId}] Analysis failed after ${analysisDuration}ms:`, {
        message: errorMessage,
        stack: errorStack,
        type: analyzeError?.constructor?.name
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Repository analysis failed',
          details: errorMessage,
          duration: analysisDuration
        },
        { status: 500 }
      );
    }

    // Save the score
    console.log(`${LOG_PREFIX} [${requestId}] Saving score to database`);
    try {
      await updateScore(score);
      console.log(`${LOG_PREFIX} [${requestId}] Score saved successfully`);
    } catch (saveError) {
      const errorMessage = saveError instanceof Error ? saveError.message : 'Unknown error';
      console.error(`${LOG_PREFIX} [${requestId}] Failed to save score:`, errorMessage);

      // Return partial success - analysis worked but save failed
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save analysis results',
          details: errorMessage,
          data: score // Include the score even though save failed
        },
        { status: 500 }
      );
    }

    const totalDuration = Date.now() - analysisStartTime;
    console.log(`${LOG_PREFIX} [${requestId}] Request completed successfully in ${totalDuration}ms`);
    console.log(`${LOG_PREFIX} [${requestId}] Final score for ${teamName}: ${score.total}`);

    return NextResponse.json({
      success: true,
      data: score,
      duration: totalDuration
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`${LOG_PREFIX} [${requestId}] Unhandled exception:`, {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
      body: body
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze repository',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
