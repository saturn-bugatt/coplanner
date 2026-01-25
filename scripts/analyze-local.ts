/**
 * Local Analysis Script - saves to .data/scores.json
 *
 * This version uses comparative analysis across all teams with:
 * - Critical evaluation with pros/cons
 * - Decimal scores (e.g., 4.5)
 * - Suggestions for improvement
 * - Relative comparison between teams
 *
 * Usage: npx tsx scripts/analyze-local.ts [teamId1] [teamId2] ...
 * If no team IDs provided, analyzes all teams
 */

import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Load teams config
const teamsConfig = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data/repos.json'), 'utf-8')
);

const scoresPath = path.join(process.cwd(), '.data/scores.json');

interface Team {
  id: string;
  name: string;
  repo: string;
  track: number;
  twitter?: string[];
  members?: string[];
  image?: string;
}

interface RepoData {
  team: Team;
  readme: string;
  fileTree: string[];
  keyFiles: { path: string; content: string }[];
  recentCommits: { message: string; author: string; date: string; branch: string }[];
  branches: string[];
  totalFiles: number;
  languages: Record<string, number>;
  linesOfCode: number;
}

interface LocalScore {
  teamId: string;
  teamName: string;
  repo: string;
  track: number;
  problem: number;
  solution: number;
  execution: number;
  total: number;
  linesOfCode: number;
  commentary: string;
  pros: string[];
  cons: string[];
  suggestions: string[];
  lastUpdated: string;
  analysisMethod: string;
  twitter?: string[];
  members?: string[];
  image?: string;
}

// GitHub API helper
async function fetchGitHub(endpoint: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CoPlanner-Analyzer'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  return fetch(`https://api.github.com${endpoint}`, { headers });
}

// Parse GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// Fetch complete repo data
async function fetchRepoData(team: Team): Promise<RepoData | null> {
  const { owner, repo } = parseGitHubUrl(team.repo);
  const base = `/repos/${owner}/${repo}`;

  console.log(`   📂 Fetching ${owner}/${repo}...`);

  try {
    // Get repo info
    const repoRes = await fetchGitHub(base);
    if (!repoRes.ok) {
      throw new Error(`Failed to fetch repo: ${repoRes.status}`);
    }
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

    // Fetch commits from default branch
    const recentCommits: { message: string; author: string; date: string; branch: string }[] = [];
    const commitsRes = await fetchGitHub(`${base}/commits?sha=${defaultBranch}&per_page=15`);
    if (commitsRes.ok) {
      const commitsData = await commitsRes.json();
      for (const c of commitsData) {
        recentCommits.push({
          message: c.commit.message.split('\n')[0],
          author: c.commit.author?.name || 'Unknown',
          date: c.commit.author?.date || '',
          branch: defaultBranch
        });
      }
    }

    // Fetch key source files (more comprehensive)
    const keyFilePatterns = [
      /^README\.md$/i,
      /^src\/(index|app|main|server)\.(ts|tsx|js|jsx)$/,
      /^app\/(page|layout|api)\.(ts|tsx|js|jsx)$/,
      /^(index|main|app|server)\.(ts|tsx|js|jsx|py)$/,
      /package\.json$/,
      /requirements\.txt$/,
      /\.env\.example$/,
      /docker-compose\.ya?ml$/,
    ];

    const keyFilePaths = fileTree
      .filter(p => keyFilePatterns.some(pattern => pattern.test(p)))
      .slice(0, 8);

    const keyFiles: { path: string; content: string }[] = [];
    for (const filePath of keyFilePaths) {
      const fileRes = await fetchGitHub(`${base}/contents/${filePath}?ref=${defaultBranch}`);
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData.content) {
          const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
          keyFiles.push({
            path: filePath,
            content: content.slice(0, 5000) + (content.length > 5000 ? '\n...[truncated]' : '')
          });
        }
      }
    }

    // Estimate lines of code
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.cpp', '.c'];
    const codeFiles = fileTree.filter(p => codeExtensions.some(ext => p.endsWith(ext)));
    const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
    const linesOfCode = Math.max(Math.round(totalBytes / 30), codeFiles.length * 50);

    return {
      team,
      readme,
      fileTree,
      keyFiles,
      recentCommits,
      branches,
      totalFiles: fileTree.length,
      languages,
      linesOfCode
    };
  } catch (error) {
    console.error(`   ❌ Error fetching ${team.name}:`, error);
    return null;
  }
}

