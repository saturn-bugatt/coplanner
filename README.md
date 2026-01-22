# CoPlanner - Saturn Hackathon Leaderboard

A live, animated leaderboard for Saturn's hackathon featuring an AI "hype announcer" agent (CoPlanner) that scores projects against judging criteria and provides entertaining commentary.

## Features

- **Live Leaderboard**: Animated table with rank changes, score updates, and glow effects
- **AI Scoring**: Claude API evaluates repos against the hackathon rubric
- **CoPlanner Mascot**: Animated Saturn-themed bot with speech bubbles
- **Dual Tracks**: Support for "High-Stakes Financial" and "Underserved Problems" tracks
- **Auto-Refresh**: Updates every minute via Vercel cron
- **Dark Theme**: Space-inspired design with Saturn branding

## Quick Start

### 1. Install Dependencies

```bash
cd coplanner
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file:

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...  # optional, for higher rate limits
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the leaderboard.

### 4. Trigger Initial Refresh

Visit [http://localhost:3000/api/refresh](http://localhost:3000/api/refresh) to trigger the first score analysis.

## Configuration

### Adding Teams

Edit `data/repos.json` to add hackathon teams:

```json
{
  "teams": [
    {
      "id": "unique-team-id",
      "name": "Team Display Name",
      "repo": "https://github.com/owner/repo",
      "track": 1
    }
  ]
}
```

**Tracks:**
- `1` = High-Stakes Financial Decisions
- `2` = Underserved Problems

### Scoring Rubric

The AI scoring evaluates three criteria (1-5 each):
- **Problem**: How significant and well-defined is the problem?
- **Solution**: How innovative and effective is the solution?
- **Execution**: How well-implemented is it technically?

Total = Problem + Solution + Execution (max 15)

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `ANTHROPIC_API_KEY`
   - `GITHUB_TOKEN` (optional)
   - `CRON_SECRET` (optional, for securing the refresh endpoint)

The `vercel.json` configures a cron job to refresh scores every minute.

## Project Structure

```
coplanner/
├── app/
│   ├── page.tsx              # Main leaderboard page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Tailwind + custom styles
│   └── api/
│       ├── leaderboard/      # GET current standings
│       ├── refresh/          # POST trigger refresh (cron)
│       └── analyze/          # POST analyze single repo
├── components/
│   ├── Leaderboard.tsx       # Main table
│   ├── LeaderboardRow.tsx    # Animated row
│   ├── CoPlanner.tsx         # Mascot + speech
│   ├── SpeechBubble.tsx      # Animated bubble
│   ├── Background.tsx        # Starfield animation
│   └── Header.tsx            # Logo + title
├── lib/
│   ├── github.ts             # GitHub API helpers
│   ├── analyzer.ts           # Claude scoring
│   ├── storage.ts            # Score persistence
│   └── rubric.ts             # Judging criteria
├── data/
│   └── repos.json            # Team config
└── public/
    └── saturn-logo-white.png # Logo asset
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **AI Scoring**: Claude API (Sonnet)
- **Deployment**: Vercel

## API Endpoints

### GET /api/leaderboard
Returns current scores and recent commentary.

### GET/POST /api/refresh
Triggers a full refresh of all team scores. Protected by `CRON_SECRET` in production.

### POST /api/analyze
Analyze a single team's repo:
```json
{
  "teamId": "team-1",
  "teamName": "Team Name",
  "repo": "https://github.com/owner/repo",
  "track": 1
}
```
# Deployed via Vercel
