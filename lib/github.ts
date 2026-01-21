export interface RepoInfo {
  readme: string;
  fileTree: string[];
  keyFiles: { path: string; content: string }[];
  recentCommits: string[];
  totalSize: number;
  branches: string[];
  activeBranches: { name: string; lastCommit: string; commitCount: number }[];
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

async function fetchWithAuth(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CoPlanner-Hackathon-Bot'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  return fetch(url, { headers, next: { revalidate: 60 } });
}

export async function fetchRepoInfo(repoUrl: string): Promise<RepoInfo> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // First, get repo info to find default branch
  const repoRes = await fetchWithAuth(baseUrl);
  let defaultBranch = 'main';
  let totalSize = 0;

  if (repoRes.ok) {
    const repoData = await repoRes.json();
    defaultBranch = repoData.default_branch || 'main';
    totalSize = (repoData.size || 0) * 1024; // Convert KB to bytes
  }

  // Fetch all branches
  const branchesRes = await fetchWithAuth(`${baseUrl}/branches?per_page=100`);
  let branches: string[] = [];
  let activeBranches: { name: string; lastCommit: string; commitCount: number }[] = [];

  if (branchesRes.ok) {
    const branchesData = await branchesRes.json();
    branches = branchesData.map((b: { name: string }) => b.name);

    // Get activity info for each branch (limit to 10 most recent)
    const branchPromises = branchesData.slice(0, 10).map(async (branch: { name: string; commit: { sha: string } }) => {
      try {
        const commitsRes = await fetchWithAuth(
          `${baseUrl}/commits?sha=${branch.name}&per_page=1`
        );
        if (commitsRes.ok) {
          const commits = await commitsRes.json();
          const linkHeader = commitsRes.headers.get('link');
          // Parse commit count from link header if available
          let commitCount = 1;
          if (linkHeader) {
            const match = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (match) commitCount = parseInt(match[1], 10);
          }
          return {
            name: branch.name,
            lastCommit: commits[0]?.commit?.message?.split('\n')[0] || 'No commits',
            commitCount
          };
        }
      } catch {
        // Skip branches that fail
      }
      return { name: branch.name, lastCommit: 'Unknown', commitCount: 0 };
    });

    activeBranches = await Promise.all(branchPromises);
  }

  // Fetch multiple things in parallel using default branch
  const [readmeRes, treeRes, commitsRes] = await Promise.all([
    fetchWithAuth(`${baseUrl}/readme`),
    fetchWithAuth(`${baseUrl}/git/trees/${defaultBranch}?recursive=1`),
    fetchAllBranchCommits(baseUrl, branches.slice(0, 5)) // Get commits from up to 5 branches
  ]);

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

    // Calculate total size from tree
    const treeSize = treeData.tree
      ?.filter((item: { type: string; size?: number }) => item.type === 'blob')
      ?.reduce((acc: number, item: { size?: number }) => acc + (item.size || 0), 0) || 0;

    if (treeSize > 0) totalSize = treeSize;
  }

  // Fetch key source files (detect entry points)
  const keyFiles = await fetchKeyFiles(owner, repo, fileTree, defaultBranch);

  return {
    readme,
    fileTree,
    keyFiles,
    recentCommits: commitsRes,
    totalSize,
    branches,
    activeBranches
  };
}

async function fetchAllBranchCommits(baseUrl: string, branches: string[]): Promise<string[]> {
  const allCommits: { message: string; date: string }[] = [];

  // Fetch commits from each branch
  const promises = branches.map(async (branch) => {
    try {
      const res = await fetchWithAuth(`${baseUrl}/commits?sha=${branch}&per_page=5`);
      if (res.ok) {
        const data = await res.json();
        return data.map((c: { commit: { message: string; author: { date: string } } }) => ({
          message: c.commit.message.split('\n')[0],
          date: c.commit.author.date
        }));
      }
    } catch {
      // Skip failed branches
    }
    return [];
  });

  const results = await Promise.all(promises);
  results.forEach(commits => allCommits.push(...commits));

  // Sort by date and deduplicate
  const uniqueCommits = Array.from(
    new Map(allCommits.map(c => [c.message, c])).values()
  );
  uniqueCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return uniqueCommits.slice(0, 15).map(c => c.message);
}

async function fetchKeyFiles(
  owner: string,
  repo: string,
  fileTree: string[],
  branch: string
): Promise<{ path: string; content: string }[]> {
  // Priority patterns for key files
  const priorityPatterns = [
    /^README\.md$/i,
    /^src\/index\.(ts|tsx|js|jsx)$/,
    /^src\/app\.(ts|tsx|js|jsx)$/,
    /^src\/main\.(ts|tsx|js|jsx|py)$/,
    /^app\/page\.(ts|tsx|js|jsx)$/,
    /^app\/layout\.(ts|tsx|js|jsx)$/,
    /^index\.(ts|tsx|js|jsx|py)$/,
    /^main\.(ts|tsx|js|jsx|py)$/,
    /^app\.(ts|tsx|js|jsx|py)$/,
    /package\.json$/,
    /requirements\.txt$/,
    /Cargo\.toml$/,
    /pyproject\.toml$/
  ];

  // Find matching files
  const keyFilePaths = fileTree
    .filter(path => priorityPatterns.some(pattern => pattern.test(path)))
    .slice(0, 5); // Limit to 5 key files

  // Fetch content for each key file
  const keyFiles: { path: string; content: string }[] = [];

  for (const path of keyFilePaths) {
    try {
      const res = await fetchWithAuth(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          // Truncate large files
          keyFiles.push({
            path,
            content: content.slice(0, 3000) + (content.length > 3000 ? '\n...[truncated]' : '')
          });
        }
      }
    } catch {
      // Skip files that fail to fetch
    }
  }

  return keyFiles;
}

export function estimateLinesOfCode(fileTree: string[], totalSize: number): number {
  // Filter for code files
  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
    '.cpp', '.c', '.h', '.css', '.scss', '.html', '.vue', '.svelte'
  ];

  const codeFiles = fileTree.filter(path =>
    codeExtensions.some(ext => path.endsWith(ext))
  );

  // Rough estimate: average 25 bytes per line, only count code files
  const codeRatio = codeFiles.length / Math.max(fileTree.length, 1);
  const estimatedCodeSize = totalSize * codeRatio;
  const estimatedLines = Math.round(estimatedCodeSize / 25);

  return Math.max(estimatedLines, codeFiles.length * 50); // Minimum estimate
}