// Judging rubric - more detailed and critical
const RUBRIC = {
  track1: {
    name: "High-Stakes Financial Decisions",
    goal: "Build tools that help people make better high-stakes financial decisions with confidence and clarity.",
    criteria: `
PROBLEM (1.0-5.0, use decimals like 3.5, 4.2):
- 1.0-2.0: Vague, trivial, or already well-solved by existing tools
- 2.5-3.5: Clear problem affecting some people, but limited scope or impact
- 4.0-4.5: Significant problem with real financial consequences for many
- 5.0: Critical, widespread problem that desperately needs solving

SOLUTION (1.0-5.0, use decimals):
- 1.0-2.0: Unclear approach, doesn't actually solve the stated problem, or copycat
- 2.5-3.5: Workable solution but lacks innovation or differentiation
- 4.0-4.5: Clever approach with novel elements that could genuinely help
- 5.0: Breakthrough innovation that could transform how people handle finances

EXECUTION (1.0-5.0, use decimals):
- 1.0-2.0: Minimal code, non-functional, or very rough prototype
- 2.5-3.5: Working prototype but missing key features or polish
- 4.0-4.5: Solid implementation with good code quality and UX
- 5.0: Production-ready quality with exceptional attention to detail`
  },
  track2: {
    name: "Underserved Problems",
    goal: "Identify and solve problems that affect underserved communities or markets that big tech ignores.",
    criteria: `
PROBLEM (1.0-5.0, use decimals like 3.5, 4.2):
- 1.0-2.0: Not truly underserved, or problem is too niche to matter
- 2.5-3.5: Genuinely overlooked but limited in scope
- 4.0-4.5: Real underserved need affecting significant population
- 5.0: Critical gap that could improve many lives if solved

SOLUTION (1.0-5.0, use decimals):
- 1.0-2.0: Doesn't actually fit community needs or creates new problems
- 2.5-3.5: Shows basic understanding but misses important nuances
- 4.0-4.5: Demonstrates deep empathy and practical understanding
- 5.0: Solution developed with community input, perfectly tailored

EXECUTION (1.0-5.0, use decimals):
- 1.0-2.0: Creates accessibility barriers or ignores target users
- 2.5-3.5: Functional but could be more accessible/inclusive
- 4.0-4.5: Well-implemented with thoughtful accessibility
- 5.0: Exceptional focus on inclusivity and removing barriers`
  }
};

// Comparative analysis with Claude
async function analyzeAllTeams(repoDataList: RepoData[]): Promise<Map<string, {
  problem: number;
  solution: number;
  execution: number;
  total: number;
  commentary: string;
  pros: string[];
  cons: string[];
  suggestions: string[];
}>> {
  // Group by track for fair comparison
  const track1Teams = repoDataList.filter(r => r.team.track === 1);
  const track2Teams = repoDataList.filter(r => r.team.track === 2);

  const results = new Map();

  // Analyze each track separately for fair comparison
  if (track1Teams.length > 0) {
    console.log(`\n🏆 Analyzing Track 1: ${RUBRIC.track1.name} (${track1Teams.length} teams)`);
    const track1Results = await analyzeTrack(track1Teams, RUBRIC.track1);
    for (const [id, scores] of track1Results) {
      results.set(id, scores);
    }
  }

  if (track2Teams.length > 0) {
    console.log(`\n🏆 Analyzing Track 2: ${RUBRIC.track2.name} (${track2Teams.length} teams)`);
    const track2Results = await analyzeTrack(track2Teams, RUBRIC.track2);
    for (const [id, scores] of track2Results) {
      results.set(id, scores);
    }
  }

  return results;
}

