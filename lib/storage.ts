import { TeamScore } from './rubric';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

// Namespace for generating consistent UUIDs from team names
const TEAM_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Generate a consistent UUID from team ID string
function teamIdToUUID(teamId: string): string {
  return uuidv5(teamId, TEAM_UUID_NAMESPACE);
}

// Initialize Supabase client with service role key for write operations
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory cache for commentary
let cachedCommentary: { message: string; timestamp: string }[] = [];

export async function getScores(): Promise<TeamScore[]> {
  const { data: scores, error } = await supabase
    .from('scores')
    .select('*')
    .order('total', { ascending: false });

  if (error) {
    console.error('Error fetching scores from Supabase:', error);
    return [];
  }

  // Map database fields to TeamScore interface
  return (scores || []).map((s, index) => ({
    teamId: s.id,
    teamName: s.team_name,
    repo: s.repo,
    track: s.track,
    problem: s.problem,
    solution: s.solution,
    execution: s.execution,
    total: s.total,
    linesOfCode: s.lines_of_code,
    commentary: s.commentary,
    lastUpdated: s.last_updated,
    currentRank: index + 1,
  }));
}

export async function saveScores(scores: TeamScore[]): Promise<void> {
  // Calculate ranks
  const sortedScores = [...scores].sort((a, b) => b.total - a.total);

  console.log(`[Storage] Saving ${sortedScores.length} scores to Supabase`);

  for (let i = 0; i < sortedScores.length; i++) {
    const score = sortedScores[i];
    score.currentRank = i + 1;

    const payload = {
      id: teamIdToUUID(score.teamId),
      team_name: score.teamName,
      repo: score.repo,
      track: score.track,
      problem: score.problem,
      solution: score.solution,
      execution: score.execution,
      total: score.total,
      lines_of_code: score.linesOfCode,
      commentary: score.commentary,
      last_updated: score.lastUpdated || new Date().toISOString(),
    };

    console.log(`[Storage] Upserting score for ${score.teamName} (id: ${score.teamId})`);

    const { data, error } = await supabase
      .from('scores')
      .upsert(payload, {
        onConflict: 'id'
      })
      .select();

    if (error) {
      console.error(`[Storage] Error saving score for ${score.teamName}:`, JSON.stringify(error));
    } else {
      console.log(`[Storage] Successfully saved score for ${score.teamName}:`, data);
    }
  }
}

export async function updateScore(score: TeamScore): Promise<void> {
  const { error } = await supabase
    .from('scores')
    .upsert({
      id: teamIdToUUID(score.teamId),
      team_name: score.teamName,
      repo: score.repo,
      track: score.track,
      problem: score.problem,
      solution: score.solution,
      execution: score.execution,
      total: score.total,
      lines_of_code: score.linesOfCode,
      commentary: score.commentary,
      last_updated: score.lastUpdated || new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

  if (error) {
    console.error(`Error updating score for ${score.teamName}:`, error);
    throw error;
  }
}

export async function getCommentary(limit: number = 10): Promise<{ message: string; timestamp: string }[]> {
  return cachedCommentary.slice(0, limit);
}

export async function addCommentary(message: string): Promise<void> {
  const entry = {
    message,
    timestamp: new Date().toISOString()
  };

  cachedCommentary.unshift(entry);
  // Keep only last 50 entries
  if (cachedCommentary.length > 50) {
    cachedCommentary = cachedCommentary.slice(0, 50);
  }
}

export async function clearCache(): Promise<void> {
  cachedCommentary = [];
}
