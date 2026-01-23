/**
 * Local Analysis Script
 *
 * Run this every 10 minutes to analyze all repos and update Supabase.
 *
 * Usage: npx tsx scripts/analyze.ts
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Load teams config
const teamsConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data/repos.json'), 'utf-8')
);

interface Team {
  id: string;
  name: string;
  repo: string;
  track: number;
}

interface RepoData {
  readme: string;
  fileTree: string[];
  keyFiles: { path: string; content: string }[];
  recentCommits: { message: string; author: string; date: string; branch: string }[];
  branches: string[];
  totalFiles: number;
  languages: Record<string, number>;
}

// GitHub API helper
async function fetchGitHub(endpoint: string): Promise<Response> {
  return fetch(`https://api.github.com${endpoint}`, {
    headers: {
      'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CoPlanner-Analyzer'
    }
  });
}

// Parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// Fetch complete repo data
async function fetchRepoData(repoUrl: string): Promise<RepoData> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const base = `/repos/${owner}/${repo}`;

  console.log(`   📂 Fetching ${owner}/${repo}...`);

  // Get repo info
  const repoRes = await fetchGitHub(base);
  const repoInfo = await repoRes.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  // Fetch in parallel
  const [branchesRes, readmeRes, treeRes, languagesRes] = await Promise.all([
    fetchGitHub(`${base}/branches?per_page=100`),
    fetchGitHub(`${base}/readme`),
    fetchGitHub(`${base}/git/trees/${defaultBranch}?recursive=1`),
    fetchGitHub(`${base}/languages`)
  ]);

  // Parse branches
  const branches: string[] = [];
  if (branchesRes.ok) {
    const branchesData = await branchesRes.json();
    branches.push(...branchesData.map((b: { name: string }) => b.name));
  }

  // Parse README
  let readme = '';
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
  }

  // Parse file tree
  let fileTree: string[] = [];
  if (treeRes.ok) {
    const treeData = await treeRes.json();
    fileTree = treeData.tree
      ?.filter((item: { type: string }) => item.type === 'blob')
      ?.map((item: { path: string }) => item.path) || [];
  }

  // Parse languages
  let languages: Record<string, number> = {};
  if (languagesRes.ok) {
    languages = await languagesRes.json();
  }

  // Fetch commits from all branches (up to 5 branches, 10 commits each)
  const recentCommits: { message: string; author: string; date: string; branch: string }[] = [];
  for (const branch of branches.slice(0, 5)) {
    const commitsRes = await fetchGitHub(`${base}/commits?sha=${branch}&per_page=10`);
    if (commitsRes.ok) {
      const commitsData = await commitsRes.json();
      for (const c of commitsData) {
        recentCommits.push({
          message: c.commit.message.split('\n')[0],
          author: c.commit.author?.name || 'Unknown',
          date: c.commit.author?.date || '',
          branch
        });
      }
    }
  }

  // Sort commits by date and dedupe
  const uniqueCommits = Array.from(
    new Map(recentCommits.map(c => [c.message + c.date, c])).values()
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  // Fetch key source files
  const keyFilePatterns = [
    /^README\.md$/i,
    /^src\/(index|app|main)\.(ts|tsx|js|jsx)$/,
    /^app\/(page|layout)\.(ts|tsx|js|jsx)$/,
    /^(index|main|app)\.(ts|tsx|js|jsx|py)$/,
    /package\.json$/,
    /requirements\.txt$/,
  ];

  const keyFilePaths = fileTree
    .filter(p => keyFilePatterns.some(pattern => pattern.test(p)))
    .slice(0, 6);

  const keyFiles: { path: string; content: string }[] = [];
  for (const filePath of keyFilePaths) {
    const fileRes = await fetchGitHub(`${base}/contents/${filePath}?ref=${defaultBranch}`);
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      if (fileData.content) {
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        keyFiles.push({
          path: filePath,
          content: content.slice(0, 4000) + (content.length > 4000 ? '\n...[truncated]' : '')
        });
      }
    }
  }

  return {
    readme,
    fileTree,
    keyFiles,
    recentCommits: uniqueCommits,
    branches,
    totalFiles: fileTree.length,
    languages
  };
}

// Judging rubric
const RUBRIC = {
  track1: {
    name: "High-Stakes Financial Decisions",
    criteria: `
PROBLEM (1-5): How significant is the financial problem?
- 1: Vague or trivial
- 3: Clear problem affecting many people
- 5: Critical, widespread problem with major financial consequences

SOLUTION (1-5): How innovative is the solution?
- 1: Unclear or doesn't address problem
- 3: Solid solution with some novel elements
- 5: Breakthrough solution that could transform the space

EXECUTION (1-5): How well implemented?
- 1: Minimal or non-functional
- 3: Working prototype with core features
- 5: Production-ready with exceptional attention to detail`
  },
  track2: {
    name: "Underserved Problems",
    criteria: `
PROBLEM (1-5): How underserved is this problem?
- 1: Not truly underserved
- 3: Genuinely overlooked with clear definition
- 5: Critical underserved need with massive potential impact

SOLUTION (1-5): How well does it serve the target community?
- 1: Doesn't fit community needs
- 3: Shows understanding of the community
- 5: Deeply empathetic with community input

EXECUTION (1-5): How accessible and well-implemented?
- 1: Creates new barriers
- 3: Functional with reasonable accessibility
- 5: Exceptional implementation prioritizing inclusivity`
  }
};

// Analyze repo with Claude
async function analyzeWithClaude(team: Team, repoData: RepoData): Promise<{
  problem: number;
  solution: number;
  execution: number;
  total: number;
  commentary: string;
  lines_of_code: number;
}> {
  const track = team.track === 1 ? RUBRIC.track1 : RUBRIC.track2;

  // Estimate lines of code
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c'];
  const codeFiles = repoData.fileTree.filter(p => codeExtensions.some(ext => p.endsWith(ext)));
  const totalBytes = Object.values(repoData.languages).reduce((a, b) => a + b, 0);
  const linesOfCode = Math.max(Math.round(totalBytes / 30), codeFiles.length * 50);

  const prompt = `You are a hackathon judge analyzing a project for "${track.name}".

${track.criteria}

---

TEAM: ${team.name}
REPO: ${team.repo}

README:
${repoData.readme || '[No README]'}

FILE STRUCTURE (${repoData.totalFiles} files):
${repoData.fileTree.slice(0, 40).join('\n')}
${repoData.fileTree.length > 40 ? `\n... and ${repoData.fileTree.length - 40} more files` : ''}

LANGUAGES: ${Object.entries(repoData.languages).map(([k, v]) => `${k}: ${v} bytes`).join(', ') || 'Unknown'}

KEY SOURCE FILES:
${repoData.keyFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n') || '[No key files found]'}

RECENT COMMITS (across ${repoData.branches.length} branches):
${repoData.recentCommits.slice(0, 15).map(c => `[${c.branch}] ${c.author}: ${c.message}`).join('\n') || '[No commits]'}

---

Score this project fairly. Look for potential and excitement in what they're building!

Respond in this EXACT JSON format (no markdown, just raw JSON):
{
  "problem": <1-5>,
  "problem_reason": "<brief reason>",
  "solution": <1-5>,
  "solution_reason": "<brief reason>",
  "execution": <1-5>,
  "execution_reason": "<brief reason>",
  "commentary": "<ONE energetic hype sentence about this team, mentioning their name>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    const problem = Math.min(5, Math.max(1, parsed.problem || 3));
    const solution = Math.min(5, Math.max(1, parsed.solution || 3));
    const execution = Math.min(5, Math.max(1, parsed.execution || 3));

    return {
      problem,
      solution,
      execution,
      total: problem + solution + execution,
      commentary: parsed.commentary || `${team.name} is making moves!`,
      lines_of_code: linesOfCode
    };
  } catch (error) {
    console.error(`   ⚠️ Claude error for ${team.name}:`, error);
    return {
      problem: 3,
      solution: 3,
      execution: 3,
      total: 9,
      commentary: `${team.name} is cooking something interesting!`,
      lines_of_code: linesOfCode
    };
  }
}

// Main function
async function main() {
  console.log('🚀 Starting analysis...\n');
  console.log(`📋 Found ${teamsConfig.teams.length} teams to analyze\n`);

  const teams = teamsConfig.teams as Team[];
  const results: any[] = [];

  for (const team of teams) {
    console.log(`\n🔍 Analyzing: ${team.name}`);

    try {
      // Fetch repo data
      const repoData = await fetchRepoData(team.repo);
      console.log(`   📊 ${repoData.totalFiles} files, ${repoData.branches.length} branches, ${repoData.recentCommits.length} commits`);

      // Analyze with Claude
      console.log(`   🤖 Running Claude analysis...`);
      const scores = await analyzeWithClaude(team, repoData);
      console.log(`   ✅ Score: ${scores.total}/15 (P:${scores.problem} S:${scores.solution} E:${scores.execution})`);
      console.log(`   💬 "${scores.commentary}"`);

      results.push({
        id: team.id,
        team_name: team.name,
        repo: team.repo,
        track: team.track,
        problem: scores.problem,
        solution: scores.solution,
        execution: scores.execution,
        total: scores.total,
        lines_of_code: scores.lines_of_code,
        commentary: scores.commentary,
        last_updated: new Date().toISOString()
      });

    } catch (error) {
      console.error(`   ❌ Error analyzing ${team.name}:`, error);
      results.push({
        id: team.id,
        team_name: team.name,
        repo: team.repo,
        track: team.track,
        problem: 0,
        solution: 0,
        execution: 0,
        total: 0,
        lines_of_code: 0,
        commentary: `Waiting for ${team.name} to push code!`,
        last_updated: new Date().toISOString()
      });
    }
  }

  // Push to Supabase
  console.log('\n📤 Pushing results to Supabase...');

  for (const result of results) {
    const { error } = await supabase
      .from('scores')
      .upsert(result, { onConflict: 'id' });

    if (error) {
      console.error(`   ❌ Failed to save ${result.team_name}:`, error);
    } else {
      console.log(`   ✅ Saved: ${result.team_name}`);
    }
  }

  console.log('\n✨ Analysis complete!\n');
}

main().catch(console.error);