async function analyzeTrack(teams: RepoData[], rubric: { name: string; goal: string; criteria: string }): Promise<Map<string, {
  problem: number;
  solution: number;
  execution: number;
  total: number;
  commentary: string;
  pros: string[];
  cons: string[];
  suggestions: string[];
}>> {
  // Build comprehensive prompt with all teams
  const teamsDescription = teams.map((data, idx) => `
=== TEAM ${idx + 1}: ${data.team.name} ===
REPO: ${data.team.repo}

README:
${data.readme.slice(0, 2000) || '[No README]'}
${data.readme.length > 2000 ? '\n...[truncated]' : ''}

FILE STRUCTURE (${data.totalFiles} files):
${data.fileTree.slice(0, 30).join('\n')}
${data.fileTree.length > 30 ? `\n... and ${data.fileTree.length - 30} more files` : ''}

LANGUAGES: ${Object.entries(data.languages).map(([k, v]) => `${k}: ${Math.round(v/1000)}kb`).join(', ') || 'Unknown'}

KEY SOURCE FILES:
${data.keyFiles.map(f => `--- ${f.path} ---\n${f.content.slice(0, 2500)}`).join('\n\n') || '[No key files found]'}

RECENT COMMITS:
${data.recentCommits.slice(0, 10).map(c => `${c.author}: ${c.message}`).join('\n') || '[No commits]'}
`).join('\n\n');

  const prompt = `You are a CRITICAL and RIGOROUS hackathon judge for "${rubric.name}".

TRACK GOAL: ${rubric.goal}

SCORING RUBRIC:
${rubric.criteria}

IMPORTANT JUDGING PRINCIPLES:
1. BE CRITICAL - Don't give everyone high scores. Differentiate between good and great.
2. USE THE FULL RANGE - Scores of 2.5, 3.0, 3.5 are perfectly valid. Not everyone deserves 4+.
3. COMPARE RELATIVELY - Consider how each team stacks up against the others in this track.
4. LOOK FOR SUBSTANCE - Fancy READMEs don't matter if the code doesn't deliver.
5. VALUE WORKING CODE - A simple working tool beats an ambitious broken one.
6. CHECK FOR REAL INNOVATION - Is this actually new or just a wrapper around existing APIs?
7. CONSIDER PRACTICALITY - Would real users actually use this? Is it solving a real problem?

---

${teamsDescription}

---

Now analyze ALL teams critically. For each team, provide:
1. Decimal scores (use values like 2.5, 3.2, 4.0, 4.7 - be precise!)
2. 2-3 specific PROS (what they did well)
3. 2-3 specific CONS (what's lacking or could be better)
4. 2-3 actionable SUGGESTIONS for improvement
5. A SHORT, punchy commentary (one sentence, be honest not just hype)

Consider relative performance - if one team clearly outperforms others, their scores should reflect that.

Respond ONLY with valid JSON (no markdown), in this exact format:
{
  "evaluations": [
    {
      "team_name": "<exact team name>",
      "problem": <1.0-5.0>,
      "solution": <1.0-5.0>,
      "execution": <1.0-5.0>,
      "pros": ["<specific pro 1>", "<specific pro 2>"],
      "cons": ["<specific con 1>", "<specific con 2>"],
      "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>"],
      "commentary": "<one honest, punchy sentence about this team>"
    }
  ],
  "ranking_rationale": "<brief explanation of how you ranked/differentiated the teams>"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`   📊 Ranking rationale: ${parsed.ranking_rationale}`);

    const results = new Map();

    for (const team of teams) {
      const evaluation = parsed.evaluations.find((e: any) =>
        e.team_name.toLowerCase() === team.team.name.toLowerCase()
      );

      if (evaluation) {
        // Round to 1 decimal place and clamp to valid range
        const problem = Math.round(Math.min(5, Math.max(1, evaluation.problem || 3)) * 10) / 10;
        const solution = Math.round(Math.min(5, Math.max(1, evaluation.solution || 3)) * 10) / 10;
        const execution = Math.round(Math.min(5, Math.max(1, evaluation.execution || 3)) * 10) / 10;
        const total = Math.round((problem + solution + execution) * 10) / 10;

        results.set(team.team.id, {
          problem,
          solution,
          execution,
          total,
          commentary: evaluation.commentary || `${team.team.name} submitted a project.`,
          pros: evaluation.pros || [],
          cons: evaluation.cons || [],
          suggestions: evaluation.suggestions || []
        });

        console.log(`   ✅ ${team.team.name}: ${total}/15.0 (P:${problem} S:${solution} E:${execution})`);
        console.log(`      Pros: ${(evaluation.pros || []).join(', ')}`);
        console.log(`      Cons: ${(evaluation.cons || []).join(', ')}`);
      } else {
        console.log(`   ⚠️ No evaluation found for ${team.team.name}, using defaults`);
        results.set(team.team.id, {
          problem: 3.0,
          solution: 3.0,
          execution: 3.0,
          total: 9.0,
          commentary: `${team.team.name} is building something.`,
          pros: ['Participated in hackathon'],
          cons: ['Could not fully evaluate'],
          suggestions: ['Continue developing the project']
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`   ⚠️ Claude error:`, error);

    // Return default scores for all teams
    const results = new Map();
    for (const team of teams) {
      results.set(team.team.id, {
        problem: 3.0,
        solution: 3.0,
        execution: 3.0,
        total: 9.0,
        commentary: `${team.team.name} is working on their project.`,
        pros: ['Submitted a project'],
        cons: ['Analysis error occurred'],
        suggestions: ['Keep building']
      });
    }
    return results;
  }
}

// Load existing scores
function loadScores(): LocalScore[] {
  try {
    if (fs.existsSync(scoresPath)) {
      return JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
    }
  } catch (e) {
    console.log('   Starting with empty scores');
  }
  return [];
}

// Save scores
function saveScores(scores: LocalScore[]): void {
  // Ensure .data directory exists
  const dataDir = path.dirname(scoresPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const teams = teamsConfig.teams as Team[];

  // Filter teams if specific IDs provided
  let teamsToAnalyze = teams;
  if (args.length > 0) {
    teamsToAnalyze = teams.filter(t => args.includes(t.id));
    if (teamsToAnalyze.length === 0) {
      console.log('No matching teams found. Available IDs:');
      teams.forEach(t => console.log(`  - ${t.id}`));
      return;
    }
  }

  console.log('🚀 Starting CRITICAL local analysis...\n');
  console.log(`📋 Analyzing ${teamsToAnalyze.length} teams with comparative scoring\n`);

  // Phase 1: Fetch all repo data
  console.log('📥 Phase 1: Fetching repository data...');
  const repoDataList: RepoData[] = [];

  for (const team of teamsToAnalyze) {
    console.log(`\n🔍 Fetching: ${team.name}`);
    const data = await fetchRepoData(team);
    if (data) {
      repoDataList.push(data);
      console.log(`   📊 ${data.totalFiles} files, ${data.linesOfCode} estimated LOC`);
    }
  }

  if (repoDataList.length === 0) {
    console.log('\n❌ No repositories could be fetched. Exiting.');
    return;
  }

  // Phase 2: Comparative analysis with Claude
  console.log('\n\n🤖 Phase 2: Comparative analysis with Claude...');
  const analysisResults = await analyzeAllTeams(repoDataList);

  // Phase 3: Build and save results
  console.log('\n\n📤 Phase 3: Saving results...');

  const existingScores = loadScores();
  const results: LocalScore[] = [...existingScores];

  for (const data of repoDataList) {
    const analysis = analysisResults.get(data.team.id);
    if (!analysis) continue;

    const newScore: LocalScore = {
      teamId: data.team.id,
      teamName: data.team.name,
      repo: data.team.repo,
      track: data.team.track,
      problem: analysis.problem,
      solution: analysis.solution,
      execution: analysis.execution,
      total: analysis.total,
      linesOfCode: data.linesOfCode,
      commentary: analysis.commentary,
      pros: analysis.pros,
      cons: analysis.cons,
      suggestions: analysis.suggestions,
      lastUpdated: new Date().toISOString(),
      analysisMethod: 'local-critical',
      twitter: data.team.twitter,
      members: data.team.members,
      image: data.team.image
    };

    // Update or add score
    const existingIndex = results.findIndex(s => s.teamId === data.team.id);
    if (existingIndex >= 0) {
      results[existingIndex] = newScore;
    } else {
      results.push(newScore);
    }
  }

  // Handle teams that couldn't be fetched
  for (const team of teamsToAnalyze) {
    if (!repoDataList.find(d => d.team.id === team.id)) {
      const newScore: LocalScore = {
        teamId: team.id,
        teamName: team.name,
        repo: team.repo,
        track: team.track,
        problem: 0,
        solution: 0,
        execution: 0,
        total: 0,
        linesOfCode: 0,
        commentary: `Waiting for ${team.name} to push code!`,
        pros: [],
        cons: ['Repository not accessible'],
        suggestions: ['Make repository public', 'Push initial code'],
        lastUpdated: new Date().toISOString(),
        analysisMethod: 'local-critical',
        twitter: team.twitter,
        members: team.members,
        image: team.image
      };

      const existingIndex = results.findIndex(s => s.teamId === team.id);
      if (existingIndex >= 0) {
        results[existingIndex] = newScore;
      } else {
        results.push(newScore);
      }
    }
  }

  // Sort by total score
  results.sort((a, b) => b.total - a.total);

  saveScores(results);

  console.log('\n✨ Critical analysis complete!\n');
  console.log('Results saved to .data/scores.json');

  // Print summary
  console.log('\n📊 Final Rankings:');
  results.forEach((r, idx) => {
    if (r.total > 0) {
      console.log(`   ${idx + 1}. ${r.teamName}: ${r.total}/15.0`);
    }
  });
}

main().catch(console.error);
