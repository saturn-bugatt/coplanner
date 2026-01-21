import { TeamScore } from './rubric';
import * as fs from 'fs';
import * as path from 'path';

// In-memory cache for development and serverless
let cachedScores: TeamScore[] = [];
let cachedCommentary: { message: string; timestamp: string }[] = [];

const DATA_DIR = path.join(process.cwd(), '.data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const COMMENTARY_FILE = path.join(DATA_DIR, 'commentary.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load scores from file
function loadScoresFromFile(): TeamScore[] {
  try {
    ensureDataDir();
    if (fs.existsSync(SCORES_FILE)) {
      const data = fs.readFileSync(SCORES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading scores from file:', error);
  }
  return [];
}

// Save scores to file
function saveScoresToFile(scores: TeamScore[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
  } catch (error) {
    console.error('Error saving scores to file:', error);
  }
}

// Load commentary from file
function loadCommentaryFromFile(): { message: string; timestamp: string }[] {
  try {
    ensureDataDir();
    if (fs.existsSync(COMMENTARY_FILE)) {
      const data = fs.readFileSync(COMMENTARY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading commentary from file:', error);
  }
  return [];
}

// Save commentary to file
function saveCommentaryToFile(commentary: { message: string; timestamp: string }[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(COMMENTARY_FILE, JSON.stringify(commentary, null, 2));
  } catch (error) {
    console.error('Error saving commentary to file:', error);
  }
}

export async function getScores(): Promise<TeamScore[]> {
  if (cachedScores.length === 0) {
    cachedScores = loadScoresFromFile();
  }
  return cachedScores;
}

export async function saveScores(scores: TeamScore[]): Promise<void> {
  // Calculate ranks
  const sortedScores = [...scores].sort((a, b) => b.total - a.total);
  sortedScores.forEach((score, index) => {
    const existingScore = cachedScores.find(s => s.teamId === score.teamId);
    score.previousRank = existingScore?.currentRank;
    score.currentRank = index + 1;
  });

  cachedScores = sortedScores;
  saveScoresToFile(sortedScores);
}

export async function updateScore(score: TeamScore): Promise<void> {
  const existingIndex = cachedScores.findIndex(s => s.teamId === score.teamId);
  if (existingIndex >= 0) {
    cachedScores[existingIndex] = score;
  } else {
    cachedScores.push(score);
  }

  // Recalculate ranks
  await saveScores(cachedScores);
}

export async function getCommentary(limit: number = 10): Promise<{ message: string; timestamp: string }[]> {
  if (cachedCommentary.length === 0) {
    cachedCommentary = loadCommentaryFromFile();
  }
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

  saveCommentaryToFile(cachedCommentary);
}

export async function clearCache(): Promise<void> {
  cachedScores = [];
  cachedCommentary = [];
}
