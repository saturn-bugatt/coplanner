import Anthropic from '@anthropic-ai/sdk';
import { getRubricPrompt, TeamScore } from './rubric';
import { RepoInfo, fetchRepoInfo, estimateLinesOfCode } from './github';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

interface ScoreResult {
  problem: number;
  solution: number;
  execution: number;
  total: number;
  commentary: string;
}

export async function analyzeRepo(
  teamId: string,
  teamName: string,
  repoUrl: string,
  track: number
): Promise<TeamScore> {
  // Fetch repo information
  let repoInfo: RepoInfo;
  try {
    repoInfo = await fetchRepoInfo(repoUrl);
  } catch (error) {
    console.error(`Failed to fetch repo info for ${teamName}:`, error);
    // Return placeholder scores if repo fetch fails
    return createPlaceholderScore(teamId, teamName, repoUrl, track);
  }

  // Estimate lines of code
  const linesOfCode = estimateLinesOfCode(repoInfo.fileTree, repoInfo.totalSize);

  // Get AI scores
  let scores: ScoreResult;
  try {
    scores = await getAIScores(teamName, repoInfo, track);
  } catch (error) {
    console.error(`Failed to get AI scores for ${teamName}:`, error);
    scores = {
      problem: 3,
      solution: 3,
      execution: 3,
      total: 9,
      commentary: `${teamName} is cooking something interesting! Stay tuned for more analysis.`
    };
  }

  return {
    teamId,
    teamName,
    repo: repoUrl,
    track,
    problem: scores.problem,
    solution: scores.solution,
    execution: scores.execution,
    total: scores.total,
    linesOfCode,
    commentary: scores.commentary,
    lastUpdated: new Date().toISOString()
  };
}

function createPlaceholderScore(
  teamId: string,
  teamName: string,
  repoUrl: string,
  track: number
): TeamScore {
  return {
    teamId,
    teamName,
    repo: repoUrl,
    track,
    problem: 0,
    solution: 0,
    execution: 0,
    total: 0,
    linesOfCode: 0,
    commentary: `Waiting for ${teamName} to push their first commit!`,
    lastUpdated: new Date().toISOString()
  };
}

async function getAIScores(
  teamName: string,
  repoInfo: RepoInfo,
  track: number
): Promise<ScoreResult> {
  const rubricPrompt = getRubricPrompt(track);

  const prompt = `You are CoPlanner, a charismatic hackathon judge and hype announcer for Saturn's hackathon. Your job is to score projects fairly but also generate excitement!

${rubricPrompt}

REPO DATA FOR "${teamName}":

README:
${repoInfo.readme || '[No README found]'}

FILE STRUCTURE:
${repoInfo.fileTree.slice(0, 50).join('\n') || '[Empty repository]'}
${repoInfo.fileTree.length > 50 ? `\n... and ${repoInfo.fileTree.length - 50} more files` : ''}

KEY SOURCE FILES:
${repoInfo.keyFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n') || '[No key files found]'}

RECENT COMMITS:
${repoInfo.recentCommits.join('\n') || '[No commits yet]'}

---

Based on the rubric, score this project. Be fair but also look for the potential and excitement in what they're building!

Respond in this EXACT JSON format (no markdown, just raw JSON):
{
  "problem": <1-5>,
  "problem_reason": "<brief reason>",
  "solution": <1-5>,
  "solution_reason": "<brief reason>",
  "execution": <1-5>,
  "execution_reason": "<brief reason>",
  "commentary": "<ONE energetic hype sentence as an announcer, mentioning the team name>"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  // Extract text content from response
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    problem: Math.min(5, Math.max(1, parsed.problem || 3)),
    solution: Math.min(5, Math.max(1, parsed.solution || 3)),
    execution: Math.min(5, Math.max(1, parsed.execution || 3)),
    total: (parsed.problem || 3) + (parsed.solution || 3) + (parsed.execution || 3),
    commentary: parsed.commentary || `${teamName} is making moves!`
  };
}

export async function generateHypeCommentary(
  event: 'rank_change' | 'score_update' | 'new_commits' | 'general',
  teamName: string,
  details?: { oldRank?: number; newRank?: number; commits?: number; score?: number }
): Promise<string> {
  const prompts: Record<string, string> = {
    rank_change: `Team "${teamName}" just moved from rank ${details?.oldRank} to rank ${details?.newRank}!`,
    score_update: `Team "${teamName}" just updated their project and their score changed!`,
    new_commits: `Team "${teamName}" just pushed ${details?.commits} new commits!`,
    general: `Give an exciting update about the hackathon in general.`
  };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `You are CoPlanner, an energetic hackathon announcer. Generate ONE short, exciting announcement (max 15 words) about: ${prompts[event]}. Be cheeky and fun! No quotes around the response.`
        }
      ]
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (textContent && textContent.type === 'text') {
      return textContent.text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    console.error('Failed to generate commentary:', error);
  }

  // Fallback commentary
  const fallbacks = [
    `${teamName} is ON FIRE right now!`,
    `The competition is heating up!`,
    `Something big is brewing at ${teamName}!`,
    `Keep your eyes on ${teamName}!`
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
